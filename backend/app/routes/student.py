from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database.mongo import get_database
from ..dependencies import get_current_user
from ..models import ROLE_STUDENT
from ..schemas import AttendanceStats, StudentSelfAttendanceRequest, ClassSessionOut
from ..services.attendance_service import get_student_attendance_stats, mark_student_self_attendance, get_active_class_sessions


router = APIRouter(tags=["student"])


async def _require_student(current_user: dict = Depends(get_current_user)) -> dict:
    if (current_user.get("role") or "").lower() != ROLE_STUDENT:
        raise HTTPException(status_code=403, detail="Student access required.")
    return current_user


@router.get("/student/stats", response_model=AttendanceStats)
async def student_stats(current_user: dict = Depends(_require_student), db: AsyncIOMotorDatabase = Depends(get_database)):
    return await get_student_attendance_stats(db, current_user["id"])


@router.get("/student/sessions/active", response_model=list[ClassSessionOut])
async def student_active_sessions(
    current_user: dict = Depends(_require_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    enrolled_subjects = current_user.get("enrolled_subjects", [])
    if not department:
        raise HTTPException(status_code=400, detail="Student department not configured.")
    return await get_active_class_sessions(db, department, enrolled_subjects=enrolled_subjects)


@router.post("/student/attendance/self-mark")
async def self_mark_attendance(
    payload: StudentSelfAttendanceRequest,
    current_user: dict = Depends(_require_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        return await mark_student_self_attendance(
            db,
            student=current_user,
            session_id=payload.session_id,
            room_code=payload.room_code,
            image=payload.image,
            latitude=payload.latitude,
            longitude=payload.longitude,
            liveness_session_id=payload.liveness_session_id,
            liveness_frames=payload.liveness_frames
        )
    except Exception as e:
        import traceback
        with open("error_log.txt", "a") as f:
            f.write("ERROR IN SELF MARK:\n")
            traceback.print_exc(file=f)
        raise
