from __future__ import annotations

import os
import sys
from typing import Any

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from app.database.mongo import get_database, next_sequence
from app.config import settings
from app.utils.security import hash_password
from app.utils.time import iso_ist


# Helper to patch frozen settings
def patch_setting(name: str, value: Any) -> None:
    object.__setattr__(settings, name, value)


# Dynamically register setup and cleanup routes for test execution to avoid event loop conflicts
@app.post("/test-setup")
async def test_setup():
    db = await get_database()
    
    # 1. Clean up old test data if any
    await db.users.delete_many({"email": "test_admin@example.com"})
    
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

    return {"admin_id": admin_id}


@app.post("/test-cleanup")
async def test_cleanup():
    db = await get_database()
    await db.users.delete_many({"email": "test_admin@example.com"})
    await db.config.delete_one({"_id": "global"})
    return {"status": "ok"}


def run_tests():
    # Save original settings to restore later
    orig_mail_enabled = settings.mail_enabled
    orig_mail_server = settings.mail_server
    orig_mail_port = settings.mail_port
    orig_mail_username = settings.mail_username
    orig_mail_password = settings.mail_password
    orig_mail_from = settings.mail_from
    orig_use_credentials = settings.use_credentials
    
    with TestClient(app) as client:
        print("--- Starting SMTP Health-Check and Error Telemetry Tests ---")
        
        # --- 0. Setup test admin ---
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
            
            # --- 2. Test SMTP Check with Failing Config ---
            print("\nStep 2: Testing SMTP health check with failing configuration...")
            # Break settings
            patch_setting("mail_enabled", True)
            patch_setting("mail_server", "invalid_smtp_server_domain_xyz.com")
            patch_setting("mail_port", 587)
            patch_setting("mail_username", "test_user")
            patch_setting("mail_password", "wrong_password")
            patch_setting("mail_from", "test_sender@example.com")
            patch_setting("use_credentials", True)
            
            # Trigger on-demand check
            check_res = client.post("/admin/config/check-smtp")
            assert check_res.status_code == 200
            data = check_res.json()
            assert data["success"] is False, "Expected connectivity check to fail!"
            assert data["error"] is not None, "Expected check to return error message!"
            print(f"SMTP Check correctly failed. Error: {data['error']}")
            
            # Check telemetry status
            stats_res = client.get("/admin/stats")
            assert stats_res.status_code == 200
            stats = stats_res.json()
            assert stats["email_status"] == "failing", f"Expected email_status 'failing', got: {stats['email_status']}"
            assert stats["email_error"] is not None, "Expected email_error details, got None"
            print("Success: /admin/stats reflects 'failing' email status with error details.")
            
            # --- 3. Test SMTP Check with Mail Disabled ---
            print("\nStep 3: Testing SMTP health check with mail disabled...")
            patch_setting("mail_enabled", False)
            
            check_res = client.post("/admin/config/check-smtp")
            assert check_res.status_code == 200
            data = check_res.json()
            assert data["success"] is True, "Expected True when mail is disabled"
            
            stats_res = client.get("/admin/stats")
            stats = stats_res.json()
            assert stats["email_status"] == "ok", f"Expected email_status 'ok', got: {stats['email_status']}"
            print("Success: Disabled mail configuration reports 'ok' status.")
            
            # --- 4. Test SMTP inline update during actual send failure ---
            print("\nStep 4: Testing inline database status update during actual mail send failure...")
            # Re-enable mail with bad settings
            patch_setting("mail_enabled", True)
            patch_setting("mail_server", "invalid_smtp_server_domain_xyz.com")
            
            # Trigger mail send via forgot-password endpoint
            forgot_res = client.post("/forgot-password", json={
                "email": "test_admin@example.com"
            })
            assert forgot_res.status_code == 200, f"Forgot password failed: {forgot_res.json()}"
            print("Forgot password request completed (mail send triggered).")
            
            # Query status
            stats_res = client.get("/admin/stats")
            stats = stats_res.json()
            assert stats["email_status"] == "failing", "Expected status to update to 'failing' on send failure"
            assert "getaddrinfo failed" in stats["email_error"] or "invalid_smtp_server_domain_xyz.com" in stats["email_error"], f"Expected specific host/address resolution error, got: {stats['email_error']}"
            print(f"Success: Inline failure recorded in DB. Error: {stats['email_error']}")
            
            print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")
            
        finally:
            # Restore original settings
            patch_setting("mail_enabled", orig_mail_enabled)
            patch_setting("mail_server", orig_mail_server)
            patch_setting("mail_port", orig_mail_port)
            patch_setting("mail_username", orig_mail_username)
            patch_setting("mail_password", orig_mail_password)
            patch_setting("mail_from", orig_mail_from)
            patch_setting("use_credentials", orig_use_credentials)
            
            cleanup_res = client.post("/test-cleanup")
            assert cleanup_res.status_code == 200, f"Test cleanup failed: {cleanup_res.json()}"


if __name__ == "__main__":
    run_tests()
