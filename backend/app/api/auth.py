from fastapi import APIRouter, HTTPException, status, Response, Request
from app.db.database import database, faculty
from app.models.schemas import UserLookupResponse, ManualRegisterRequest, FacultyResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/lookup", response_model=UserLookupResponse)
async def lookup_user(username: str, response: Response):
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
        
    # Set HttpOnly session cookie
    response.set_cookie(
        key="session_user",
        value=user["id"],
        httponly=True,
        max_age=86400 * 30,  # 30 days
        samesite="lax",
        path="/"
    )
    return user

@router.post("/register-manual", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
async def register_manual(req: ManualRegisterRequest, response: Response):
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
    
    # Return the user and set session cookie
    new_user = await database.fetch_one(query)
    
    response.set_cookie(
        key="session_user",
        value=new_user["id"],
        httponly=True,
        max_age=86400 * 30,  # 30 days
        samesite="lax",
        path="/"
    )
    return new_user

@router.post("/logout")
async def logout_user(response: Response):
    response.delete_cookie(key="session_user", path="/")
    return {"detail": "Logged out successfully"}

@router.get("/me", response_model=FacultyResponse)
async def get_current_user(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. No session found."
        )
        
    query = faculty.select().where(faculty.c.id == username)
    user = await database.fetch_one(query)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session user not found."
        )
        
    return user
