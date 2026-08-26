import asyncio
import sys
import os
from pathlib import Path

# Add backend directory to sys.path so we can import app modules
backend_dir = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_dir))

from app.database.mongo import get_database
from app.services.crypto import encrypt_encoding
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    if not settings.encryption_key:
        logger.error("ENCRYPTION_KEY is not set in .env! Cannot run migration.")
        sys.exit(1)
        
    db = await get_database()
    cursor = db.users.find({"face_encoding": {"$exists": True, "$nin": [None, []]}})
    
    migrated_count = 0
    skipped_count = 0
    
    async for user in cursor:
        encoding = user.get("face_encoding")
        
        # Check if it's already encrypted (string)
        if isinstance(encoding, str):
            skipped_count += 1
            continue
            
        if isinstance(encoding, list):
            encrypted = encrypt_encoding(encoding)
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"face_encoding": encrypted}}
            )
            migrated_count += 1
            if migrated_count % 100 == 0:
                logger.info(f"Migrated {migrated_count} records...")
                
    logger.info(f"Migration complete! Encrypted {migrated_count} users. Skipped {skipped_count} already encrypted users.")

if __name__ == "__main__":
    asyncio.run(migrate())
