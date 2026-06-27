import numpy as np
import logging

logger = logging.getLogger(__name__)

# Compatibility placeholder (indexing is managed strictly by pgvector)
HAS_FAISS = False

class VectorIndexManager:
    def __init__(self, dimension=512):
        from app.db.database import is_postgres
        if not is_postgres:
            raise RuntimeError("CRITICAL: PostgreSQL + pgvector is required. Vector index fallback is disabled.")
        self.dimension = dimension

    async def add_vector(self, faculty_id: str, embedding: np.ndarray):
        """Adds a normalized 512-D embedding to the PostgreSQL pgvector column."""
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        else:
            raise ValueError("Cannot index a zero vector.")

        from app.db.database import database, faculty
        emb_list = embedding.tolist()
        query = faculty.update().where(faculty.c.id == faculty_id).values(embedding=emb_list)
        await database.execute(query)
        logger.info(f"Vector for faculty {faculty_id} saved to PostgreSQL pgvector.")

    async def search(self, query_embedding: np.ndarray, top_k=5):
        """Searches pgvector index for query_embedding. Returns list of (faculty_id, similarity_score)."""
        norm = np.linalg.norm(query_embedding)
        if norm > 0:
            query_embedding = query_embedding / norm
            
        from app.db.database import database
        emb_list = query_embedding.tolist()
        raw_query = """
            SELECT id, name, (1 - (embedding <=> CAST(:query_val AS vector(512)))) AS similarity
            FROM faculty
            WHERE is_active = true AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:query_val AS vector(512))
            LIMIT :limit
        """
        results = await database.fetch_all(
            query=raw_query, 
            values={"query_val": str(emb_list), "limit": top_k}
        )
        return [(r["id"], float(r["similarity"])) for r in results]

    def save(self):
        pass

    def load(self):
        pass

vector_index = VectorIndexManager()
