from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid
from typing import List

from ..database.mongo import get_database
from ..schemas import ElectiveCourseCreate, ElectiveCourseOut, CustomGroupCreate, CustomGroupOut
from ..dependencies import get_current_user

router = APIRouter(tags=["electives"])

def _require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin" and current_user.get("designation") not in ["hod", "admin"]:
        raise HTTPException(status_code=403, detail="Admin/HOD privileges required")
    return current_user

@router.post("/admin/electives", response_model=ElectiveCourseOut)
async def create_elective(payload: ElectiveCourseCreate, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    await db.elective_courses.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.get("/electives", response_model=List[ElectiveCourseOut])
async def get_electives(department_id: str, course_id: str, academic_year: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.elective_courses.find({
        "department_id": department_id,
        "course_id": course_id,
        "academic_year": academic_year
    })
    results = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id", doc.get("id"))
        results.append(doc)
    return results

@router.post("/admin/electives/groups", response_model=CustomGroupOut)
async def create_custom_group(payload: CustomGroupCreate, current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    await db.custom_groups.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.get("/electives/groups", response_model=List[CustomGroupOut])
async def get_custom_groups(elective_course_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.custom_groups.find({"elective_course_id": elective_course_id})
    results = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id", doc.get("id"))
        results.append(doc)
    return results

@router.post("/admin/electives/groups/{group_id}/assign-students")
async def assign_students_to_group(group_id: str, student_ids: List[int], current_user: dict = Depends(_require_admin), db: AsyncIOMotorDatabase = Depends(get_database)):
    # Check if group exists
    group = await db.custom_groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    # Add the group_id to the elective_group_ids array for these students
    result = await db.users.update_many(
        {"id": {"$in": student_ids}, "role": "student"},
        {"$addToSet": {"elective_group_ids": group_id}}
    )
    
    return {"message": f"Assigned {result.modified_count} students to group {group_id}"}
