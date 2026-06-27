from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from datetime import datetime
from typing import List, Optional
import logging

from app.config import settings
from app.db.database import database, faculty, attendance_records
from app.db.vector_index import vector_index, HAS_FAISS
from app.core.pipeline import face_pipeline
from app.models.schemas import (
    FacultyCreate,
    FacultyResponse,
    VerifyResponse,
    CandidateMatch,
    HealthResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

from app.api.auth import router as auth_router
from app.api.face_requests import router as face_requests_router

router.include_router(auth_router)
router.include_router(face_requests_router)

@router.get("/health", response_model=HealthResponse)
async def health_check():
    db_connected = False
    try:
        # Check database connection
        await database.execute("SELECT 1")
        db_connected = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    return HealthResponse(
        status="ok",
        database_connected=db_connected,
        recognition_model_loaded=not face_pipeline.use_mock_recog,
        antispoof_model_loaded=not face_pipeline.use_mock_liveness,
        faiss_available=HAS_FAISS
    )

@router.post("/register", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
async def register_faculty(
    faculty_id: str = Form(..., max_length=50),
    name: str = Form(..., max_length=100),
    file: UploadFile = File(...)
):
    faculty_id = faculty_id.strip().lower()
    
    # 1. Check if faculty already exists
    query = faculty.select().where(faculty.c.id == faculty_id)
    existing_faculty = await database.fetch_one(query)
    
    # If user exists and has a face registered already, raise error
    if existing_faculty and existing_faculty["face_status"] in ["registered", "approved"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faculty with ID '{faculty_id}' is already registered."
        )

    # 2. Read file and process face pipeline
    try:
        contents = await file.read()
        _, embedding, liveness, quality, feedback = face_pipeline.process_image(contents)
    except Exception as e:
        logger.error(f"Face processing failed during registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face registration failed: {str(e)}"
        )

    # We enforce a basic quality threshold for enrollment images
    if quality < 0.35:
        feedback_msg = " ".join(feedback) if feedback else "Please capture a clearer face photo."
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Registration image quality too low ({quality:.2f}). {feedback_msg}"
        )

    # 3. Save/Update to database
    if existing_faculty:
        # Update existing pre-seeded user record
        db_query = faculty.update().where(faculty.c.id == faculty_id).values(
            name=name,
            face_status="registered",
            is_active=True
        )
    else:
        # Insert new user record
        db_query = faculty.insert().values(
            id=faculty_id,
            name=name,
            role="user",
            face_status="registered",
            is_active=True
        )
    await database.execute(db_query)

    # 4. Add to Vector Index
    try:
        await vector_index.add_vector(faculty_id, embedding)
    except Exception as e:
        logger.error(f"Failed to add embedding to vector index: {e}")
        # Rollback db update/insertion status
        if existing_faculty:
            rollback_query = faculty.update().where(faculty.c.id == faculty_id).values(
                face_status=existing_faculty["face_status"]
            )
        else:
            rollback_query = faculty.delete().where(faculty.c.id == faculty_id)
        await database.execute(rollback_query)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error: failed to update biometric database index."
        )

    # 5. Fetch and return new record
    new_query = faculty.select().where(faculty.c.id == faculty_id)
    new_rec = await database.fetch_one(new_query)
    return new_rec

@router.post("/register-admin", response_model=FacultyResponse, status_code=status.HTTP_200_OK)
async def register_admin(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    user_id = user_id.strip().lower()
    
    # Verify user exists
    query = faculty.select().where(faculty.c.id == user_id)
    user = await database.fetch_one(query)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' does not exist."
        )

    # Process image
    try:
        contents = await file.read()
        _, embedding, liveness, quality, feedback = face_pipeline.process_image(contents)
    except Exception as e:
        logger.error(f"Face processing failed during admin upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face extraction failed: {str(e)}"
        )

    if quality < 0.35:
        feedback_msg = " ".join(feedback) if feedback else "Image quality too low."
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Upload failed: Image quality too low ({quality:.2f}). {feedback_msg}"
        )

    # Update database
    db_query = faculty.update().where(faculty.c.id == user_id).values(
        face_status="registered",
        is_active=True
    )
    await database.execute(db_query)

    # Add to Vector Index
    try:
        await vector_index.add_vector(user_id, embedding)
    except Exception as e:
        logger.error(f"Failed to add embedding to vector index: {e}")
        # Rollback
        rollback_query = faculty.update().where(faculty.c.id == user_id).values(
            face_status=user["face_status"]
        )
        await database.execute(rollback_query)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update biometric database index."
        )

    # Fetch and return
    new_query = faculty.select().where(faculty.c.id == user_id)
    return await database.fetch_one(new_query)

