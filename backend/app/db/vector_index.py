import numpy as np
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Compatibility placeholder (indexing is managed strictly by pgvector)
HAS_FAISS = False

class VectorIndexManager:
    def __init__(self, dimension=512):
        self.dimension = dimension

    async def add_vector(self, faculty_id: str, embedding: np.ndarray, model_version="arcface_w600k_r50_v1", drift_review_pending=False, raw_norm: Optional[float] = None):
        """Adds a normalized 512-D embedding to the face_embeddings table, keeping at most 15 records per user."""
        calc_norm = np.linalg.norm(embedding)
        norm_to_save = raw_norm if raw_norm is not None else calc_norm
        
        # If the input vector has not been pre-normalized, normalize it
        if abs(calc_norm - 1.0) > 1e-4:
            if calc_norm > 0:
                embedding = embedding / calc_norm
            else:
                raise ValueError("Cannot index a zero vector.")

        from app.db.database import database, face_embeddings, is_postgres
        if is_postgres:
            emb_data = embedding.tolist()
        else:
            emb_data = embedding.astype(np.float32).tobytes()
        
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
            embedding=emb_data,
            model_version=model_version,
            drift_review_pending=drift_review_pending,
            raw_norm=float(norm_to_save)
        )
        await database.execute(insert_query)
        logger.info(f"Vector for faculty {faculty_id} saved (Pending review: {drift_review_pending}, Raw norm: {norm_to_save:.2f}).")

    async def search(self, query_embedding: np.ndarray, top_k=5):
        """Searches index in face_embeddings table for query_embedding. Returns list of (faculty_id, similarity_score)."""
        norm = np.linalg.norm(query_embedding)
        if norm > 0:
            query_embedding = query_embedding / norm
            
        from app.db.database import database, is_postgres
        if is_postgres:
            emb_list = query_embedding.tolist()
            candidate_limit = top_k * 10
            raw_query = """
                SELECT fe.faculty_id AS id, (1 - (fe.embedding <=> CAST(:query_val AS vector(512)))) AS similarity
                FROM face_embeddings fe
                JOIN faculty f ON f.id = fe.faculty_id
                WHERE f.is_active = true AND fe.drift_review_pending = false
                ORDER BY fe.embedding <=> CAST(:query_val AS vector(512))
                LIMIT :limit
            """
            async with database.transaction():
                await database.execute("SET hnsw.ef_search = 80;")
                results = await database.fetch_all(
                    query=raw_query, 
                    values={"query_val": str(emb_list), "limit": candidate_limit}
                )
            
            user_matches = {}
            for r in results:
                fid = r["id"]
                sim = float(r["similarity"])
                if fid not in user_matches or sim > user_matches[fid]:
                    user_matches[fid] = sim
                    
            sorted_matches = sorted(user_matches.items(), key=lambda x: x[1], reverse=True)
            return sorted_matches[:top_k]
        else:
            # SQLite / Local fallback mode
            raw_query = """
                SELECT fe.faculty_id AS id, fe.embedding
                FROM face_embeddings fe
                JOIN faculty f ON f.id = fe.faculty_id
                WHERE f.is_active = 1 AND fe.drift_review_pending = 0
            """
            rows = await database.fetch_all(query=raw_query)
            if not rows:
                return []
                
            user_matches = {}
            for r in rows:
                fid = r["id"]
                emb_raw = r["embedding"]
                if isinstance(emb_raw, bytes):
                    emb_vec = np.frombuffer(emb_raw, dtype=np.float32)
                elif isinstance(emb_raw, list):
                    emb_vec = np.array(emb_raw, dtype=np.float32)
                else:
                    continue
                v_norm = np.linalg.norm(emb_vec)
                if v_norm > 0:
                    emb_vec = emb_vec / v_norm
                sim = float(np.dot(query_embedding, emb_vec))
                if fid not in user_matches or sim > user_matches[fid]:
                    user_matches[fid] = sim
                    
            sorted_matches = sorted(user_matches.items(), key=lambda x: x[1], reverse=True)
            return sorted_matches[:top_k]

    def save(self):
        pass

    def load(self):
        pass

vector_index = VectorIndexManager()
