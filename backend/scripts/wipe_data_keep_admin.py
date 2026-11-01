import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

async def wipe_all_except_admin():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    
    print("[1/5] Finding Admin user...")
    admin = await db.users.find_one({"is_admin": True, "email": "officialadmin00101@gmail.com"})
    if not admin:
        admin = await db.users.find_one({"is_admin": True})
    
    if not admin:
        print("[ERROR] No admin user found! Aborting wipe to avoid lockout.")
        return

    admin_id = admin.get("id", 1)
    print(f"Preserving Admin: {admin.get('full_name')} ({admin.get('email')}, id={admin_id})")

    print("[2/5] Wiping non-admin users...")
    del_users = await db.users.delete_many({"_id": {"$ne": admin["_id"]}})
    print(f"Deleted {del_users.deleted_count} non-admin user(s).")

    collections_to_clear = [
        "attendance",
        "class_sessions",
        "profile_change_requests",
        "absent_notification_claims",
        "security_logs",
        "valid_students",
        "announcements",
        "timetables",
        "batches",
        "electives"
    ]

    print("[3/5] Clearing operational collections...")
    for col in collections_to_clear:
        res = await db[col].delete_many({})
        print(f"Cleared {col}: {res.deleted_count} records removed.")

    print("[4/5] Resetting counters...")
    await db.counters.update_one({"_id": "users"}, {"$set": {"seq": admin_id}}, upsert=True)
    await db.counters.update_one({"_id": "roll_numbers"}, {"$set": {"seq": 0}}, upsert=True)
    for col in collections_to_clear:
        await db.counters.delete_one({"_id": col})
    print("Counters reset.")

    print("[5/5] Ensuring global config...")
    await db.config.update_one(
        {"_id": "global"},
        {
            "$set": {
                "official_domain": "mit.asia",
                "organization_type": "Engineering College",
                "departments": [
                    "Computer Science & Engineering",
                    "Electronics & Communication",
                    "Mechanical Engineering",
                    "Civil Engineering",
                    "Information Technology"
                ],
                "classes": ["CS-201", "CS-202", "CS-203", "EC-201"]
            }
        },
        upsert=True
    )
    print("Global config verified.")

    # Re-initialize vector store
    try:
        from app.services.vector_store import vector_store
        await vector_store.initialize(db)
        print("Vector store re-initialized.")
    except Exception as e:
        print(f"Vector store notice: {e}")

    print("Data wipe complete! Only System Admin is preserved.")

if __name__ == "__main__":
    asyncio.run(wipe_all_except_admin())
