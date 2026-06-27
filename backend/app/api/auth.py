from fastapi import APIRouter, HTTPException, status
from app.db.database import database, faculty
from app.models.schemas import UserLookupResponse, ManualRegisterRequest, FacultyResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/lookup", response_model=UserLookupResponse)
async def lookup_user(username: str):
    username = username.strip().lower()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username query parameter is required."
        )
        
    query = faculty.select().where(faculty.c.id == username)
    user = await database.fetch_one(query)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Username '{username}' not found. Please register manually."
        )
        
    return user

@router.post("/register-manual", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
async def register_manual(req: ManualRegisterRequest):
    username = req.id.strip().lower()
    name = req.name.strip()
    email = req.email.strip().lower()
    
    if not username or not name or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username, Name, and Email are all required."
        )
        
    # Check if username already exists
    query = faculty.select().where(faculty.c.id == username)
    existing_user = await database.fetch_one(query)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{username}' is already taken."
        )
        
    # Insert new manual user
    insert_query = faculty.insert().values(
        id=username,
        name=name,
        email=email,
        role="user",
        face_status="none",
        is_active=True
    )
    await database.execute(insert_query)
    
    # Return the user
    new_user = await database.fetch_one(query)
    return new_user
