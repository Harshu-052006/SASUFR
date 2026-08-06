from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid

from ..database.mongo import get_database
from ..dependencies import get_current_user
from ..models import ROLE_STUDENT, ROLE_ADMIN
from ..schemas import BatchRequestCreate, BatchRequestOut
from ..utils.time import iso_ist

router = APIRouter(tags=["batch"])

async def _require_student(current_user: dict = Depends(get_current_user)) -> dict:
    if (current_user.get("role") or "").lower() != ROLE_STUDENT:
        raise HTTPException(status_code=403, detail="Student access required.")
    return current_user

async def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not bool(current_user.get("is_admin")) and (current_user.get("role") or "").lower() != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Administrative access required.")
    return current_user

@router.post("/students/me/assign-batch")
async def assign_batch(
    payload: dict,
    current_user: dict = Depends(_require_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    if current_user.get("is_batch_locked"):
        raise HTTPException(status_code=400, detail="Batch is already locked.")
        
    department_id = payload.get("department_id")
    course_id = payload.get("course_id")
    academic_year = payload.get("academic_year")
    batch_id = payload.get("batch_id")
    
    if not all([department_id, course_id, academic_year, batch_id]):
        raise HTTPException(status_code=400, detail="Missing required batch fields.")
        
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "department_id": department_id,
            "course_id": course_id,
            "academic_year": academic_year,
            "batch_id": batch_id,
            "is_batch_locked": True,
            "updated_at": iso_ist()
        }}
    )
    return {"message": "Batch assigned and locked successfully."}

@router.post("/students/me/batch-requests", response_model=BatchRequestOut)
async def create_batch_request(
    payload: BatchRequestCreate,
    current_user: dict = Depends(_require_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    request_doc = {
        "id": str(uuid.uuid4()),
        "student_id": current_user["id"],
        "current_batch_id": current_user.get("batch_id"),
        "requested_batch_id": payload.requested_batch_id,
        "reason": payload.reason,
        "status": "PENDING",
        "reviewed_by": None,
        "created_at": iso_ist()
    }
    await db.batch_requests.insert_one(request_doc)
    request_doc.pop("_id", None)
    return request_doc

@router.get("/students/me/batch-requests", response_model=list[BatchRequestOut])
async def get_my_batch_requests(
    current_user: dict = Depends(_require_student),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    cursor = db.batch_requests.find({"student_id": current_user["id"]}).sort("created_at", -1)
    results = []
    async for doc in cursor:
        doc.pop("_id", None)
        results.append(doc)
    return results

@router.get("/admin/batch-requests", response_model=list[BatchRequestOut])
async def admin_get_batch_requests(
    status: str = "PENDING",
    current_user: dict = Depends(_require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    cursor = db.batch_requests.find({"status": status}).sort("created_at", 1)
    results = []
    async for doc in cursor:
        doc.pop("_id", None)
        results.append(doc)
    return results

@router.post("/admin/batch-requests/{request_id}/review")
async def review_batch_request(
    request_id: str,
    payload: dict,
    current_user: dict = Depends(_require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    status = payload.get("status")
    if status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED.")
        
    request_doc = await db.batch_requests.find_one({"id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    await db.batch_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": status,
            "reviewed_by": current_user["id"],
            "comments": payload.get("comments", "")
        }}
    )
    
    if status == "APPROVED":
        await db.users.update_one(
            {"id": request_doc["student_id"]},
            {"$set": {
                "batch_id": request_doc["requested_batch_id"],
                "updated_at": iso_ist()
            }}
        )
        
    return {"message": f"Batch request {status.lower()} successfully."}
