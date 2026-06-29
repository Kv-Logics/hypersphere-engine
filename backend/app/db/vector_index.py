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

    async def add_vector(self, faculty_id: str, embedding: np.ndarray, model_version="arcface_w600k_r50_v1", drift_review_pending=False):
        """Adds a normalized 512-D embedding to the face_embeddings table, keeping at most 15 records per user."""
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        else:
            raise ValueError("Cannot index a zero vector.")

        from app.db.database import database, face_embeddings
        emb_list = embedding.tolist()
        
        # 1. Check current count
        count_res = await database.fetch_one(
            query="SELECT COUNT(*) AS count FROM face_embeddings WHERE faculty_id = :fid",
            values={"fid": faculty_id}
        )
        count = count_res["count"] if count_res else 0
        
        # 2. If count >= 15, delete the oldest one (minimum id)
        if count >= 15:
            delete_query = """
                DELETE FROM face_embeddings 
                WHERE id = (
                    SELECT id FROM face_embeddings 
                    WHERE faculty_id = :fid 
                    ORDER BY id ASC 
                    LIMIT 1
                )
            """
            await database.execute(query=delete_query, values={"fid": faculty_id})
            
        # 3. Insert new embedding
        insert_query = face_embeddings.insert().values(
            faculty_id=faculty_id,
            embedding=emb_list,
            model_version=model_version,
            drift_review_pending=drift_review_pending
        )
        await database.execute(insert_query)
        logger.info(f"Vector for faculty {faculty_id} saved to PostgreSQL face_embeddings (Pending review: {drift_review_pending}).")

    async def search(self, query_embedding: np.ndarray, top_k=5):
        """Searches pgvector index in face_embeddings table for query_embedding. Returns list of (faculty_id, similarity_score)."""
        norm = np.linalg.norm(query_embedding)
        if norm > 0:
            query_embedding = query_embedding / norm
            
        from app.db.database import database
        emb_list = query_embedding.tolist()
        # Fetch more candidates to allow grouping/deduplication in Python
        candidate_limit = top_k * 10
        raw_query = """
            SELECT fe.faculty_id AS id, (1 - (fe.embedding <=> CAST(:query_val AS vector(512)))) AS similarity
            FROM face_embeddings fe
            JOIN faculty f ON f.id = fe.faculty_id
            WHERE f.is_active = true AND fe.drift_review_pending = false
            ORDER BY fe.embedding <=> CAST(:query_val AS vector(512))
            LIMIT :limit
        """
        results = await database.fetch_all(
            query=raw_query, 
            values={"query_val": str(emb_list), "limit": candidate_limit}
        )
        
        # Deduplicate candidates in Python by keeping the max similarity score for each user
        user_matches = {}
        for r in results:
            fid = r["id"]
            sim = float(r["similarity"])
            if fid not in user_matches or sim > user_matches[fid]:
                user_matches[fid] = sim
                
        # Sort and return top_k
        sorted_matches = sorted(user_matches.items(), key=lambda x: x[1], reverse=True)
        return sorted_matches[:top_k]

    def save(self):
        pass

    def load(self):
        pass

vector_index = VectorIndexManager()
