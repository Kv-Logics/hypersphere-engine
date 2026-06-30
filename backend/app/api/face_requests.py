from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Response
from fastapi.responses import Response
from datetime import datetime
from typing import List, Optional
import logging

from app.db.database import database, faculty, face_requests
from app.db.vector_index import vector_index
from app.core.pipeline import face_pipeline
from app.models.schemas import FaceRequestResponse

router = APIRouter(prefix="/face-requests", tags=["face-requests"])
logger = logging.getLogger(__name__)

@router.post("", response_model=FaceRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_face_request(
    user_id: str = Form(...),
    request_type: str = Form(...), # "register", "update", "issue_report"
    message: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    # Verify user exists
    user_query = faculty.select().where(faculty.c.id == user_id)
    user = await database.fetch_one(user_query)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' does not exist."
        )

    img_bytes = None
    if file:
        img_bytes = await file.read()

    # Create request record
    ins_query = face_requests.insert().values(
        user_id=user_id,
        request_type=request_type,
        message=message,
        status="pending",
        uploaded_image=img_bytes,
        created_at=datetime.utcnow()
    )
    request_id = await database.execute(ins_query)

    # If it is a registration or update request, change user's status to pending_review
    if request_type in ["register", "update"]:
        upd_query = faculty.update().where(faculty.c.id == user_id).values(face_status="pending_review")
        await database.execute(upd_query)

    # Fetch and return new request
    sel_query = face_requests.select().where(face_requests.c.id == request_id)
    new_req = await database.fetch_one(sel_query)
    return new_req

@router.get("", response_model=List[FaceRequestResponse])
async def list_face_requests(user_id: Optional[str] = None, status: Optional[str] = None):
    query = face_requests.select()
    if user_id:
        query = query.where(face_requests.c.user_id == user_id)
    if status:
        query = query.where(face_requests.c.status == status)
    
    # Order by created_at desc
    query = query.order_by(face_requests.c.created_at.desc())
    return await database.fetch_all(query)

@router.get("/{req_id}", response_model=FaceRequestResponse)
async def get_face_request(req_id: int):
    query = face_requests.select().where(face_requests.c.id == req_id)
    req = await database.fetch_one(query)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request with ID {req_id} not found."
        )
    return req

@router.get("/{req_id}/image")
async def get_face_request_image(req_id: int):
    query = face_requests.select().where(face_requests.c.id == req_id)
    req = await database.fetch_one(query)
    if not req or not req["uploaded_image"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found for this request."
        )
    return Response(content=req["uploaded_image"], media_type="image/jpeg")

@router.post("/{req_id}/approve", response_model=FaceRequestResponse)
async def approve_face_request(req_id: int, admin_notes: Optional[str] = Form(None)):
    # 1. Fetch request details
    req_query = face_requests.select().where(face_requests.c.id == req_id)
    req = await database.fetch_one(req_query)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request with ID {req_id} not found."
        )
    
    if req["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request has already been processed (status: {req['status']})."
        )
        
    user_id = req["user_id"]
    
    if not req["uploaded_image"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve request because no image is attached."
        )
        
    # 2. Process image using Face Pipeline to extract embedding
    try:
        _, embedding, liveness, quality, feedback, raw_norm, stage_metrics = face_pipeline.process_image(req["uploaded_image"], is_enrollment=True)
    except Exception as e:
        logger.error(f"Face processing failed during approval: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face extraction failed: {str(e)}"
        )
        
    if feedback:
        feedback_msg = " ".join(feedback)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Approval failed: Registration quality gate failed: {feedback_msg}"
        )
        
    # Duplicate face search before enrollment (Fix 5)
    dup_results = await vector_index.search(embedding, top_k=1)
    if dup_results:
        dup_faculty_id, dup_similarity = dup_results[0]
        if dup_faculty_id != user_id and dup_similarity >= settings.DUPLICATE_SEARCH_THRESHOLD:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate face detected. This face already matches registered user '{dup_faculty_id}' (similarity: {dup_similarity:.2f})."
            )

    # 3. Add to face_embeddings table
    try:
        await vector_index.add_vector(user_id, embedding, raw_norm=raw_norm)
    except Exception as e:
        logger.error(f"Failed to update vector index: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error: failed to update biometric index."
        )
        
    # 4. Update user's face_status to approved
    upd_user = faculty.update().where(faculty.c.id == user_id).values(face_status="approved")
    await database.execute(upd_user)
    
    # 5. Update request status to approved
    upd_req = face_requests.update().where(face_requests.c.id == req_id).values(
        status="approved",
        admin_notes=admin_notes,
        resolved_at=datetime.utcnow()
    )
    await database.execute(upd_req)
    
    # Return updated request details
    return await database.fetch_one(req_query)

@router.post("/{req_id}/reject", response_model=FaceRequestResponse)
async def reject_face_request(req_id: int, admin_notes: Optional[str] = Form(None)):
    req_query = face_requests.select().where(face_requests.c.id == req_id)
    req = await database.fetch_one(req_query)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request with ID {req_id} not found."
        )
        
    if req["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request has already been processed (status: {req['status']})."
        )
        
    user_id = req["user_id"]
    
    # Check if user has an existing active embedding to decide status fallback
    user_query = faculty.select().where(faculty.c.id == user_id)
    user = await database.fetch_one(user_query)
    
    # Fallback to none if no embedding exists, otherwise keep registered/approved status
    fallback_status = "none"
    if user and user["embedding"] is not None:
         fallback_status = "registered"
         
    # 1. Revert user face_status
    upd_user = faculty.update().where(faculty.c.id == user_id).values(face_status=fallback_status)
    await database.execute(upd_user)
    
    # 2. Update request status to rejected
    upd_req = face_requests.update().where(face_requests.c.id == req_id).values(
        status="rejected",
        admin_notes=admin_notes,
        resolved_at=datetime.utcnow()
    )
    await database.execute(upd_req)
    
    return await database.fetch_one(req_query)
