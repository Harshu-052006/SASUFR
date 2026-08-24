import csv
import io
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from google import genai
from google.genai import types
import json

from fastapi.responses import Response, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database.mongo import get_database
from ..dependencies import get_current_user
from ..models import ROLE_ADMIN
from ..schemas import AdminAccountCreate, AdminDeleteRequest, AdminResetPasswordRequest, AdminSetActiveRequest, AdminStats, AdminUserUpdateRequest, TeacherCreate, UserOut, WeeklyReport, PunctualityReport, UserStatusReport, AdminConfig, AdminConfigUpdate, FacultyAttendanceReport, MonitoringLocation, MonthlyAttendanceSummary, AdminBulkUpdateClassYearRequest
from ..services.attendance_service import get_admin_stats, serialize_attendance, get_recent_attendance_logs, get_attendance_report_rows, get_monthly_attendance_summary_rows
from ..services.email_service import send_password_changed
from ..services.security_service import log_security_event, get_security_logs
from ..services.user_service import create_teacher_user, delete_user, get_user_by_id, require_admin_password, reset_password, serialize_user, set_active_status, admin_update_user
from ..services.user_service import create_admin_user, get_user_by_email, create_registered_user
from ..services.report_service import generate_excel_report, generate_pdf_report
from ..utils.time import date_key, iso_ist, now_ist, get_campus_now, time_key
from ..utils.security import hash_password
from ..utils.roll_number import extract_roll_sequence
from ..config import settings

router = APIRouter(tags=["admin"])




def _is_admin(user: dict) -> bool:
    return bool(user.get("is_admin")) or (user.get("role") or "").lower() == ROLE_ADMIN


def _month_window(month: str | None) -> tuple[str, str]:
    month_value = month or now_ist().strftime("%Y-%m")
    try:
        month_start = datetime.strptime(month_value, "%Y-%m")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM.") from exc

    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)

    return month_start.strftime("%Y-%m-01"), next_month.strftime("%Y-%m-01")


async def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrative access required.")
    return current_user


