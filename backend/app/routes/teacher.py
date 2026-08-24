from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database.mongo import get_database
from ..dependencies import get_current_user
from ..utils.time import date_key
from ..models import ROLE_TEACHER
from ..schemas import TeacherStats, TeacherAttendanceRow, MarkAttendanceRequest, ManualAttendanceRequest, UserOut, ClassSessionCreate, ClassSessionOut, ProfileChangeRequestCreate, ProfileChangeRequestOut
from ..services.profile_request_service import submit_profile_change_request, get_teacher_change_requests
from ..services.attendance_service import (
    get_teacher_stats, 
    get_teacher_today_rows, 
    send_absent_notifications,
    get_teacher_department_students,
    mark_attendance_by_face,
    mark_attendance_manual,
    get_attendance_report_rows,
    start_class_session,
    get_active_class_sessions
)
from ..services.report_service import generate_excel_report, generate_pdf_report


router = APIRouter(tags=["teacher"])


async def _require_teacher(current_user: dict = Depends(get_current_user)) -> dict:
    if (current_user.get("role") or "").lower() != ROLE_TEACHER:
        raise HTTPException(status_code=403, detail="Faculty access required.")
    return current_user


@router.get("/teacher/dashboard-stats", response_model=TeacherStats)
async def teacher_stats(current_user: dict = Depends(_require_teacher), db: AsyncIOMotorDatabase = Depends(get_database)):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")
    return await get_teacher_stats(db, current_user)


