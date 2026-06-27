import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hypersphere Face Attendance Engine"
    API_V1_STR: str = "/api/v1"
    
    # Model Configurations
    RECOGNITION_MODEL_PATH: str = Field(
        default=os.getenv("RECOGNITION_MODEL_PATH", "w600k_r50.onnx"),
        description="Path to ONNX Face Recognition model"
    )
    ANTISPOOF_MODEL_PATH: str = Field(
        default=os.getenv("ANTISPOOF_MODEL_PATH", "2.7_80x80_MiniFASNetV2.pth"),
        description="Path to PyTorch Anti-Spoof model weight"
    )
    
    # Thresholds
    MATCH_THRESHOLD: float = 0.45
    ANTISPOOF_THRESHOLD: float = 0.40
    BBOX_EXPANSION: float = 2.7
    
    # Database Settings
    DATABASE_URL: str = Field(
        default="sqlite:///./face_attendance.db",
        description="SQL Database connection string (defaults to SQLite, use postgresql:// for production)"
    )
    
    # Vector DB Index Path
    VECTOR_INDEX_PATH: str = "faiss_vectors.index"
    
    class Config:
        case_sensitive = True

settings = Settings()
