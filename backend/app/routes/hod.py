from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database.mongo import get_database, next_sequence
from app.dependencies import require_role, get_current_user
from app.schemas import AnnouncementCreate, AnnouncementOut
from app.services.attendance_service import _next_id
from app.utils.time import now_ist, iso_ist, date_key

router = APIRouter(prefix="/hod", tags=["HOD"])


class HODAnnouncementCreate(BaseModel):
    message: str
    title: Optional[str] = "Department Notice"
    priority: Optional[str] = "Normal"  # Normal, Urgent, Exam, Event
    duration_hours: Optional[int] = 24
    expires_at: Optional[str] = None


def _get_dept_regex(department: str) -> str:
    cleaned = department.strip().rstrip("sS")
    return f"(?i)^{re.escape(cleaned)}s?$"


@router.get("/stats")
async def get_hod_dashboard_stats(
    department: Optional[str] = Query(None),
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    target_dept = current_user.get("department") or department
    if not target_dept and current_user.get("is_admin"):
        # Admin can view default or first available department
        first_teacher = await db.users.find_one({"role": {"$in": ["teacher", "hod"]}, "department": {"$ne": None}})
        target_dept = first_teacher.get("department") if first_teacher else "Computer Application"

    if not target_dept:
        raise HTTPException(status_code=400, detail="HOD department is not specified.")

    dept_regex = _get_dept_regex(target_dept)

    # 1. Total Faculty in department
    faculty_count = await db.users.count_documents({
        "role": {"$in": ["teacher", "hod"]},
        "department": {"$regex": dept_regex}
    })

    # 2. Total Enrolled Students
    student_count = await db.users.count_documents({
        "role": "student",
        "department": {"$regex": dept_regex}
    })

    # 3. Active Sessions right now
    active_sessions_cursor = db.class_sessions.find({
        "status": "active",
        "department": {"$regex": dept_regex}
    })
    active_sessions = await active_sessions_cursor.to_list(length=10)

    # 4. Total sessions conducted (all time or recent)
    total_sessions_count = await db.class_sessions.count_documents({
        "department": {"$regex": dept_regex}
    })

    # 5. Department Attendance Rate (%)
    total_records = await db.attendance.count_documents({
        "user_department": {"$regex": dept_regex}
    })
    present_records = await db.attendance.count_documents({
        "user_department": {"$regex": dept_regex},
        "status": "Present"
    })
    attendance_rate = round((present_records / total_records * 100), 1) if total_records > 0 else 0.0

    # 6. Active Department Announcements count
    current_time = iso_ist()
    active_announcements_count = await db.announcements.count_documents({
        "$or": [
            {"department": {"$regex": dept_regex}},
            {"department": "All"}
        ],
        "expires_at": {"$gt": current_time}
    })

    # 7. Defaulters count (attendance < 75%)
    # Quick computation for students in department
    students = await db.users.find({
        "role": "student",
        "department": {"$regex": dept_regex}
    }).to_list(length=100)

    defaulters_count = 0
    if total_sessions_count > 0:
        for s in students:
            stu_present = await db.attendance.count_documents({
                "user_id": s["id"],
                "status": "Present"
            })
            rate = (stu_present / total_sessions_count) * 100
            if rate < 75.0:
                defaulters_count += 1

    return {
        "department": target_dept,
        "hod_name": current_user.get("full_name") or current_user.get("email"),
        "total_faculty": faculty_count,
        "total_students": student_count,
        "active_sessions_count": len(active_sessions),
        "total_sessions_conducted": total_sessions_count,
        "department_attendance_rate": attendance_rate,
        "active_announcements_count": active_announcements_count,
        "defaulters_count": defaulters_count,
    }


@router.get("/live-sessions")
async def get_hod_live_sessions(
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    target_dept = current_user.get("department")
    if not target_dept:
        raise HTTPException(status_code=400, detail="Department is required.")

    dept_regex = _get_dept_regex(target_dept)
    cursor = db.class_sessions.find({
        "status": "active",
        "department": {"$regex": dept_regex}
    }).sort("start_time", -1)

    sessions = await cursor.to_list(length=20)
    enriched = []
    for s in sessions:
        s.pop("_id", None)
        present_count = await db.attendance.count_documents({
            "session_id": s["id"],
            "status": "Present"
        })
        s["present_count"] = present_count
        enriched.append(s)

    return enriched


@router.get("/faculty")
async def get_hod_faculty(
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    target_dept = current_user.get("department")
    if not target_dept:
        raise HTTPException(status_code=400, detail="Department is required.")

    dept_regex = _get_dept_regex(target_dept)
    cursor = db.users.find({
        "role": {"$in": ["teacher", "hod"]},
        "department": {"$regex": dept_regex}
    }).sort("full_name", 1)

    faculty_list = await cursor.to_list(length=100)
    result = []
    for f in faculty_list:
        sessions_taken = await db.class_sessions.count_documents({"teacher_id": f["id"]})
        result.append({
            "id": f["id"],
            "full_name": f.get("full_name"),
            "email": f.get("email"),
            "designation": f.get("designation") or ("HOD" if f.get("role") == "hod" else "Faculty"),
            "role": f.get("role"),
            "department": f.get("department"),
            "is_active": f.get("is_active", True),
            "sessions_conducted": sessions_taken,
        })
    return result


@router.get("/students")
async def get_hod_students(
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    target_dept = current_user.get("department")
    if not target_dept:
        raise HTTPException(status_code=400, detail="Department is required.")

    dept_regex = _get_dept_regex(target_dept)
    total_dept_sessions = await db.class_sessions.count_documents({"department": {"$regex": dept_regex}})

    cursor = db.users.find({
        "role": "student",
        "department": {"$regex": dept_regex}
    }).sort("roll_number", 1)

    students = await cursor.to_list(length=200)
    result = []
    for s in students:
        attended = await db.attendance.count_documents({
            "user_id": s["id"],
            "status": "Present"
        })
        rate = round((attended / total_dept_sessions * 100), 1) if total_dept_sessions > 0 else 100.0
        result.append({
            "id": s["id"],
            "roll_number": s.get("roll_number", "N/A"),
            "full_name": s.get("full_name"),
            "email": s.get("email"),
            "department": s.get("department"),
            "program": s.get("program"),
            "total_sessions": total_dept_sessions,
            "attended_sessions": attended,
            "attendance_rate": rate,
            "status": "Good" if rate >= 75 else ("Warning" if rate >= 60 else "Critical")
        })
    return result


@router.get("/announcements")
async def list_hod_announcements(
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    target_dept = current_user.get("department")
    if not target_dept:
        raise HTTPException(status_code=400, detail="Department is required.")

    dept_regex = _get_dept_regex(target_dept)
    cursor = db.announcements.find({
        "$or": [
            {"department": {"$regex": dept_regex}},
            {"department": "All"},
            {"department": None}
        ]
    }).sort("created_at", -1)

    announcements = await cursor.to_list(length=50)
    current_time = iso_ist()
    for ann in announcements:
        ann.pop("_id", None)
        ann["is_active"] = ann.get("expires_at", "") > current_time
    return announcements


@router.post("/announcements", response_model=AnnouncementOut)
async def create_announcement(
    announcement: AnnouncementCreate,
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="HOD must be assigned to a department")

    new_id = await _next_id(db, "announcements")
    
    expires_at = announcement.expires_at
    if not expires_at:
        duration = getattr(announcement, "duration_hours", 24) or 24
        expires_at = (now_ist() + timedelta(hours=duration)).isoformat()

    title = getattr(announcement, "title", "Department Notice") or "Department Notice"

    announcement_doc = {
        "id": new_id,
        "title": title,
        "department": department,
        "message": announcement.message,
        "created_by": current_user.get("full_name") or current_user.get("id"),
        "created_at": iso_ist(),
        "expires_at": expires_at,
    }
    
    # We pass a copy to insert_one because motor mutates the dict by appending an _id field
    await db.announcements.insert_one(announcement_doc.copy())
    
    return announcement_doc


@router.patch("/announcements/{announcement_id}/expire", response_model=AnnouncementOut)
async def expire_announcement(
    announcement_id: int,
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    if not department and not current_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="HOD must be assigned to a department")

    announcement = await db.announcements.find_one({"id": announcement_id})
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    if not current_user.get("is_admin") and announcement.get("department") != department:
        raise HTTPException(status_code=403, detail="Not authorized to expire this announcement")

    expired_time = iso_ist()
    await db.announcements.update_one(
        {"id": announcement_id},
        {"$set": {"expires_at": expired_time}}
    )

    announcement["expires_at"] = expired_time
    announcement.pop("_id", None)
    
    return announcement


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    query = {"id": announcement_id}
    if not current_user.get("is_admin"):
        query["department"] = department

    result = await db.announcements.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found or not authorized.")

    return {"message": "Announcement deleted successfully"}


@router.get("/departments-status")
async def get_departments_hod_status(
    current_user: dict = Depends(require_role("hod", "admin")),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Fetch all institution departments from config or existing users
    config_doc = await db.config.find_one({"_id": "global"})
    known_depts = [
        "Computer Science",
        "Electronics & Communication",
        "Mechanical Engineering",
        "Computer Applications"
    ]
    if config_doc and "departments" in config_doc:
        known_depts = list(dict.fromkeys(known_depts + config_doc["departments"]))

    user_depts = await db.users.distinct("department", {"department": {"$ne": None}})
    all_depts_raw = list(dict.fromkeys(known_depts + [d for d in user_depts if d]))

    # Deduplicate departments with similar regex patterns (e.g. Computer Application vs Computer Applications)
    seen_patterns = set()
    all_depts = []
    for d in all_depts_raw:
        reg = _get_dept_regex(d)
        if reg not in seen_patterns:
            seen_patterns.add(reg)
            all_depts.append(d)

    status_list = []
    for dept in all_depts:
        dept_regex = _get_dept_regex(dept)
        hod_user = await db.users.find_one({
            "role": "hod",
            "department": {"$regex": dept_regex},
            "is_active": True
        })
        faculty_count = await db.users.count_documents({
            "role": {"$in": ["teacher", "hod"]},
            "department": {"$regex": dept_regex}
        })
        student_count = await db.users.count_documents({
            "role": "student",
            "department": {"$regex": dept_regex}
        })

        status_list.append({
            "department": dept,
            "has_hod": bool(hod_user),
            "hod": {
                "id": hod_user["id"],
                "full_name": hod_user.get("full_name"),
                "email": hod_user.get("email"),
                "roll_number": hod_user.get("roll_number")
            } if hod_user else None,
            "faculty_count": faculty_count,
            "student_count": student_count,
            "status": "Assigned" if hod_user else "Vacant (No HOD)"
        })

    return status_list
