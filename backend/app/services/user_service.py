from __future__ import annotations

from datetime import timedelta
import secrets
import string

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from ..config import settings
from ..models import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER, VALID_ROLES
from ..schemas import AdminAccountCreate, AdminUserUpdateRequest, TeacherCreate, UserCreate, UserProfileUpdate
from ..utils.security import create_access_token, hash_password, otp_hash, otp_salt, verify_password
from ..utils.time import iso_ist, now_ist, get_campus_now
from ..utils.roll_number import extract_roll_sequence


def _normalize_role(role: str | None, is_admin: bool = False) -> str:
    if is_admin:
        return ROLE_ADMIN
    value = (role or ROLE_STUDENT).strip().lower()
    return value if value in VALID_ROLES else ROLE_STUDENT


def serialize_user(user: dict):
    if not user:
        return user
    user = dict(user)
    user.pop("_id", None)
    user.pop("face_encoding", None)
    return user


async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> dict | None:
    return await db.users.find_one({"email": email.lower().strip()})


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: int) -> dict | None:
    return await db.users.find_one({"id": int(user_id)})


async def require_admin_password(admin_user: dict, password: str) -> None:
    if not verify_password(password, admin_user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Admin password confirmation failed")


async def create_registered_user(db: AsyncIOMotorDatabase, payload: UserCreate, face_encoding: list[float], otp: str, is_active: bool, approval_status: str) -> dict:
    from .crypto import encrypt_encoding
    user_seq = await db.counters.find_one_and_update(
        {"_id": "users"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    role = ROLE_TEACHER if payload.requested_role == "teacher" else ROLE_STUDENT
    roll_number = payload.roll_number.strip() if payload.roll_number else ""
    
    if roll_number:
        seq_val = extract_roll_sequence(roll_number)
        if seq_val > 0:
            seq_doc = await db.counters.find_one({"_id": "roll_numbers"})
            current_seq = int(seq_doc["seq"]) if seq_doc and "seq" in seq_doc else 0
            if seq_val > current_seq:
                await db.counters.update_one({"_id": "roll_numbers"}, {"$set": {"seq": seq_val}}, upsert=True)
    else:
        roll_seq = await db.counters.find_one_and_update(
            {"_id": "roll_numbers"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        roll_number = f"STU-{int(roll_seq['seq']):05d}"

    doc = {
        "id": int(user_seq["seq"]),
        "full_name": payload.full_name,
        "email": payload.email.lower().strip(),
        "roll_number": roll_number,
        "hashed_password": hash_password(payload.password),
        "profile_picture": None,
        "is_active": is_active,
        "is_verified": False,
        "is_admin": False,
        "role": role,
        "department": payload.department.strip() if payload.department else None,
        "otp_hash": otp_hash(otp, otp_salt()),
        "otp_expires_at": (get_campus_now() + timedelta(minutes=10)).isoformat(),
        "face_encoding": encrypt_encoding(face_encoding) if face_encoding else face_encoding,
        "face_image": payload.face_image,
        "id_card_image": payload.id_card_image,
        "approval_status": approval_status,
        "requested_role": payload.requested_role,
        "designation": payload.designation,
        "program": payload.program,
        "enrolled_subjects": payload.enrolled_subjects,
        "created_at": iso_ist(),
        "updated_at": iso_ist(),
    }
    await db.users.insert_one(doc)
    
    from .vector_store import vector_store
    if vector_store.is_ready and face_encoding:
        vector_store.add_or_update(doc["id"], face_encoding)
        
    return doc


async def create_teacher_user(db: AsyncIOMotorDatabase, payload: TeacherCreate) -> dict:
    user_seq = await db.counters.find_one_and_update(
        {"_id": "users"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    doc = {
        "id": int(user_seq["seq"]),
        "full_name": payload.full_name,
        "email": payload.email.lower().strip(),
        "roll_number": payload.employee_id.strip(),
        "hashed_password": hash_password(payload.password),
        "profile_picture": None,
        "is_active": True,
        "is_verified": True,
        "is_admin": False,
        "role": ROLE_TEACHER,
        "department": payload.department.strip(),
        "face_encoding": [],
        "face_image": None,
        "created_at": iso_ist(),
        "updated_at": iso_ist(),
    }
    await db.users.insert_one(doc)
    return doc


async def create_admin_user(db: AsyncIOMotorDatabase, payload: AdminAccountCreate) -> dict:
    user_seq = await db.counters.find_one_and_update(
        {"_id": "users"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    doc = {
        "id": int(user_seq["seq"]),
        "full_name": payload.full_name,
        "email": payload.email.lower().strip(),
        "roll_number": payload.identifier.strip(),
        "hashed_password": hash_password(payload.password),
        "profile_picture": None,
        "is_active": True,
        "is_verified": True,
        "is_admin": True,
        "role": ROLE_ADMIN,
        "department": payload.department.strip() if payload.department else "Administration",
        "face_encoding": [],
        "face_image": None,
        "created_at": iso_ist(),
        "updated_at": iso_ist(),
    }
    await db.users.insert_one(doc)
    return doc


async def create_access_token_for_user(user: dict) -> str:
    return create_access_token({"sub": user["email"]}, timedelta(minutes=settings.access_token_expire_minutes))


async def verify_student_login(user: dict, password: str) -> None:
    if not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")


async def update_password(db: AsyncIOMotorDatabase, user: dict, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "hashed_password": hash_password(new_password),
            "must_change_password": False,
            "temp_password_expires_at": None,
            "updated_at": iso_ist()
        }},
    )


async def admin_update_user(db: AsyncIOMotorDatabase, target: dict, payload: AdminUserUpdateRequest) -> dict:
    updates: dict = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name
    if payload.email is not None:
        updates["email"] = payload.email.lower().strip()
    if payload.roll_number is not None:
        updates["roll_number"] = payload.roll_number.strip()
    if payload.role is not None:
        updates["role"] = _normalize_role(payload.role)
        updates["is_admin"] = updates["role"] == ROLE_ADMIN
    if payload.department is not None:
        updates["department"] = payload.department.strip()
    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")
    updates["updated_at"] = iso_ist()
    await db.users.update_one({"id": target["id"]}, {"$set": updates})
    return updates


async def set_active_status(db: AsyncIOMotorDatabase, user_id: int, is_active: bool) -> None:
    updates = {"is_active": is_active, "updated_at": iso_ist()}
    if is_active:
        updates["blocked_reason"] = None
    await db.users.update_one({"id": int(user_id)}, {"$set": updates})


def generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def reset_password(db: AsyncIOMotorDatabase, user: dict, temp_password: str | None = None) -> str:
    generated = temp_password or generate_temp_password()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "hashed_password": hash_password(generated),
            "must_change_password": True,
            "temp_password_expires_at": (now_ist() + timedelta(hours=24)).isoformat(),
            "updated_at": iso_ist()
        }},
    )
    return generated


async def delete_user(db: AsyncIOMotorDatabase, user_id: int) -> None:
    await db.users.delete_one({"id": int(user_id)})
    await db.attendance.delete_many({"user_id": int(user_id)})
    
    from .vector_store import vector_store
    if vector_store.is_ready:
        vector_store.remove(int(user_id))


async def mark_verified(db: AsyncIOMotorDatabase, user: dict) -> None:
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_verified": True, "otp_hash": None, "otp_expires_at": None, "updated_at": iso_ist()}},
    )


async def resend_otp(db: AsyncIOMotorDatabase, user: dict, otp: str) -> None:
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"otp_hash": otp_hash(otp, otp_salt()), "otp_expires_at": (get_campus_now() + timedelta(minutes=10)).isoformat(), "updated_at": iso_ist()}},
    )
async def update_user_profile(db: AsyncIOMotorDatabase, user_id: int, payload: UserProfileUpdate) -> dict:
    updates: dict = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name
    if payload.department is not None:
        updates["department"] = payload.department.strip()
    
    if payload.preferences is not None:
        # Load existing user and merge preferences to prevent data loss
        user = await db.users.find_one({"id": int(user_id)})
        current_prefs = user.get("preferences", {})
        # Deep merge/Update with new preferences
        current_prefs.update(payload.preferences)
        updates["preferences"] = current_prefs

    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")
    
    updates["updated_at"] = iso_ist()
    await db.users.update_one({"id": int(user_id)}, {"$set": updates})
    return updates
