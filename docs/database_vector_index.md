# Reference: Database & Vector Indexing Plan

This reference document outlines the schema, tables, and indexing strategy for storing identity embeddings and transaction logs.

## 1. Relational Database Schema (SQLAlchemy/PostgreSQL)

### Table: `faculty`
*   `id` (VARCHAR(50), Primary Key): Unique identifier.
*   `name` (VARCHAR(100), Not Null): Full name.
*   `created_at` (DateTime): Auto-generated creation timestamp.
*   `is_active` (Boolean): Flag to disable profiles without deleting records.

### Table: `attendance_records`
*   `id` (INTEGER, Primary Key, Autoincrement): Record serial ID.
*   `faculty_id` (VARCHAR(50), Foreign Key to `faculty.id`): Identity of verified person (null if rejected/unknown).
*   `timestamp` (DateTime, Not Null): Time of transaction.
*   `status` (VARCHAR(20), Not Null): Final decision (`CONFIRMED`, `REJECTED`).
*   `similarity_score` (Float, Nullable): Vector matching similarity.
*   `liveness_score` (Float, Nullable): Anti-spoofing prediction confidence.
*   `quality_score` (Float, Nullable): Quality assessment score.
*   `device_id` (VARCHAR(100), Not Null): Client camera station ID.

---

## 2. Biometric Vector Search (FAISS Indexing)

To support instant lookups as the directory scales, the system uses **FAISS (Facebook AI Similarity Search)**.

*   **In-Memory Index**: Uses `faiss.IndexFlatIP` (flat inner product) to search normalized 512-D vectors. This guarantees exact cosine similarity.
*   **Search**: Query embeddings are L2-normalized and matched using dot product. Returns matching indices and cosine distances.
*   **NumPy Fallback**: If FAISS is not compiled or installed in the target host, the manager automatically redirects logic to a vector matrix computation using pure NumPy dot product.
*   **Persistence**: Saves index files to `faiss_vectors.index` and ID-to-faculty relationships to `faiss_vectors.index.map`.
