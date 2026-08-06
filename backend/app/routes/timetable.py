from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

from ..database.mongo import get_database
from ..dependencies import get_current_user

router = APIRouter(tags=["timetable"])

async def _resolve_v2_schedule_for_student(db: AsyncIOMotorDatabase, current_user: dict, day_name: str | None = None) -> list[dict]:
    query = {
        "course_id": current_user.get("course_id"),
        "academic_year": current_user.get("academic_year")
    }
    if day_name:
        query["day_of_week"] = day_name
        
    cursor = db.timetables_v2.find(query).sort([("day_of_week", 1), ("start_time", 1)])
    
    student_batch = current_user.get("batch_id")
    student_sub_batch = current_user.get("sub_batch_id") # Future-proofing
    student_electives = current_user.get("elective_group_ids", [])
    
    results = []
    async for tt in cursor:
        tt.pop("_id", None)
        
        # Filter allocations that apply to this student
        matched_allocations = []
        for alloc in tt.get("allocations", []):
            if alloc.get("batch_id") and alloc.get("batch_id") == student_batch:
                matched_allocations.append(alloc)
            elif alloc.get("sub_batch_id") and alloc.get("sub_batch_id") == student_sub_batch:
                matched_allocations.append(alloc)
            elif alloc.get("elective_group_id") and alloc.get("elective_group_id") in student_electives:
                matched_allocations.append(alloc)
                
        if matched_allocations:
            # Flatten it for the frontend (just take the first matched allocation)
            alloc = matched_allocations[0]
            resolved_tt = {
                "id": tt["id"],
                "department_id": tt["department_id"],
                "course_id": tt["course_id"],
                "academic_year": tt["academic_year"],
                "day_of_week": tt["day_of_week"],
                "start_time": tt["start_time"],
                "end_time": tt["end_time"],
                "slot_type": tt["slot_type"],
                "subject": alloc.get("subject"),
                "teacher_id": alloc.get("teacher_id"),
                "teacher_name": alloc.get("teacher_name"),
                "room_id": alloc.get("room_id")
            }
            results.append(resolved_tt)
            
    return results

@router.get("/timetable/today")
async def get_today_timetable(current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    now = datetime.now()
    day_name = now.strftime("%A") # Monday, Tuesday, etc.
    
    role = current_user.get("role", "").lower()
    
    if role == "student" and current_user.get("course_id"):
        return await _resolve_v2_schedule_for_student(db, current_user, day_name)
    
    # Legacy fallback for old data
    query = {"day_of_week": day_name}
    if role == "teacher":
        query["teacher_id"] = current_user["id"]
    elif role == "student":
        if current_user.get("batch_id"):
            query["batch_id"] = current_user.get("batch_id")
            query["course_id"] = current_user.get("course_id")
            query["academic_year"] = current_user.get("academic_year")
        else:
            query["department"] = current_user.get("department")
            query["class_year"] = current_user.get("class_year")
    elif role == "admin":
        pass
        
    cursor = db.timetables.find(query).sort("start_time", 1)
    results = []
    async for tt in cursor:
        tt.pop("_id", None)
        results.append(tt)
    return results

@router.get("/timetable/weekly")
async def get_weekly_timetable(current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    role = current_user.get("role", "").lower()
    
    if role == "student" and current_user.get("course_id"):
        return await _resolve_v2_schedule_for_student(db, current_user, None)
        
    query = {}
    
    if role == "teacher":
        query["teacher_id"] = current_user["id"]
    elif role == "student":
        if current_user.get("batch_id"):
            query["batch_id"] = current_user.get("batch_id")
            query["course_id"] = current_user.get("course_id")
            query["academic_year"] = current_user.get("academic_year")
        else:
            query["department"] = current_user.get("department")
            query["class_year"] = current_user.get("class_year")
    elif role == "admin":
        pass
        
    cursor = db.timetables.find(query).sort([("day_of_week", 1), ("start_time", 1)])
    results = []
    async for tt in cursor:
        tt.pop("_id", None)
        results.append(tt)
    return results

@router.get("/timetable/active-sessions")
async def get_active_sessions(current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    """Returns any ONGOING sessions that apply to the logged-in student."""
    role = current_user.get("role", "").lower()
    
    if role != "student" or not current_user.get("course_id"):
        return []
        
    # Get today's resolved schedule for the student
    now = datetime.now()
    day_name = now.strftime("%A")
    todays_slots = await _resolve_v2_schedule_for_student(db, current_user, day_name)
    slot_ids = [slot["id"] for slot in todays_slots]
    
    if not slot_ids:
        return []
        
    # Find active sessions for those exact slots
    cursor = db.session_logs.find({
        "timetable_slot_id": {"$in": slot_ids},
        "status": "ONGOING"
    })
    
    active_sessions = []
    async for session in cursor:
        session["id"] = session.pop("_id", session.get("id"))
        active_sessions.append(session)
        
    return active_sessions
