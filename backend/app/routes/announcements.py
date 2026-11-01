from __future__ import annotations

from typing import List, Optional
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongo import get_database, next_sequence
from app.dependencies import get_current_user
from app.schemas import AnnouncementOut, AnnouncementCreate
from app.models import ROLE_ADMIN, ROLE_TEACHER
from app.utils.time import iso_ist, now_ist

router = APIRouter(prefix="/announcements", tags=["Announcements"])


@router.get("/active", response_model=List[AnnouncementOut])
async def get_active_announcements(
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    target_dept = department or (current_user.get("department") if current_user else None)

    current_time = iso_ist()
    query: dict = {"expires_at": {"$gt": current_time}}
    if target_dept:
        query["$or"] = [{"department": target_dept}, {"department": "All"}, {"department": None}]

    cursor = db.announcements.find(query).sort("created_at", -1)
    announcements = await cursor.to_list(length=20)
    for ann in announcements:
        ann.pop("_id", None)
    return announcements


@router.get("", response_model=List[AnnouncementOut])
async def list_announcements(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    user_role = (current_user.get("role") or "").lower()
    query: dict = {}
    if user_role not in (ROLE_ADMIN, "admin"):
        dept = current_user.get("department")
        if dept:
            query["$or"] = [{"department": dept}, {"department": None}, {"department": "All"}]

    cursor = db.announcements.find(query).sort("created_at", -1).limit(50)
    results = await cursor.to_list(length=50)
    for doc in results:
        doc.pop("_id", None)
    return results


@router.post("", response_model=AnnouncementOut)
async def create_announcement(
    payload: AnnouncementCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    if role not in (ROLE_ADMIN, "admin", ROLE_TEACHER, "teacher", "hod"):
        raise HTTPException(status_code=403, detail="Only faculty and administrators can broadcast announcements.")

    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Announcement message cannot be empty.")

    dept = payload.department or current_user.get("department") or "All"
    announcement_id = await next_sequence("announcements")
    expires_at = payload.expires_at or (now_ist() + timedelta(hours=max(1, payload.duration_hours))).isoformat()

    doc = {
        "id": announcement_id,
        "title": payload.title.strip() if payload.title else "Important Announcement",
        "message": payload.message.strip(),
        "department": dept,
        "created_by": current_user.get("full_name") or current_user.get("email") or current_user.get("id"),
        "created_at": iso_ist(),
        "expires_at": expires_at,
    }

    await db.announcements.insert_one(doc.copy())
    return doc


@router.delete("/{announcement_id}")
async def expire_announcement(
    announcement_id: int,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    query: dict = {"id": announcement_id}
    if role not in (ROLE_ADMIN, "admin"):
        dept = current_user.get("department")
        if dept:
            query["department"] = dept

    res = await db.announcements.update_one(query, {"$set": {"expires_at": iso_ist()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found or unauthorized to delete.")

    return {"message": "Announcement expired successfully"}