@router.get("/admin/attendance/export")
async def export_admin_attendance(
    format: str = Query("excel", pattern="^(excel|pdf)$"),
    date: str | None = Query(None, pattern="^\d{4}-\d{2}-\d{2}$"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(_require_admin)
):
    report_date = date or date_key()
    records = await get_attendance_report_rows(db, report_date, report_date, None)
    if not records:
        raise HTTPException(status_code=404, detail="No attendance records found for this date.")
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if format == "excel":
        file_obj = generate_excel_report(records)
        return StreamingResponse(
            file_obj,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=system_attendance_{report_date}_{timestamp}.xlsx"}
        )
    else:
        title = f"System Attendance Report - {report_date}"
        file_obj = generate_pdf_report(records, title)
        return StreamingResponse(
            file_obj,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=system_attendance_{report_date}_{timestamp}.pdf"}
        )


@router.get("/admin/reports/export")
async def export_admin_report(
    format: str = Query("excel", pattern="^(excel|pdf)$"),
    from_date: str = Query(..., pattern="^\d{4}-\d{2}-\d{2}$"),
    to_date: str = Query(..., pattern="^\d{4}-\d{2}-\d{2}$"),
    scope: str = Query("custom", pattern="^(daily|weekly|monthly|yearly|custom)$"),
    department: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(_require_admin),
):
    records = await get_attendance_report_rows(db, from_date, to_date, department)
    if not records:
        raise HTTPException(status_code=404, detail="No attendance records found for the selected range.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dept_slug = (department or "all_departments").strip().lower().replace(" ", "_") or "all_departments"
    scope_slug = scope.lower()
    range_slug = f"{from_date}_to_{to_date}"

    if format == "excel":
        file_obj = generate_excel_report(records)
        return StreamingResponse(
            file_obj,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=admin_report_{dept_slug}_{scope_slug}_{range_slug}_{timestamp}.xlsx"},
        )

    title = f"Admin Attendance Report - {department or 'All Departments'} - {from_date} to {to_date}"
    file_obj = generate_pdf_report(records, title)
    return StreamingResponse(
        file_obj,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=admin_report_{dept_slug}_{scope_slug}_{range_slug}_{timestamp}.pdf"},
    )


@router.get("/admin/config", response_model=AdminConfig)
async def get_admin_config(current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    config_data = {
        "face_tolerance": settings.face_tolerance,
        "campus_lat": settings.campus_lat,
        "campus_lon": settings.campus_lon,
        "max_distance_km": settings.max_distance_km,
        "late_hour": settings.late_hour,
        "late_minute": settings.late_minute,
        "absent_notice_hour": settings.absent_notice_hour,
        "absent_notice_minute": settings.absent_notice_minute,
        "mfa_enabled": settings.mfa_enabled,
        "geofencing_enabled": settings.geofencing_enabled,
        "lockout_enabled": settings.lockout_enabled,
        "organization_type": "university"
    }
    
    doc = await db.config.find_one({"_id": "global"})
    if doc:
        doc.pop("_id", None)
        config_data.update(doc)
        
    return AdminConfig(**config_data)


@router.patch("/admin/config")
async def update_admin_config(payload: AdminConfigUpdate, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    update_data = payload.model_dump(exclude={"admin_password"}, exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No changes provided")
    await db.config.update_one({"_id": "global"}, {"$set": update_data}, upsert=True)
    await log_security_event(
        db,
        event_type="ADMIN_CONFIG_UPDATE",
        severity="warning",
        details="System configuration modified by administrator",
        admin_user_id=current_user["id"],
        metadata=update_data
    )
    return {"message": "System configuration updated successfully."}

@router.get("/admin/stats", response_model=AdminStats)
async def admin_stats(current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    data = await get_admin_stats(db)
    return AdminStats(**data)

@router.get("/admin/users", response_model=list[UserOut])
async def admin_users(current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    users: list[dict] = []
    cursor = db.users.find({}).sort("id", 1)
    async for user in cursor:
        users.append(serialize_user(user))
    return users


@router.get("/admin/logs")
async def admin_logs(limit: int = 10, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    logs = await get_recent_attendance_logs(db, limit)
    return logs


@router.get("/admin/security-logs")
async def admin_security_logs(limit: int = 20, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    logs = await get_security_logs(db, limit)
    return logs


@router.post("/admin/teachers")
async def admin_create_teacher(payload: TeacherCreate, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    existing_email = await db.users.find_one({"email": payload.email.lower().strip()})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    existing_roll = await db.users.find_one({"roll_number": payload.employee_id.strip()})
    if existing_roll:
        raise HTTPException(status_code=400, detail="Employee ID already registered")
    teacher = await create_teacher_user(db, payload)
    await log_security_event(
        db,
        event_type="ADMIN_CREATE_TEACHER",
        severity="info",
        details=f"Teacher created: {teacher['email']}",
        admin_user_id=current_user["id"],
        target_user_id=teacher["id"],
        ip_address=None,
        user_agent=None,
    )
    return {"message": "Faculty account created successfully.", "user": serialize_user(teacher)}


@router.post("/admin/accounts")
async def admin_create_account(payload: AdminAccountCreate, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    email = payload.email.lower().strip()
    if await get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")

    identifier = payload.identifier.strip()
    if await db.users.find_one({"roll_number": identifier}):
        raise HTTPException(status_code=400, detail="Identifier already registered")

    if payload.account_type == "admin":
        account = await create_admin_user(db, payload)
        event_type = "ADMIN_CREATE_ADMIN"
        details = f"Admin created: {account['email']}"
        message = "Administrator account created successfully."
    else:
        teacher_payload = TeacherCreate(
            admin_password=payload.admin_password,
            full_name=payload.full_name,
            email=payload.email,
            employee_id=identifier,
            department=payload.department,
            password=payload.password,
        )
        account = await create_teacher_user(db, teacher_payload)
        event_type = "ADMIN_CREATE_TEACHER"
        details = f"Faculty created: {account['email']}"
        message = "Faculty account created successfully."

    await log_security_event(
        db,
        event_type=event_type,
        severity="info",
        details=details,
        admin_user_id=current_user["id"],
        target_user_id=account["id"],
        ip_address=None,
        user_agent=None,
    )
    return {"message": message, "user": serialize_user(account)}


@router.patch("/admin/users/{user_id}")
async def admin_edit_user(user_id: int, payload: AdminUserUpdateRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found.")
    await admin_update_user(db, target, payload)
    await log_security_event(
        db,
        event_type="ADMIN_USER_UPDATE",
        severity="info",
        details=f"User updated: {target['email']}",
        admin_user_id=current_user["id"],
        target_user_id=target["id"],
        ip_address=None,
        user_agent=None,
    )
    return {"message": "Account details updated successfully."}


@router.post("/admin/users/{user_id}/set-active")
async def admin_set_active(user_id: int, payload: AdminSetActiveRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found.")
    if target.get("is_admin") and not payload.is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate an admin account")
    await set_active_status(db, user_id, payload.is_active)
    await log_security_event(
        db,
        event_type="ADMIN_SET_ACTIVE",
        severity="info",
        details=f"User {user_id} active={payload.is_active}",
        admin_user_id=current_user["id"],
        target_user_id=user_id,
        ip_address=None,
        user_agent=None,
    )
    return {"message": "Account status updated", "is_active": payload.is_active}


@router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: int, payload: AdminResetPasswordRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found.")
    await reset_password(db, target)
    await log_security_event(
        db,
        event_type="ADMIN_RESET_PASSWORD",
        severity="warning",
        details=f"Password reset for {target['email']}",
        admin_user_id=current_user["id"],
        target_user_id=target["id"],
        ip_address=None,
        user_agent=None,
    )
    return {"message": "Password reset successfully", "temporary_password": "SASUFR"}


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: int, payload: AdminDeleteRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    target = await get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found.")
    await delete_user(db, user_id)
    await log_security_event(
        db,
        event_type="ADMIN_DELETE_USER",
        severity="warning",
        details=f"Deleted user {target['email']}",
        admin_user_id=current_user["id"],
        target_user_id=target["id"],
        ip_address=None,
        user_agent=None,
    )
    return {"message": "Account deleted successfully."}


@router.get("/admin/reports/weekly")
async def admin_report_weekly(days: int = 6, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    labels: list[str] = []
    counts: list[int] = []
    for offset in range(days, -1, -1):
        day = (now_ist() - timedelta(days=offset)).date().isoformat()
        labels.append(day)
        counts.append(await db.attendance.count_documents({"date": day, "status": {"$in": ["Present", "Late"]}}))
    return WeeklyReport(labels=labels, counts=counts)


@router.get("/admin/reports/punctuality")
async def admin_report_punctuality(days: int = 7, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    since = (now_ist() - timedelta(days=days)).date().isoformat()
    on_time = await db.attendance.count_documents({"date": {"$gte": since}, "status": "Present"})
    late = await db.attendance.count_documents({"date": {"$gte": since}, "status": "Late"})
    absent = await db.attendance.count_documents({"date": {"$gte": since}, "status": "Absent"})
    return PunctualityReport(on_time=on_time, late=late, absent=absent)


@router.get("/admin/reports/users-status")
async def admin_report_users_status(current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    active = await db.users.count_documents({"is_active": True})
    inactive = await db.users.count_documents({"is_active": False})
    return UserStatusReport(active=active, inactive=inactive)


@router.get("/admin/reports/faculty", response_model=list[FacultyAttendanceReport])
async def admin_report_faculty(days: int = 30, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    since = (now_ist() - timedelta(days=days)).date().isoformat()
    teachers = await db.users.find({"role": "teacher"}).sort("full_name", 1).to_list(length=None)
    attendance_docs = await db.attendance.find({"date": {"$gte": since}}).to_list(length=None)

    total_days = len({doc.get("date") for doc in attendance_docs if doc.get("date")})
    day_map: dict[int, set[str]] = {}

    for doc in attendance_docs:
        marked_by_user_id = doc.get("marked_by_user_id")
        day_value = doc.get("date")
        if marked_by_user_id is None or not day_value:
            continue
        day_map.setdefault(int(marked_by_user_id), set()).add(str(day_value))

    result: list[dict] = []
    for teacher in teachers:
        covered_days = len(day_map.get(int(teacher["id"]), set()))
        percentage = round((covered_days / total_days * 100) if total_days else 0.0, 1)
        result.append({
            "id": teacher["id"],
            "full_name": teacher.get("full_name"),
            "department": teacher.get("department"),
            "attendance_percentage": percentage,
            "classes_attended": covered_days,
            "total_classes": total_days,
            "status": "ACTIVE" if teacher.get("is_active", True) else "INACTIVE",
        })

    result.sort(key=lambda item: (-item["attendance_percentage"], item["full_name"] or "", item["id"]))
    return [FacultyAttendanceReport(**row) for row in result[:10]]


@router.get("/admin/locations", response_model=list[MonitoringLocation])
async def admin_locations(current_user: dict = Depends(_require_admin)):
    return [
        MonitoringLocation(id=1, name="MAIN_CAMPUS", status="ACTIVE", lat=settings.campus_lat, lon=settings.campus_lon),
        MonitoringLocation(id=2, name="TECHNOLOGY_BLOCK", status="ACTIVE", lat=settings.campus_lat + 0.0008, lon=settings.campus_lon + 0.0008),
        MonitoringLocation(id=3, name="AUDITORIUM", status="IN_MAINTENANCE", lat=settings.campus_lat - 0.0006, lon=settings.campus_lon - 0.0006),
    ]


@router.get("/admin/reports/monthly-summary", response_model=list[MonthlyAttendanceSummary])
async def admin_report_monthly_summary(
    month: str | None = Query(None, pattern="^\d{4}-\d{2}$"),
    department: str | None = Query(None),
    current_user: dict = Depends(_require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await get_monthly_attendance_summary_rows(db, month, department)


@router.get("/admin/reports/attendance.csv")
async def admin_report_csv(days: int = 7, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    since = (now_ist() - timedelta(days=days)).date().isoformat()
    records = await db.attendance.find({"date": {"$gte": since}}).sort("date", -1).to_list(length=None)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "user_id", "date", "check_in", "status", "method", "marked_by_user_id"])
    for record in records:
        writer.writerow([
            record.get("id"),
            record.get("user_id"),
            record.get("date"),
            record.get("check_in"),
            record.get("status"),
            record.get("method"),
            record.get("marked_by_user_id"),
        ])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=attendance.csv"})

from pydantic import BaseModel
from fastapi import UploadFile, File

class ApprovalRequest(BaseModel):
    user_id: int
    admin_password: str

@router.get("/admin/pending_approvals")
async def admin_pending_approvals(current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    users: list[dict] = []
    cursor = db.users.find({"approval_status": "pending"}).sort("id", 1)
    async for user in cursor:
        users.append(serialize_user(user))
    return users

@router.post("/admin/approve")
async def admin_approve_user(payload: ApprovalRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    target = await get_user_by_id(db, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found.")
    await db.users.update_one(
        {"id": payload.user_id},
        {"$set": {"approval_status": "approved", "is_active": True, "updated_at": iso_ist()}}
    )
    return {"message": "User approved successfully"}

@router.post("/admin/reject")
async def admin_reject_user(payload: ApprovalRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    target = await get_user_by_id(db, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found.")
    await db.users.update_one(
        {"id": payload.user_id},
        {"$set": {"approval_status": "rejected", "is_active": False, "updated_at": iso_ist()}}
    )
    return {"message": "User rejected"}

@router.post("/admin/import_students")
async def admin_import_students(file: UploadFile = File(...), current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    content = await file.read()
    try:
        decoded = content.decode('utf-8', errors='ignore')
        reader = csv.DictReader(io.StringIO(decoded))
        
        valid_students = []
        direct_users = []
        max_id = -1
        max_roll_seq = -1
        
        for row in reader:
            # Normalize keys to lowercase and strip
            row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            
            # Map common column names
            email = row.get("email", "")
            roll_number = row.get("roll_number", "")
            full_name = row.get("full_name") or row.get("name", "")
            department = row.get("department", "")
            role = row.get("role", "student")
            password = row.get("password", "")
            
            # Use `id` if present, else None
            user_id_str = row.get("id", "")
            user_id = int(user_id_str) if user_id_str.isdigit() else None
            if user_id is not None and user_id > max_id:
                max_id = user_id
                
            if roll_number:
                seq_val = extract_roll_sequence(roll_number)
                if seq_val > max_roll_seq:
                    max_roll_seq = seq_val
            
            if not email:
                continue
                
            if password:
                is_admin_role = (role.lower() == "admin")
                is_teacher_role = (role.lower() == "teacher")
                
                # Direct user creation mode
                direct_users.append({
                    "id": user_id,
                    "email": email.lower(),
                    "roll_number": roll_number,
                    "full_name": full_name,
                    "department": department,
                    "role": role.lower(),
                    "hashed_password": hash_password(password),
                    "profile_picture": None,
                    "is_active": not is_teacher_role,
                    "is_verified": True,
                    "is_admin": is_admin_role,
                    "approval_status": "pending" if is_teacher_role else "approved",
                    "created_at": iso_ist(),
                    "updated_at": iso_ist()
                })
            elif roll_number:
                # Whitelist fallback mode
                valid_students.append({
                    "roll_number": roll_number, 
                    "email": email.lower(), 
                    "name": full_name,
                    "department": department,
                    "created_at": iso_ist()
                })
                
        # Insert direct users
        for u in direct_users:
            if u["id"] is None:
                # Fetch next sequence if ID is not provided
                from pymongo import ReturnDocument
                seq_doc = await db.counters.find_one_and_update(
                    {"_id": "users"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
                )
                u["id"] = int(seq_doc["seq"])
                
            if not u.get("roll_number"):
                from pymongo import ReturnDocument
                roll_seq = await db.counters.find_one_and_update(
                    {"_id": "roll_numbers"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
                )
                u["roll_number"] = f"STU-{int(roll_seq['seq']):05d}"
            
            await db.users.update_one({"email": u["email"]}, {"$set": u}, upsert=True)
            
        # Update counter if max_id was provided
        if max_id > -1:
            seq_doc = await db.counters.find_one({"_id": "users"})
            current_seq = int(seq_doc["seq"]) if seq_doc and "seq" in seq_doc else 0
            if max_id > current_seq:
                await db.counters.update_one({"_id": "users"}, {"$set": {"seq": max_id}}, upsert=True)
                
        # Update counter if max_roll_seq was found in manual inputs
        if max_roll_seq > -1:
            seq_doc = await db.counters.find_one({"_id": "roll_numbers"})
            current_roll_seq = int(seq_doc["seq"]) if seq_doc and "seq" in seq_doc else 0
            if max_roll_seq > current_roll_seq:
                await db.counters.update_one({"_id": "roll_numbers"}, {"$set": {"seq": max_roll_seq}}, upsert=True)
                
        # Insert valid students whitelist
        for s in valid_students:
            await db.valid_students.update_one({"email": s["email"]}, {"$set": s}, upsert=True)
            
        message = []
        if direct_users:
            message.append(f"{len(direct_users)} user accounts created directly")
        if valid_students:
            message.append(f"{len(valid_students)} students added to whitelist")
            
        if not message:
            message.append("No valid records found in CSV")
            
        return {"message": "Successfully imported. " + ", ".join(message)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")


@router.post("/admin/users/bulk-update-class-year")
async def admin_bulk_update_class_year(payload: AdminBulkUpdateClassYearRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    if not payload.roll_numbers:
        raise HTTPException(status_code=400, detail="No roll numbers provided.")
    
    result = await db.users.update_many(
        {"roll_number": {"$in": payload.roll_numbers}},
        {"$set": {"class_year": payload.class_year, "updated_at": iso_ist()}}
    )
    
    await log_security_event(
        db,
        event_type="ADMIN_BULK_UPDATE_CLASS_YEAR",
        severity="info",
        details=f"Updated class_year to {payload.class_year} for {result.modified_count} users.",
        admin_user_id=current_user["id"],
        metadata={"roll_numbers": payload.roll_numbers, "class_year": payload.class_year}
    )
    return {"message": f"Successfully updated class year for {result.modified_count} users."}


from ..schemas import TimetableCreate, TimetableOut, TimetableV2Create, TimetableV2Out
from ..services.timetable_service import check_timetable_conflicts

@router.post("/admin/timetables", response_model=TimetableOut)
async def create_timetable(payload: TimetableCreate, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    
    teacher = await get_user_by_id(db, payload.teacher_id)
    if not teacher or teacher.get("role") != "teacher":
        raise HTTPException(status_code=404, detail="Teacher not found.")
        
    from pymongo import ReturnDocument
    seq_doc = await db.counters.find_one_and_update(
        {"_id": "timetables"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    tt_id = int(seq_doc["seq"])
    
    doc = {
        "id": tt_id,
        "department": payload.department,
        "class_year": payload.class_year,
        "course_id": payload.course_id,
        "academic_year": payload.academic_year,
        "batch_id": payload.batch_id,
        "subject": payload.subject,
        "teacher_id": payload.teacher_id,
        "teacher_name": teacher.get("full_name") or teacher.get("email"),
        "day_of_week": payload.day_of_week,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "created_at": iso_ist()
    }
    
    await db.timetables.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/admin/timetables/v2", response_model=TimetableV2Out)
async def create_timetable_v2(payload: TimetableV2Create, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    # Validate conflicts
    allocations = [a.model_dump() for a in payload.allocations]
    is_valid, error_msg = await check_timetable_conflicts(
        db, payload.day_of_week, payload.start_time, payload.end_time, allocations
    )
    if not is_valid:
        raise HTTPException(status_code=409, detail=error_msg)
        
    import uuid
    tt_id = str(uuid.uuid4())
    
    # Populate teacher names
    for alloc in allocations:
        t = await db.users.find_one({"id": alloc["teacher_id"], "role": "teacher"})
        if t:
            alloc["teacher_name"] = t.get("full_name") or t.get("email")
            
    doc = {
        "id": tt_id,
        "department_id": payload.department_id,
        "course_id": payload.course_id,
        "academic_year": payload.academic_year,
        "day_of_week": payload.day_of_week,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "slot_type": payload.slot_type,
        "allocations": allocations,
        "created_at": iso_ist()
    }
    
    await db.timetables_v2.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.get("/admin/timetables/v2/weekly")
async def get_weekly_timetable_v2(
    department_id: str = Query(...), 
    course_id: str = Query(...), 
    academic_year: str = Query(...), 
    current_user: dict = Depends(_require_admin), 
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    cursor = db.timetables_v2.find({
        "department_id": department_id,
        "course_id": course_id,
        "academic_year": academic_year
    }).sort([("day_of_week", 1), ("start_time", 1)])
    
    schedule = {day: [] for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
    async for tt in cursor:
        tt.pop("_id", None)
        day = tt.get("day_of_week")
        if day in schedule:
            schedule[day].append(tt)
            
    return {
        "department_id": department_id,
        "course_id": course_id,
        "academic_year": academic_year,
        "schedule": {day: slots for day, slots in schedule.items() if slots}
    }


@router.get("/admin/timetables", response_model=list[TimetableOut])
async def get_timetables(current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.timetables.find({}).sort([("department", 1), ("class_year", 1), ("day_of_week", 1), ("start_time", 1)])
    results = []
    async for tt in cursor:
        tt.pop("_id", None)
        results.append(tt)
    return results


@router.delete("/admin/timetables/{tt_id}")
async def delete_timetable(tt_id: int, payload: AdminDeleteRequest, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    await require_admin_password(current_user, payload.admin_password)
    result = await db.timetables.delete_one({"id": tt_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found.")
    return {"message": "Timetable deleted successfully."}

@router.post("/admin/timetables/import")
async def import_timetables(
    file: UploadFile = File(...),
    department: str = Form(...),
    current_user: dict = Depends(_require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    content = await file.read()
    try:
        decoded = content.decode('utf-8', errors='ignore')
        reader = csv.DictReader(io.StringIO(decoded))
        
        inserted_count = 0
        from pymongo import ReturnDocument
        
        for row in reader:
            row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            
            subject = row.get("subject", "")
            if not subject:
                continue
                
            teacher_email = row.get("teacher_email", "")
            teacher_id = 0
            teacher_name = ""
            if teacher_email:
                t = await db.users.find_one({"email": teacher_email.lower(), "role": "teacher"})
                if t:
                    teacher_id = t["id"]
                    teacher_name = t.get("full_name") or t.get("email")
            
            seq_doc = await db.counters.find_one_and_update(
                {"_id": "timetables"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
            )
            tt_id = int(seq_doc["seq"])
            
            tt_doc = {
                "id": tt_id,
                "department": department,
                "class_year": row.get("class_year", ""),
                "course_id": row.get("course_id", ""),
                "academic_year": row.get("academic_year", ""),
                "batch_id": row.get("batch_id", "") or row.get("section", ""),
                "subject": subject,
                "teacher_id": teacher_id,
                "teacher_name": teacher_name,
                "day_of_week": row.get("day_of_week", "").capitalize(),
                "start_time": row.get("start_time", ""),
                "end_time": row.get("end_time", ""),
                "created_at": iso_ist(),
                "created_by": current_user["id"]
            }
            
            await db.timetables.insert_one(tt_doc)
            inserted_count += 1
            
        return {"message": f"Successfully imported {inserted_count} timetable records."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")


@router.post("/admin/timetables/extract-image")
async def extract_timetables_from_image(
    image: UploadFile = File(...),
    admin_password: str = Form(...),
    department: str | None = Form(None),
    class_year: str | None = Form(None),
    current_user: dict = Depends(_require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    await require_admin_password(current_user, admin_password)
    
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")
        
    try:
        image_bytes = await image.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read image: {str(e)}")
        
    # Initialize the Gemini client
    client = genai.Client(api_key=settings.gemini_api_key)
    
    prompt = """
    You are an AI assistant tasked with extracting structured timetable data from the provided image.
    Analyze the image and return a JSON array containing the scheduled classes.
    For each class, extract the following keys exactly:
    - "department": The department or program (e.g., "Computer Science", "BCA"). If not stated, infer from context or leave empty.
    - "class_year": The class or year (e.g., "TY-BCA", "Year 3", "Div A"). If not stated, infer or leave empty.
    - "subject": The name of the subject or course.
    - "teacher_name": The name of the teacher/faculty if mentioned. If not, leave empty.
    - "day_of_week": The day of the week (e.g., "Monday", "Tuesday").
    - "start_time": The start time in 24-hour HH:MM format (e.g., "09:00", "14:30").
    - "end_time": The end time in 24-hour HH:MM format (e.g., "10:00", "16:00").
    
    Your response MUST be a valid JSON array of objects. Do not include any markdown formatting (like ```json), just the raw JSON text.
    If you cannot extract any timetable data, return an empty array [].
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=image.content_type),
                prompt
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")
        
    text = response.text.strip()
    
    # Clean up markdown formatting if the model still includes it
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    
    try:
        extracted_data = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response as JSON. Response was: {text[:100]}...")
        
    if not isinstance(extracted_data, list):
        raise HTTPException(status_code=500, detail="AI response is not a JSON array.")
        
    inserted_count = 0
    # Process and insert each extracted schedule
    for item in extracted_data:
        # Require minimal valid data
        if not item.get("subject") or not item.get("day_of_week") or not item.get("start_time") or not item.get("end_time"):
            continue
            
        # Try to resolve teacher_id by teacher_name
        teacher_name = item.get("teacher_name", "")
        teacher_id = 0
        if teacher_name:
            # We can try a regex search for the teacher by full_name
            # But simpler is to fetch all teachers and do a fuzzy or exact substring match
            teachers = await db.users.find({"role": "teacher"}).to_list(None)
            for t in teachers:
                if t.get("full_name") and (t["full_name"].lower() in teacher_name.lower() or teacher_name.lower() in t["full_name"].lower()):
                    teacher_id = t["id"]
                    break
        
        # Build document
        from pymongo import ReturnDocument
        seq_doc = await db.counters.find_one_and_update(
            {"_id": "timetables"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        tt_id = int(seq_doc["seq"])

        tt_doc = {
            "id": tt_id,
            "department": department if department else item.get("department", "Default"),
            "class_year": class_year if class_year else item.get("class_year", "Default"),
            "subject": item.get("subject"),
            "teacher_id": teacher_id,
            "teacher_name": teacher_name,
            "day_of_week": item.get("day_of_week").capitalize(),
            "start_time": item.get("start_time"),
            "end_time": item.get("end_time"),
            "created_at": iso_ist(),
            "created_by": current_user["id"]
        }
        
        await db.timetables.insert_one(tt_doc)
        inserted_count += 1
        
    return {"message": "Success", "count": inserted_count, "data": extracted_data}
