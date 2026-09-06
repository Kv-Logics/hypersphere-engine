import databases
import sqlalchemy
from app.config import settings

# Database connection
database = databases.Database(settings.DATABASE_URL)
metadata = sqlalchemy.MetaData()

is_postgres = settings.DATABASE_URL.startswith("postgresql") or settings.DATABASE_URL.startswith("postgres")
if not is_postgres:
    import logging
    logging.getLogger(__name__).info("Initializing in SQLite local mode with vector capability.")

# Define columns dynamically
faculty_columns = [
    sqlalchemy.Column("id", sqlalchemy.String(50), primary_key=True), # username/email prefix
    sqlalchemy.Column("name", sqlalchemy.String(100), nullable=False),
    sqlalchemy.Column("email", sqlalchemy.String(100), nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String(20), default="user"), # "user", "admin"
    sqlalchemy.Column("emp_id", sqlalchemy.String(20), nullable=True),
    sqlalchemy.Column("department", sqlalchemy.String(50), nullable=True),
    sqlalchemy.Column("designation", sqlalchemy.String(50), nullable=True),
    sqlalchemy.Column("face_status", sqlalchemy.String(20), default="none"), # "none", "registered", "pending_review", "approved"
]

if is_postgres:
    from pgvector.sqlalchemy import Vector
    faculty_columns.append(sqlalchemy.Column("embedding", Vector(512), nullable=True))

faculty_columns.extend([
    sqlalchemy.Column("embedding_model", sqlalchemy.String(50), nullable=True),
    sqlalchemy.Column("embedding_created", sqlalchemy.DateTime(), nullable=True),
    sqlalchemy.Column("embedding_quality", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("embedding_count", sqlalchemy.Integer(), default=1),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime(), server_default=sqlalchemy.func.now()),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime(), server_default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    sqlalchemy.Column("is_active", sqlalchemy.Boolean(), default=True),
])

# Define tables
faculty = sqlalchemy.Table(
    "faculty",
    metadata,
    *faculty_columns
)

# Dedicated table for multiple face embeddings per faculty member
face_embeddings = sqlalchemy.Table(
    "face_embeddings",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer(), primary_key=True, autoincrement=True),
    sqlalchemy.Column("faculty_id", sqlalchemy.String(50), sqlalchemy.ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False),
    sqlalchemy.Column("embedding", Vector(512) if is_postgres else sqlalchemy.LargeBinary(), nullable=False),
    sqlalchemy.Column("model_version", sqlalchemy.String(50), default="arcface_w600k_r50_v1", nullable=False),
    sqlalchemy.Column("drift_review_pending", sqlalchemy.Boolean(), default=False, server_default=sqlalchemy.text("false"), nullable=False),
    sqlalchemy.Column("raw_norm", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime(), server_default=sqlalchemy.func.now())
)

# New table for Face registration/update/issue request flow
face_requests = sqlalchemy.Table(
    "face_requests",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer(), primary_key=True, autoincrement=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(50), sqlalchemy.ForeignKey("faculty.id", ondelete="CASCADE")),
    sqlalchemy.Column("request_type", sqlalchemy.String(20), nullable=False), # "register", "update", "issue_report"
    sqlalchemy.Column("message", sqlalchemy.Text(), nullable=True),
    sqlalchemy.Column("status", sqlalchemy.String(20), default="pending"), # "pending", "approved", "rejected"
    sqlalchemy.Column("uploaded_image", sqlalchemy.LargeBinary(), nullable=True), # image blob
    sqlalchemy.Column("admin_notes", sqlalchemy.Text(), nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime(), server_default=sqlalchemy.func.now()),
    sqlalchemy.Column("resolved_at", sqlalchemy.DateTime(), nullable=True),
)

