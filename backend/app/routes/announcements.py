from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List

from app.database.mongo import get_database
from app.dependencies import get_current_user
from app.schemas import AnnouncementOut
from app.utils.time import iso_ist

router = APIRouter(prefix="/announcements", tags=["Announcements"])

@router.get("/active", response_model=List[AnnouncementOut])
async def get_active_announcements(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    if not department:
        return []

    # Get active announcements for this department where expires_at is strictly in the future
    current_time = iso_ist()
    cursor = db.announcements.find({
        "department": department,
        "expires_at": {"$gt": current_time}
    }).sort("created_at", -1)
    
    announcements = await cursor.to_list(length=None)
    
    # Strip _id
    for ann in announcements:
        ann.pop("_id", None)
        
    return announcements
