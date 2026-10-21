from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List

from app.database.mongo import get_database
from app.dependencies import require_role
from app.schemas import AnnouncementCreate, AnnouncementOut
from app.services.attendance_service import _next_id
from app.utils.time import now_ist, iso_ist

router = APIRouter(prefix="/hod/announcements", tags=["HOD Announcements"])

@router.post("", response_model=AnnouncementOut)
async def create_announcement(
    announcement: AnnouncementCreate,
    current_user: dict = Depends(require_role("hod")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="HOD must be assigned to a department")

    new_id = await _next_id(db, "announcements")
    
    announcement_doc = {
        "id": new_id,
        "department": department,
        "message": announcement.message,
        "created_by": current_user.get("id"),
        "created_at": iso_ist(),
        "expires_at": announcement.expires_at,
    }
    
    # We pass a copy to insert_one because motor mutates the dict by appending an _id field
    await db.announcements.insert_one(announcement_doc.copy())
    
    return announcement_doc

@router.patch("/{announcement_id}/expire", response_model=AnnouncementOut)
async def expire_announcement(
    announcement_id: int,
    current_user: dict = Depends(require_role("hod")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="HOD must be assigned to a department")

    announcement = await db.announcements.find_one({"id": announcement_id})
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    if announcement.get("department") != department:
        raise HTTPException(status_code=403, detail="Not authorized to expire this announcement")

    expired_time = iso_ist()
    await db.announcements.update_one(
        {"id": announcement_id},
        {"$set": {"expires_at": expired_time}}
    )

    announcement["expires_at"] = expired_time
    announcement.pop("_id", None)
    
    return announcement