attendance_records = sqlalchemy.Table(
    "attendance_records",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer(), primary_key=True, autoincrement=True),
    sqlalchemy.Column("faculty_id", sqlalchemy.String(50), sqlalchemy.ForeignKey("faculty.id", ondelete="SET NULL")),
    sqlalchemy.Column("timestamp", sqlalchemy.DateTime(), nullable=False),
    sqlalchemy.Column("status", sqlalchemy.String(20), nullable=False), # CONFIRMED, REJECTED, MANUAL_REVIEW
    sqlalchemy.Column("similarity_score", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("liveness_score", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("quality_score", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("device_id", sqlalchemy.String(100), nullable=False),
    sqlalchemy.Column("session_token", sqlalchemy.String(255), nullable=True),
    sqlalchemy.Column("detector_confidence", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("model_version", sqlalchemy.String(50), default="arcface_w600k_r50_v1", nullable=True),
    sqlalchemy.Column("location_name", sqlalchemy.String(100), nullable=True),
    sqlalchemy.Column("latitude", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("longitude", sqlalchemy.Float(), nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime(), server_default=sqlalchemy.func.now()),
)

# Engine setup
sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
engine = sqlalchemy.create_engine(sync_url)

async def init_db():
    if is_postgres:
        from sqlalchemy.ext.asyncio import create_async_engine
        async_engine = create_async_engine(settings.DATABASE_URL)
        async with async_engine.begin() as conn:
            await conn.execute(sqlalchemy.text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.run_sync(metadata.create_all)
            
            # Safe migrations for existing legacy faculty table columns
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS email VARCHAR(100);"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS emp_id VARCHAR(20);"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS department VARCHAR(50);"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS designation VARCHAR(50);"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS face_status VARCHAR(20) DEFAULT 'none';"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS raw_norm FLOAT;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS drift_review_pending BOOLEAN DEFAULT false;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE face_embeddings ALTER COLUMN drift_review_pending SET DEFAULT false;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS detector_confidence FLOAT;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'arcface_w600k_r50_v1';"))
            await conn.execute(sqlalchemy.text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS location_name VARCHAR(100);"))
            await conn.execute(sqlalchemy.text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS latitude FLOAT;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS longitude FLOAT;"))

            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50);"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS embedding_created TIMESTAMP;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS embedding_quality DOUBLE PRECISION;"))
            await conn.execute(sqlalchemy.text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS embedding_count INTEGER DEFAULT 1;"))

            # Drop old indexes if they exist to apply updated HNSW configuration (m=32, ef_construction=128)
            await conn.execute(sqlalchemy.text("DROP INDEX IF EXISTS faculty_embedding_cos_hnsw_idx;"))
            await conn.execute(sqlalchemy.text("DROP INDEX IF EXISTS face_embeddings_embedding_cos_hnsw_idx;"))

            # Create HNSW index for cosine distance to ensure optimal nearest neighbor search performance
            await conn.execute(sqlalchemy.text(
                "CREATE INDEX IF NOT EXISTS faculty_embedding_cos_hnsw_idx ON faculty USING hnsw (embedding vector_cosine_ops) WITH (m = 32, ef_construction = 128);"
            ))
            
            # Create HNSW index for the face_embeddings table
            await conn.execute(sqlalchemy.text(
                "CREATE INDEX IF NOT EXISTS face_embeddings_embedding_cos_hnsw_idx ON face_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 32, ef_construction = 128);"
            ))
            
            # Migrate existing embeddings from faculty to face_embeddings table
            migrate_query = """
                INSERT INTO face_embeddings (faculty_id, embedding, model_version, drift_review_pending, created_at)
                SELECT id, embedding, 'arcface_w600k_r50_v1', false, NOW()
                FROM faculty
                WHERE embedding IS NOT NULL
                AND id NOT IN (SELECT DISTINCT faculty_id FROM face_embeddings);
            """
            await conn.execute(sqlalchemy.text(migrate_query))
            
        await async_engine.dispose()
    else:
        # SQLite mode
        metadata.create_all(engine)

