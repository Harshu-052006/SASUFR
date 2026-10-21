from __future__ import annotations

from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from ..database.mongo import get_database, next_sequence
from ..dependencies import get_current_user
from ..models import ROLE_ADMIN, ROLE_TEACHER
from ..utils.time import iso_ist, now_ist

router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementCreate(BaseModel):
    title: Optional[str] = "Important Announcement"
    message: str
    department: Optional[str] = None
    duration_hours: int = 24


def serialize_announcement(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


@router.get("/active")
async def get_active_announcements(
    department: Optional[str] = Query(None),
    request: Request = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    now_str = iso_ist()
    query: dict = {
        "is_active": True,
        "expires_at": {"$gt": now_str},
    }

    # If department is provided as query param, filter for that department or All
    if department:
        query["$or"] = [{"department": department}, {"department": None}, {"department": "All"}]

    cursor = db.announcements.find(query).sort("created_at", -1).limit(10)
    announcements = []
    async for doc in cursor:
        announcements.append(serialize_announcement(doc))

    return announcements


@router.get("")
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
    results = []
    async for doc in cursor:
        results.append(serialize_announcement(doc))
    return results


@router.post("")
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
    expires_at = (now_ist() + timedelta(hours=max(1, payload.duration_hours))).isoformat()

    doc = {
        "id": announcement_id,
        "title": payload.title.strip() if payload.title else "Important Announcement",
        "message": payload.message.strip(),
        "department": dept,
        "created_by": current_user.get("full_name") or current_user.get("email"),
        "created_by_id": current_user.get("id"),
        "created_at": iso_ist(),
        "expires_at": expires_at,
        "is_active": True,
    }

    await db.announcements.insert_one(doc)
    return {"message": "Announcement broadcast successfully", "announcement": serialize_announcement(doc)}


@router.delete("/{announcement_id}")
async def expire_announcement(
    announcement_id: int,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    query: dict = {"id": announcement_id}
    if role not in (ROLE_ADMIN, "admin"):
        # Teachers can only expire their own
        query["created_by_id"] = current_user.get("id")

    res = await db.announcements.update_one(query, {"$set": {"is_active": False, "updated_at": iso_ist()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found or unauthorized to delete.")

    return {"message": "Announcement expired successfully"}
