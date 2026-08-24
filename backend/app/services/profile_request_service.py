import uuid
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.schemas import ProfileChangeRequestCreate
from app.utils.time import iso_ist


async def submit_profile_change_request(db: AsyncIOMotorDatabase, teacher: dict, payload: ProfileChangeRequestCreate) -> dict:
    # Exclude unset fields so we only save the requested changes
    requested_changes = payload.model_dump(exclude_unset=True)
    if not requested_changes:
        raise HTTPException(status_code=400, detail="No changes requested.")
        
    seq_doc = await db.counters.find_one_and_update(
        {"_id": "profile_change_requests"}, 
        {"$inc": {"seq": 1}}, 
        upsert=True, 
        return_document=ReturnDocument.AFTER
    )
    request_id = str(seq_doc["seq"])

    doc = {
        "id": request_id,
        "teacher_id": teacher["id"],
        "requested_changes": requested_changes,
        "status": "pending",
        "timestamp": iso_ist(),
        "reviewed_by": None,
        "review_timestamp": None,
    }

    await db.profile_change_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def get_teacher_change_requests(db: AsyncIOMotorDatabase, teacher_id: int) -> list[dict]:
    cursor = db.profile_change_requests.find({"teacher_id": teacher_id}).sort("timestamp", -1)
    requests = await cursor.to_list(length=None)
    for req in requests:
        req.pop("_id", None)
    return requests


async def get_all_change_requests(db: AsyncIOMotorDatabase, status: str | None = None) -> list[dict]:
    query = {}
    if status:
        query["status"] = status
    cursor = db.profile_change_requests.find(query).sort("timestamp", -1)
    requests = await cursor.to_list(length=None)
    for req in requests:
        req.pop("_id", None)
    return requests


async def review_profile_change_request(db: AsyncIOMotorDatabase, request_id: str, admin: dict, status: str) -> dict:
    req = await db.profile_change_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
        
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request has already been {req['status']}.")

    update_doc = {
        "status": status,
        "reviewed_by": admin["id"],
        "review_timestamp": iso_ist(),
    }

    if status == "approved":
        # Apply the changes to the user's document
        changes = req.get("requested_changes", {})
        if changes:
            await db.users.update_one({"id": req["teacher_id"]}, {"$set": changes})

    await db.profile_change_requests.update_one({"id": request_id}, {"$set": update_doc})
    
    req.update(update_doc)
    req.pop("_id", None)
    return req
