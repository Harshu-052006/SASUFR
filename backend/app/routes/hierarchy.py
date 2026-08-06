from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List

from ..database.mongo import get_database
from ..schemas import DepartmentOut, CourseOut, BatchOut, RoomOut, SubBatchOut
from ..dependencies import get_current_user

router = APIRouter(tags=["hierarchy"])

@router.get("/hierarchy/departments", response_model=List[DepartmentOut])
async def get_departments(db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.departments.find({}).sort("name", 1)
    results = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id", doc.get("id"))
        results.append(doc)
    return results

@router.get("/hierarchy/courses", response_model=List[CourseOut])
async def get_courses(department_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.courses.find({"department_id": department_id}).sort("name", 1)
    results = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id", doc.get("id"))
        results.append(doc)
    return results

@router.get("/hierarchy/batches", response_model=List[BatchOut])
async def get_batches(course_id: str, academic_year: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.batches.find({"course_id": course_id, "academic_year": academic_year}).sort("batch_name", 1)
    results = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id", doc.get("id"))
        results.append(doc)
    return results

@router.get("/hierarchy/rooms", response_model=List[RoomOut])
async def get_rooms(db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.rooms.find({}).sort("name", 1)
    results = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id", doc.get("id"))
        results.append(doc)
    return results

@router.get("/hierarchy/sub-batches", response_model=List[SubBatchOut])
async def get_sub_batches(parent_batch_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.sub_batches.find({"parent_batch_id": parent_batch_id}).sort("name", 1)
    results = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id", doc.get("id"))
        results.append(doc)
    return results
