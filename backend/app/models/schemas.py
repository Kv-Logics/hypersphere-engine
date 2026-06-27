from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class FacultyCreate(BaseModel):
    id: str = Field(..., max_length=50, description="Unique Faculty/User ID")
    name: str = Field(..., max_length=100, description="Full Name of the faculty member")

class FacultyResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    role: str
    emp_id: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    face_status: str
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class UserLookupResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    role: str
    face_status: str

class ManualRegisterRequest(BaseModel):
    id: str = Field(..., max_length=50, description="Username (email prefix)")
    name: str = Field(..., max_length=100, description="Full Name")
    email: str = Field(..., max_length=100, description="Email address")

class FaceRequestCreate(BaseModel):
    request_type: str = Field("update", description="update | issue_report")
    message: Optional[str] = None

class FaceRequestResponse(BaseModel):
    id: int
    user_id: str
    request_type: str
    message: Optional[str] = None
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CandidateMatch(BaseModel):
    faculty_id: str
    name: str
    similarity_score: float

class VerifyResponse(BaseModel):
    status: str = Field(..., description="Decision status: CONFIRMED, REJECTED, or MANUAL_REVIEW")
    match_found: bool
    candidate: Optional[CandidateMatch] = None
    liveness_score: float
    quality_score: float
    timestamp: datetime
    device_id: str
    feedback: List[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    database_connected: bool
    recognition_model_loaded: bool
    antispoof_model_loaded: bool
    faiss_available: bool