@router.post("/teacher/profile/change-requests", response_model=ProfileChangeRequestOut)
async def submit_profile_change(
    payload: ProfileChangeRequestCreate,
    current_user: dict = Depends(_require_teacher),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    return await submit_profile_change_request(db, current_user, payload)


@router.get("/teacher/profile/change-requests", response_model=list[ProfileChangeRequestOut])
async def list_my_profile_changes(
    current_user: dict = Depends(_require_teacher),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    return await get_teacher_change_requests(db, current_user["id"])


@router.get("/teacher/department/stats", response_model=TeacherStats)
async def teacher_dept_stats(current_user: dict = Depends(_require_teacher), db: AsyncIOMotorDatabase = Depends(get_database)):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")
    return await get_teacher_stats(db, current_user)


@router.get("/teacher/attendance/today", response_model=list[TeacherAttendanceRow])
async def teacher_today_attendance(current_user: dict = Depends(_require_teacher), db: AsyncIOMotorDatabase = Depends(get_database)):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")
    return await get_teacher_today_rows(db, current_user)


@router.post("/teacher/notifications/absent")
async def teacher_notify_absent(current_user: dict = Depends(_require_teacher), db: AsyncIOMotorDatabase = Depends(get_database)):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")

    result = await send_absent_notifications(db, current_user)
    if result.get("status") == "failed":
        raise HTTPException(status_code=503, detail=result.get("message") or "Failed to send absent notifications.")
    return {"message": "Email sent", "success": True}


@router.post("/teacher/sessions/v2/start")
async def start_session_v2(
    timetable_slot_id: str,
    subject: str,
    room_id: str,
    target_group_type: str,
    target_group_id: str,
    current_user: dict = Depends(_require_teacher),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    import uuid
    from app.utils.time import iso_ist
    from app.services.email_service import send_lecture_commenced_notice
    import asyncio
    
    session_id = str(uuid.uuid4())
    doc = {
        "id": session_id,
        "timetable_slot_id": timetable_slot_id,
        "teacher_id": current_user["id"],
        "subject": subject,
        "room_id": room_id,
        "target_group_type": target_group_type,
        "target_group_id": target_group_id,
        "actual_start_time": iso_ist(),
        "status": "ONGOING"
    }
    
    await db.session_logs.insert_one(doc)
    doc.pop("_id", None)
    
    # Notify students asynchronously based on the target group
    async def notify_students():
        query = {"role": "student"}
        if target_group_type == "BATCH":
            query["batch_id"] = target_group_id
        elif target_group_type == "SUB_BATCH":
            query["sub_batch_id"] = target_group_id
        elif target_group_type == "ELECTIVE":
            query["elective_group_ids"] = target_group_id
            
        students = await db.users.find(query).to_list(length=None)
        class_details = f"{target_group_type} {target_group_id}"
            
        for student in students:
            if student.get("email"):
                await send_lecture_commenced_notice(
                    email=student["email"],
                    student_name=student.get("full_name"),
                    subject=subject,
                    class_details=class_details,
                    teacher_name=current_user.get("full_name") or current_user.get("email")
                )
    
    asyncio.create_task(notify_students())
    return doc

@router.post("/teacher/sessions/v2/{session_id}/end")
async def end_session_v2(
    session_id: str,
    current_user: dict = Depends(_require_teacher),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    from app.utils.time import iso_ist
    
    doc = await db.session_logs.find_one({"id": session_id, "teacher_id": current_user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found or unauthorized")
        
    if doc.get("status") == "COMPLETED":
        raise HTTPException(status_code=400, detail="Session already ended")
        
    update_data = {
        "actual_end_time": iso_ist(),
        "status": "COMPLETED"
    }
    
    await db.session_logs.update_one({"id": session_id}, {"$set": update_data})
    
    doc.update(update_data)
    doc.pop("_id", None)
    return doc


@router.get("/teacher/department/students", response_model=list[UserOut])
async def get_my_students(
    unmarked_only: bool = Query(False),
    current_user: dict = Depends(_require_teacher), 
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")
    return await get_teacher_department_students(db, current_user, unmarked_only=unmarked_only)


@router.post("/teacher/sessions/start", response_model=ClassSessionOut)
async def start_session(
    payload: ClassSessionCreate,
    current_user: dict = Depends(_require_teacher),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    if not current_user.get("department"):
        raise HTTPException(status_code=400, detail="Faculty department not configured.")
    return await start_class_session(
        db, 
        teacher=current_user, 
        subject=payload.subject, 
        class_name=payload.class_name, 
        department=payload.department,
        course_id=payload.course_id,
        academic_year=payload.academic_year,
        batch_id=payload.batch_id,
        lecture_start_time=payload.lecture_start_time,
        lecture_end_time=payload.lecture_end_time
    )


@router.get("/teacher/sessions/active", response_model=list[ClassSessionOut])
async def active_sessions(
    current_user: dict = Depends(_require_teacher),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")
    return await get_active_class_sessions(db, department)


@router.post("/teacher/mark-attendance")
async def mark_face_attendance(
    payload: MarkAttendanceRequest, 
    current_user: dict = Depends(_require_teacher), 
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    return await mark_attendance_by_face(
        db, 
        teacher=current_user, 
        image=payload.image, 
        latitude=payload.latitude, 
        longitude=payload.longitude,
        liveness_challenge=payload.liveness_challenge
    )


@router.post("/teacher/mark-attendance/manual/{student_id}")
async def mark_manual_attendance(
    student_id: int,
    payload: ManualAttendanceRequest,
    current_user: dict = Depends(_require_teacher),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    return await mark_attendance_manual(
        db,
        teacher=current_user,
        student_id=student_id,
        status=payload.status,
        latitude=payload.latitude,
        longitude=payload.longitude
    )


@router.get("/teacher/attendance/export")
async def export_teacher_attendance(
    format: str = Query("excel", pattern="^(excel|pdf)$"),
    db: AsyncIOMotorDatabase = Depends(get_database), 
    current_user: dict = Depends(_require_teacher)
):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")
    report_date = date_key()
    records = await get_attendance_report_rows(db, report_date, report_date, department)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dept_slug = department.lower().replace(" ", "_")
    
    if format == "excel":
        file_obj = generate_excel_report(records)
        return StreamingResponse(
            file_obj, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
            headers={"Content-Disposition": f"attachment; filename=attendance_{dept_slug}_{timestamp}.xlsx"}
        )
    else:
        title = f"Attendance Report - {department} - {datetime.now().strftime('%Y-%m-%d')}"
        file_obj = generate_pdf_report(records, title)
        return StreamingResponse(
            file_obj, 
            media_type="application/pdf", 
            headers={"Content-Disposition": f"attachment; filename=attendance_{dept_slug}_{timestamp}.pdf"}
        )


@router.get("/teacher/reports/export")
async def export_teacher_report(
    format: str = Query("excel", pattern="^(excel|pdf)$"),
    from_date: str = Query(..., pattern="^\d{4}-\d{2}-\d{2}$"),
    to_date: str = Query(..., pattern="^\d{4}-\d{2}-\d{2}$"),
    scope: str = Query("custom", pattern="^(daily|weekly|monthly|yearly|custom)$"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(_require_teacher),
):
    department = current_user.get("department")
    if not department:
        raise HTTPException(status_code=400, detail="Faculty department not configured.")

    records = await get_attendance_report_rows(db, from_date, to_date, department)
    if not records:
        raise HTTPException(status_code=404, detail="No attendance records found for the selected range.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dept_slug = department.lower().replace(" ", "_")
    scope_slug = scope.lower()
    range_slug = f"{from_date}_to_{to_date}"

    if format == "excel":
        file_obj = generate_excel_report(records)
        return StreamingResponse(
            file_obj,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=teacher_report_{dept_slug}_{scope_slug}_{range_slug}_{timestamp}.xlsx"},
        )

    title = f"Teacher Attendance Report - {department} - {from_date} to {to_date}"
    file_obj = generate_pdf_report(records, title)
    return StreamingResponse(
        file_obj,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=teacher_report_{dept_slug}_{scope_slug}_{range_slug}_{timestamp}.pdf"},
    )
