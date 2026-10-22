from __future__ import annotations

import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from main import app
from app.database.mongo import get_database, next_sequence
from app.utils.security import hash_password
from app.utils.time import iso_ist


# Dynamically register setup, check and cleanup routes for test execution to avoid event loop conflicts
@app.post("/test-setup")
async def test_setup():
    db = await get_database()
    
    # 1. Clean up old test data if any
    await db.users.delete_many({"email": {"$in": ["test_admin@example.com", "csv_student_existing@example.com", "csv_student_custom@example.com", "csv_student_seq@example.com", "csv_student_final@example.com"]}})
    
    # 2. Reset counters to 50 for testing
    await db.counters.update_one({"_id": "users"}, {"$set": {"seq": 50}}, upsert=True)
    
    # 3. Create test admin
    admin_id = await next_sequence("users")  # gets 51
    await db.users.insert_one({
        "id": admin_id,
        "full_name": "Test Admin",
        "email": "test_admin@example.com",
        "roll_number": "testadmin",
        "hashed_password": hash_password("AdminPassword123"),
        "profile_picture": None,
        "is_active": True,
        "is_verified": True,
        "is_admin": True,
        "role": "admin",
        "department": None,
        "face_encoding": [],
        "face_image": None,
        "created_at": iso_ist(),
        "updated_at": iso_ist(),
    })

    # 4. Create an existing student with ID 10 (out of sequence) to verify ID preservation
    await db.users.insert_one({
        "id": 10,
        "full_name": "Existing Student",
        "email": "csv_student_existing@example.com",
        "roll_number": "existing10",
        "hashed_password": hash_password("Password123"),
        "profile_picture": None,
        "is_active": True,
        "is_verified": True,
        "is_admin": False,
        "role": "student",
        "department": "Computer Science",
        "face_encoding": [],
        "face_image": None,
        "created_at": iso_ist(),
        "updated_at": iso_ist(),
    })

    return {"admin_id": admin_id}


@app.get("/test-verify-results")
async def test_verify_results():
    db = await get_database()
    
    existing = await db.users.find_one({"email": "csv_student_existing@example.com"})
    custom = await db.users.find_one({"email": "csv_student_custom@example.com"})
    seq = await db.users.find_one({"email": "csv_student_seq@example.com"})
    final = await db.users.find_one({"email": "csv_student_final@example.com"})
    
    counter_doc = await db.counters.find_one({"_id": "users"})
    counter_seq = counter_doc["seq"] if counter_doc else None
    
    return {
        "existing_id": existing["id"] if existing else None,
        "custom_id": custom["id"] if custom else None,
        "seq_id": seq["id"] if seq else None,
        "final_id": final["id"] if final else None,
        "counter_seq": counter_seq
    }


@app.post("/test-cleanup")
async def test_cleanup():
    db = await get_database()
    await db.users.delete_many({"email": {"$in": ["test_admin@example.com", "csv_student_existing@example.com", "csv_student_custom@example.com", "csv_student_seq@example.com", "csv_student_final@example.com"]}})
    return {"status": "ok"}


def run_tests():
    with TestClient(app) as client:
        print("--- Starting Bulk CSV Upload ID Preservation/Uniqueness Tests ---")
        
        # --- 0. Setup test users and counter ---
        setup_res = client.post("/test-setup")
        assert setup_res.status_code == 200, f"Test setup failed: {setup_res.json()}"
        print("Test environment initialized.")
        
        try:
            # --- 1. Login as Admin ---
            print("Step 1: Logging in as Admin...")
            admin_login_res = client.post("/login", json={
                "email": "test_admin@example.com",
                "password": "AdminPassword123"
            })
            assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.json()}"
            print("Admin logged in successfully.")
            
            # --- 2. Perform bulk CSV import ---
            print("\nStep 2: Performing bulk CSV import...")
            # CSV contains:
            # - csv_student_existing@example.com: exists in DB with ID 10. No ID provided in CSV.
            # - csv_student_custom@example.com: new user, ID 200 explicitly specified.
            # - csv_student_seq@example.com: new user, no ID specified.
            csv_data = (
                "email,roll_number,full_name,department,role,password,id\n"
                "csv_student_existing@example.com,existing10,Existing Student Updated,Computer Science,student,Password123,\n"
                "csv_student_custom@example.com,custom200,Custom Student,Computer Science,student,Password123,200\n"
                "csv_student_seq@example.com,seq201,Sequential Student,Computer Science,student,Password123,\n"
            )
            
            import_res = client.post(
                "/admin/import_students",
                files={"file": ("students.csv", csv_data, "text/csv")}
            )
            assert import_res.status_code == 200, f"CSV Import failed: {import_res.json()}"
            print(f"Import response: {import_res.json()}")
            
            # --- 3. Verify results ---
            print("\nStep 3: Verifying IDs assigned during CSV import...")
            results_res = client.get("/test-verify-results")
            assert results_res.status_code == 200
            results = results_res.json()
            print(f"Verification Results: {results}")
            
            # - Existing user ID must be preserved
            assert results["existing_id"] == 10, f"Error: Existing user ID was overwritten to {results['existing_id']}!"
            # - Custom user ID must be 200
            assert results["custom_id"] == 200, f"Error: Custom user ID was not set to 200!"
            # - Sequential user ID must be 201 (since 200 was processed inline and set the counter to 200, so next sequence is 201)
            assert results["seq_id"] == 201, f"Error: Sequential user ID was expected to be 201, but got {results['seq_id']}!"
            print("Success: CSV import IDs generated and preserved correctly.")
            
            # --- 4. Verify post-import normal creation ---
            print("\nStep 4: Creating another user after import to verify counter sequence continuation...")
            csv_data_final = (
                "email,roll_number,full_name,department,role,password,id\n"
                "csv_student_final@example.com,final202,Final Student,Computer Science,student,Password123,\n"
            )
            import_res_final = client.post(
                "/admin/import_students",
                files={"file": ("students_final.csv", csv_data_final, "text/csv")}
            )
            assert import_res_final.status_code == 200, f"Final CSV Import failed: {import_res_final.json()}"
            
            results_res = client.get("/test-verify-results")
            results = results_res.json()
            print(f"Final Verification Results: {results}")
            
            # - Final user ID must be 202
            assert results["final_id"] == 202, f"Error: Post-import user ID was expected to be 202, but got {results['final_id']}!"
            assert results["counter_seq"] == 202, f"Error: Final counter sequence was expected to be 202, but got {results['counter_seq']}!"
            print("Success: Post-import creation gets non-colliding sequential ID 202.")
            
            print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")
            
        finally:
            cleanup_res = client.post("/test-cleanup")
            assert cleanup_res.status_code == 200, f"Test cleanup failed: {cleanup_res.json()}"


if __name__ == "__main__":
    run_tests()
