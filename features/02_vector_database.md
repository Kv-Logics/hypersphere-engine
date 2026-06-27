# Feature F-02: Vector Database & Storage

## 📖 Overview
To scale to thousands of registered profiles, the engine implements a persistent database layer using **PostgreSQL** coupled with the **`pgvector`** extension for highly optimized vector indexing and similarity searches.

---

## 🛠️ Implementation Details

### 1. Persistent Layer (PostgreSQL + pgvector)
*   **Vector Operator:** Cosine Distance (`<=>`) is utilized for comparison, defined as:
    $$\text{Cosine Distance} = 1 - \frac{A \cdot B}{\|A\| \|B\|}$$
*   **Async Driver:** Powered by `asyncpg` via SQLAlchemy's `create_async_engine`.
*   **Database Schema:**
    *   `faculty_profiles`: Stores ID, Name, Created Timestamp, and the 512-D float array (`Vector(512)`).
    *   `attendance_records`: Stores transaction audit logs (Timestamp, Device ID, Match Status, Confidence score, Liveness score).
*   **File Location:** `backend/app/db/database.py`, `backend/app/models/`

### 2. Local Fallback Layer (FAISS Indexing)
*   **Library:** `faiss-cpu` (Facebook AI Similarity Search)
*   **Mechanism:**
    *   If the database connection fails or is offline (such as during local development without Docker), the application switches to local mode.
    *   Embeddings are saved in memory and serialized to `faiss_vectors.index` along with `faiss_vectors.index.map` (which stores the ID mapping).
    *   Performs fast flat L2 index search on the 512-D vectors.
*   **File Location:** `backend/app/db/vector_index.py` -> `VectorIndex` manager class.

---

## ⚠️ Important Syntax Constraint
When writing raw SQL queries for pgvector in SQLAlchemy, do **not** use the double-colon cast format:
```sql
-- WRONG (Throws a Bind Parameter error in SQLAlchemy):
SELECT * FROM faculty_profiles ORDER BY embedding <=> :vector_param::vector LIMIT 1;
```
Instead, always use the SQL standard **`CAST`** function:
```sql
-- CORRECT (Works perfectly with SQLAlchemy's parameter binding):
SELECT * FROM faculty_profiles ORDER BY embedding <=> CAST(:vector_param AS vector(512)) LIMIT 1;
```
This is implemented in `backend/app/db/vector_index.py` -> `search()` method.
