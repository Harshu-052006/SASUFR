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


# Dynamically register setup and cleanup routes for test execution to avoid event loop conflicts
@app.post("/test-setup")
async def test_setup():
    db = await get_database()
    
    # 1. Clean up old test data if any
    await db.users.delete_many({"email": {"$in": ["test_admin@example.com", "test_student@example.com", "test_teacher@example.com"]}})
    
    # 2. Create test admin
    admin_id = await next_sequence("users")
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

    # 3. Create test student
    student_id = await next_sequence("users")
    await db.users.insert_one({
        "id": student_id,
        "full_name": "Test Student",
        "email": "test_student@example.com",
        "roll_number": "teststudent",
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

    # 4. Create test teacher
    teacher_id = await next_sequence("users")
    await db.users.insert_one({
        "id": teacher_id,
        "full_name": "Test Teacher",
        "email": "test_teacher@example.com",
        "roll_number": "testteacher",
        "hashed_password": hash_password("Password123"),
        "profile_picture": None,
        "is_active": True,
        "is_verified": True,
        "is_admin": False,
        "role": "teacher",
        "department": "Computer Science",
        "face_encoding": [],
        "face_image": None,
        "created_at": iso_ist(),
        "updated_at": iso_ist(),
    })

    return {"admin_id": admin_id, "student_id": student_id, "teacher_id": teacher_id}


@app.post("/test-cleanup")
async def test_cleanup():
    db = await get_database()
    await db.users.delete_many({"email": {"$in": ["test_admin@example.com", "test_student@example.com", "test_teacher@example.com"]}})
    return {"status": "ok"}


def run_tests():
    with TestClient(app) as client:
        print("--- Starting Admin Password Reset Flow Tests ---")
        
        # --- 0. Setup test users ---
        setup_res = client.post("/test-setup")
        assert setup_res.status_code == 200, f"Test setup failed: {setup_res.json()}"
        ids = setup_res.json()
        admin_id = ids["admin_id"]
        student_id = ids["student_id"]
        teacher_id = ids["teacher_id"]
        print("Test users created successfully.")
        
        try:
            # --- 1. Login as Admin ---
            print("Step 1: Logging in as Admin...")
            admin_login_res = client.post("/login", json={
                "email": "test_admin@example.com",
                "password": "AdminPassword123"
            })
            assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.json()}"
            print("Admin logged in successfully.")
            
            # --- 2. Admin resets Student and Teacher passwords ---
            print("\nStep 2: Admin resetting Student and Teacher passwords...")
            reset_student_res = client.post(f"/admin/users/{student_id}/reset-password", json={
                "admin_password": "AdminPassword123"
            })
            assert reset_student_res.status_code == 200, f"Student reset failed: {reset_student_res.json()}"
            temp_pwd_student = reset_student_res.json().get("temporary_password")
            print(f"Generated Student temp password: {temp_pwd_student}")
            
            reset_teacher_res = client.post(f"/admin/users/{teacher_id}/reset-password", json={
                "admin_password": "AdminPassword123"
            })
            assert reset_teacher_res.status_code == 200, f"Teacher reset failed: {reset_teacher_res.json()}"
            temp_pwd_teacher = reset_teacher_res.json().get("temporary_password")
            print(f"Generated Teacher temp password: {temp_pwd_teacher}")
            
            # Verify temporary passwords
            assert temp_pwd_student != temp_pwd_teacher, "Error: Both resets generated the same temporary password!"
            assert temp_pwd_student != "SASUFR", "Error: Reset password is the hardcoded 'SASUFR'!"
            assert temp_pwd_teacher != "SASUFR", "Error: Reset password is the hardcoded 'SASUFR'!"
            assert len(temp_pwd_student) >= 12, "Error: Student temporary password is too short!"
            assert len(temp_pwd_teacher) >= 12, "Error: Teacher temporary password is too short!"
            print("Success: Generated temporary passwords are secure, unique, and long enough.")
            
            # --- 3. Login as Student with temp password ---
            print("\nStep 3: Logging in as Student with temporary password...")
            student_login_res = client.post("/login", json={
                "email": "test_student@example.com",
                "password": temp_pwd_student
            })
            assert student_login_res.status_code == 200, f"Student login failed: {student_login_res.json()}"
            login_data = student_login_res.json()
            assert login_data.get("must_change_password") is True, "Error: must_change_password flag was not set to True in token!"
            print("Success: Login with temp password succeeded and flagged must_change_password=True.")
            
            # Use cookie credentials for subsequent requests
            # --- 4. Verify access block for Student ---
            print("\nStep 4: Verifying Student access restriction to normal routes...")
            # Normal route: /student/stats
            stats_res = client.get("/student/stats")
            assert stats_res.status_code == 403, f"Expected 403 block, got: {stats_res.status_code}"
            assert stats_res.json().get("detail") == "Password change required", f"Expected detail 'Password change required', got: {stats_res.json()}"
            print("Success: Call to normal endpoint was blocked with 403 Forbidden.")
            
            # Allowed route: /users/me
            me_res = client.get("/users/me")
            assert me_res.status_code == 200, f"Profile route should be allowed: {me_res.json()}"
            assert me_res.json().get("must_change_password") is True, "must_change_password should be True in /users/me response"
            print("Success: Profile endpoint remains accessible and indicates must_change_password=True.")
            
            # --- 5. Update Student password via set-new-password ---
            print("\nStep 5: Updating Student password...")
            update_pwd_res = client.post("/users/me/set-new-password", json={
                "new_password": "StudentNewSecurePassword123"
            })
            assert update_pwd_res.status_code == 200, f"Setting new password failed: {update_pwd_res.json()}"
            print("Success: Password updated successfully.")
            
            # --- 6. Verify block is cleared ---
            print("\nStep 6: Verifying normal route accessibility after password change...")
            me_res = client.get("/users/me")
            assert me_res.status_code == 200
            assert me_res.json().get("must_change_password") is False, "must_change_password should be False now"
            
            stats_res = client.get("/student/stats")
            assert stats_res.status_code == 200, f"Access should be allowed now, but got: {stats_res.json()}"
            print("Success: Normal routes are now accessible.")
            
            # --- 7. Login again to verify must_change_password remains False ---
            print("\nStep 7: Logging in again to verify persistence...")
            student_login_res = client.post("/login", json={
                "email": "test_student@example.com",
                "password": "StudentNewSecurePassword123"
            })
            assert student_login_res.status_code == 200
            assert student_login_res.json().get("must_change_password") is False, "must_change_password should be False in token response"
            print("Success: Verification complete. Logged in cleanly.")
            
            print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")
            
        finally:
            cleanup_res = client.post("/test-cleanup")
            assert cleanup_res.status_code == 200, f"Test cleanup failed: {cleanup_res.json()}"


if __name__ == "__main__":
    run_tests()
