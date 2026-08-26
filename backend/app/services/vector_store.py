from __future__ import annotations

import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

try:
    import faiss
    import numpy as np
    FAISS_AVAILABLE = True
except Exception:
    FAISS_AVAILABLE = False


logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self):
        self.dimension = 128
        self.index = None
        if FAISS_AVAILABLE:
            # We use IndexFlatL2 for Euclidean distance
            base_index = faiss.IndexFlatL2(self.dimension)
            # Wrap it to support custom IDs (our user_ids)
            self.index = faiss.IndexIDMap(base_index)
        
        self.is_ready = False

    async def initialize(self, db: AsyncIOMotorDatabase) -> None:
        if not FAISS_AVAILABLE or self.index is None:
            logger.warning("FAISS is not available. VectorStore will not initialize.")
            return

        logger.info("Initializing FAISS Vector Store...")
        
        # Fetch all active users with face encodings
        cursor = db.users.find({"face_encoding": {"$ne": None}, "is_active": True})
        
        vectors = []
        ids = []
        
        total_attempted = 0
        failed_decryption = 0
        
        async for user in cursor:
            total_attempted += 1
            from .crypto import decrypt_encoding
            try:
                encoding = decrypt_encoding(user.get("face_encoding"))
            except Exception as e:
                logger.error(f"Error decrypting face encoding for user {user.get('id')}: {e}")
                failed_decryption += 1
                continue
                
            if not encoding or len(encoding) != self.dimension:
                continue
            
            vectors.append(encoding)
            ids.append(user["id"])
            
        if vectors:
            np_vectors = np.array(vectors, dtype=np.float32)
            np_ids = np.array(ids, dtype=np.int64)
            self.index.add_with_ids(np_vectors, np_ids)
            
        if failed_decryption > 0:
            if failed_decryption > 2 or (total_attempted > 0 and (failed_decryption / total_attempted) > 0.1):
                logger.critical(f"CRITICAL: {failed_decryption} out of {total_attempted} face encodings failed to decrypt! Check ENCRYPTION_KEY.")
            else:
                logger.warning(f"{failed_decryption} face encodings failed to decrypt out of {total_attempted}.")
            
        self.is_ready = True
        logger.info(f"FAISS initialized with {self.index.ntotal} face vectors.")

    def add_or_update(self, user_id: int, encoding: list[float]) -> None:
        if not self.is_ready or self.index is None:
            return
            
        # FAISS IndexIDMap does not update in place safely without removing first.
        # But wait, IndexIDMap supports remove_ids!
        try:
            self.index.remove_ids(np.array([user_id], dtype=np.int64))
        except Exception:
            pass # ID might not exist, that's fine
            
        np_vector = np.array([encoding], dtype=np.float32)
        np_id = np.array([user_id], dtype=np.int64)
        self.index.add_with_ids(np_vector, np_id)

    def remove(self, user_id: int) -> None:
        if not self.is_ready or self.index is None:
            return
        try:
            self.index.remove_ids(np.array([user_id], dtype=np.int64))
        except Exception:
            pass

    def search(self, query_encoding: list[float], k: int = 1, threshold: float = 0.6) -> list[dict]:
        """
        Returns a list of dicts: [{"user_id": int, "distance": float}]
        Sorted by nearest distance.
        The Euclidean distance threshold for face_recognition is usually 0.6.
        """
        if not self.is_ready or self.index is None or self.index.ntotal == 0:
            return []
            
        np_query = np.array([query_encoding], dtype=np.float32)
        
        # Search returns squared L2 distances (L2^2)
        # However, face_recognition calculates regular L2 distance.
        # Wait! FAISS IndexFlatL2 returns squared Euclidean distance.
        # So we must take the square root of the distance, or compare against threshold^2.
        
        distances, indices = self.index.search(np_query, k)
        
        results = []
        for i in range(k):
            idx = indices[0][i]
            dist_sq = distances[0][i]
            
            if idx == -1:
                continue
                
            dist = float(np.sqrt(dist_sq))
            if dist <= threshold:
                results.append({
                    "user_id": int(idx),
                    "distance": dist
                })
                
        return results

# Global singleton
vector_store = VectorStore()