@router.post("/verify", response_model=VerifyResponse)
async def verify_face(
    device_id: str = Form(...),
    file: UploadFile = File(...)
):
    now = datetime.now()
    
    # 1. Process query image
    try:
        contents = await file.read()
        _, embedding, liveness_score, quality_score, feedback = face_pipeline.process_image(contents)
    except Exception as e:
        logger.warning(f"Verification pipeline failed: {e}")
        # Log rejected attempt with no matched faculty
        db_query = attendance_records.insert().values(
            faculty_id=None,
            timestamp=now,
            status="REJECTED",
            similarity_score=None,
            liveness_score=None,
            quality_score=None,
            device_id=device_id
        )
        await database.execute(db_query)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face verification failed: {str(e)}"
        )

    # 2. Check liveness (Anti-Spoofing)
    is_live = liveness_score >= settings.ANTISPOOF_THRESHOLD
    
    # 3. Vector Database Search
    results = await vector_index.search(embedding, top_k=1)
    
    candidate = None
    match_found = False
    similarity_score = 0.0
    matched_faculty_id = None
    
    if results:
        matched_faculty_id, similarity_score = results[0]
        # Check matching threshold
        if similarity_score >= settings.MATCH_THRESHOLD:
            # Fetch faculty details
            f_query = faculty.select().where(faculty.c.id == matched_faculty_id)
            fac_member = await database.fetch_one(f_query)
            if fac_member and fac_member["is_active"]:
                match_found = True
                candidate = CandidateMatch(
                    faculty_id=matched_faculty_id,
                    name=fac_member["name"],
                    similarity_score=similarity_score
                )

    # 4. Final Decision Status
    if not is_live:
        decision_status = "REJECTED" # Liveness check failed (SPOOF)
    elif match_found:
        decision_status = "CONFIRMED" # Passed both liveness and match thresholds
    else:
        decision_status = "REJECTED" # Passed liveness but did not match any registered user

    # 5. Log record in database
    db_query = attendance_records.insert().values(
        faculty_id=matched_faculty_id if match_found else None,
        timestamp=now,
        status=decision_status,
        similarity_score=similarity_score if results else None,
        liveness_score=liveness_score,
        quality_score=quality_score,
        device_id=device_id
    )
    await database.execute(db_query)

    return VerifyResponse(
        status=decision_status,
        match_found=match_found,
        candidate=candidate,
        liveness_score=liveness_score,
        quality_score=quality_score,
        timestamp=now,
        device_id=device_id,
        feedback=feedback
    )

@router.get("/faculty", response_model=List[FacultyResponse])
async def list_faculty():
    query = faculty.select()
    return await database.fetch_all(query)

@router.delete("/faculty/{faculty_id}", status_code=status.HTTP_200_OK)
async def delete_faculty(faculty_id: str):
    # 1. Verify existence
    query = faculty.select().where(faculty.c.id == faculty_id)
    fac = await database.fetch_one(query)
    if not fac:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty profile with ID '{faculty_id}' does not exist."
        )
        
    # 2. Delete row (removes associated vector embedding from pgvector column)
    delete_query = faculty.delete().where(faculty.c.id == faculty_id)
    await database.execute(delete_query)
    
    logger.info(f"Successfully deleted faculty profile and vector embedding for {faculty_id}")
    return {"status": "success", "message": f"Profile and embedding for '{faculty_id}' deleted successfully."}

@router.get("/attendance")
async def get_attendance(user_id: Optional[str] = None):
    query = attendance_records.select()
    if user_id:
        query = query.where(attendance_records.c.faculty_id == user_id)
    
    # Order by timestamp descending and limit to 50 records
    query = query.order_by(attendance_records.c.timestamp.desc()).limit(50)
    records = await database.fetch_all(query)
    return records

@router.post("/admin/seed-csv", status_code=status.HTTP_200_OK)
async def manual_seed_csv():
    try:
        from app.main import PROJECT_ROOT
        from app.core.csv_loader import seed_users_from_csv
        await seed_users_from_csv(PROJECT_ROOT)
        return {"status": "success", "message": "CSV users database seeding triggered successfully."}
    except Exception as e:
        logger.error(f"Manual CSV seeding failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CSV seeding failed: {str(e)}"
        )
