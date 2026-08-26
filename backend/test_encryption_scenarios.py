import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch, MagicMock

# Ensure backend is in path
sys.path.append(os.path.dirname(__file__))

# We need to set ENCRYPTION_KEY before importing modules that use it
os.environ["ENCRYPTION_KEY"] = "F8Z9xU9xJ4UuE1Wv6XQ8Q7c8q2l3Z1Vb1u2P0X9wG5I="
from app.config import settings

from app.services.crypto import encrypt_encoding, decrypt_encoding, _fernet
from app.services.user_service import create_registered_user
from app.routes.auth import register
from app.schemas import UserCreate
from app.services.vector_store import vector_store

from fastapi import HTTPException
from cryptography.fernet import InvalidToken

# Initialize FAISS for tests
vector_store.dimension = 128
import faiss
vector_store.index = faiss.IndexIDMap(faiss.IndexFlatL2(128))
vector_store.is_ready = True

async def run_tests():
    print("--- Running Face Encryption Scenarios ---")
    
    # Mock DB
    db = AsyncMock()
    db.counters.find_one_and_update.return_value = {"seq": 1}
    
    # ---------------------------------------------------------
    # Scenario 1: Register a new student -> confirm encrypted string
    # ---------------------------------------------------------
    print("\n[Scenario 1] Register new student -> confirm encrypted string in DB")
    test_encoding = [0.1] * 128
    payload = UserCreate(
        name="Test User", email="test@test.com", password="password123",
        roll_number="12345",
        department="CSE", designation="Student", program="BTECH", requested_role="student",
        face_image="base64img", id_card_image="base64img"
    )
    
    await create_registered_user(db, payload, face_encoding=test_encoding, otp="1234", is_active=True, approval_status="pending")
    # Verify insert_one was called with encrypted string
    inserted_doc = db.users.insert_one.call_args[0][0]
    
    if isinstance(inserted_doc["face_encoding"], str):
        print("✅ SUCCESS: face_encoding is stored as an encrypted string (type str).")
    else:
        print("❌ FAIL: face_encoding is not a string!")
        
    # ---------------------------------------------------------
    # Scenario 2: Register a second student with different face -> succeeds normally
    # ---------------------------------------------------------
    print("\n[Scenario 2] Register second student with different face")
    different_encoding = [0.2] * 128
    
    from starlette.requests import Request
    dummy_scope = {"type": "http", "headers": [], "client": ("127.0.0.1", 8000), "path": "/register", "method": "POST"}
    dummy_request = Request(dummy_scope)

    try:
        # We need find_one to return None for the email check so it doesn't fail there
        db.users.find_one.return_value = None
        # Mock extract_encoding to return different_encoding
        with patch('app.routes.auth.extract_encoding', new_callable=AsyncMock) as mock_ext, \
             patch('app.routes.auth.verify_liveness', new_callable=AsyncMock) as mock_live, \
             patch('app.routes.auth.create_registered_user', new_callable=AsyncMock) as mock_create:
            mock_ext.return_value = different_encoding
            # This should NOT trigger duplicate because vector_store only has [0.1]
            await register(request=dummy_request, background_tasks=MagicMock(), db=db, payload=payload)
            print("✅ SUCCESS: Second student registered normally without duplicate exception.")
    except HTTPException as e:
        if e.status_code == 409:
            print("❌ FAIL: Falsely detected as duplicate.")
        else:
            print(f"❌ FAIL: Unexpected error {e}")
            
    # ---------------------------------------------------------
    # Scenario 3: Duplicate detection catches existing user instantly via vector store
    # ---------------------------------------------------------
    print("\n[Scenario 3] Duplicate detection catches existing user via vector store")
    try:
        with patch('app.routes.auth.extract_encoding', new_callable=AsyncMock) as mock_ext, \
             patch('app.routes.auth.verify_liveness', new_callable=AsyncMock) as mock_live:
            # Send the SAME encoding as Scenario 1
            mock_ext.return_value = test_encoding
            
            # We want email/roll check to pass (return None), but the target_user query to return a user
            async def mock_find_one(query):
                if "email" in query or "roll_number" in query:
                    return None
                return {"id": 1, "name": "Original User", "email": "test2@test.com"}
            db.users.find_one.side_effect = mock_find_one
            
            await register(request=dummy_request, background_tasks=MagicMock(), db=db, payload=payload)
            print("❌ FAIL: Registration should have thrown a duplicate error!")
    except HTTPException as e:
        if e.status_code == 400 and "Biometric duplication detected" in e.detail:
            print("✅ SUCCESS: Caught duplicate face immediately via vector store.")
        else:
            print(f"❌ FAIL: Wrong exception {e}")

    # ---------------------------------------------------------
    # Scenario 4: Simulate legacy plaintext record mixed-state
    # ---------------------------------------------------------
    print("\n[Scenario 4] Read legacy plaintext record without crashing")
    legacy_record = {"id": 2, "face_encoding": [0.5] * 128}
    decrypted = decrypt_encoding(legacy_record["face_encoding"])
    if isinstance(decrypted, list) and decrypted[0] == 0.5:
        print("✅ SUCCESS: Handled plaintext list perfectly.")
    else:
        print("❌ FAIL: Did not return correct plaintext list.")

    # ---------------------------------------------------------
    # Scenario 5: Migration script logic works on plaintext
    # ---------------------------------------------------------
    print("\n[Scenario 5] Run migration logic against plaintext record")
    plaintext_data = [0.9] * 128
    migrated_str = encrypt_encoding(plaintext_data)
    if isinstance(migrated_str, str):
        # Now verify matching works post migration
        recovered = decrypt_encoding(migrated_str)
        if isinstance(recovered, list) and len(recovered) == 128:
            print("✅ SUCCESS: Migrated to string, and successfully decrypted back to list.")
        else:
            print("❌ FAIL: Could not decrypt migrated data.")
    else:
        print("❌ FAIL: Did not encrypt into string.")

    # ---------------------------------------------------------
    # Scenario 6: Wrong/corrupted ENCRYPTION_KEY
    # ---------------------------------------------------------
    print("\n[Scenario 6] Corrupted ENCRYPTION_KEY fails clearly with InvalidToken")
    # Change the key globally for Fernet
    from cryptography.fernet import Fernet
    wrong_fernet = Fernet(Fernet.generate_key())
    # We monkeypatch the module's _fernet
    with patch('app.services.crypto._fernet', wrong_fernet):
        try:
            decrypt_encoding(migrated_str)
            print("❌ FAIL: Should have raised InvalidToken error!")
        except InvalidToken:
            print("✅ SUCCESS: Raised InvalidToken gracefully.")
        except Exception as e:
            print(f"❌ FAIL: Raised wrong exception {e}")

    # ---------------------------------------------------------
    # Scenario 7: Self-attendance works end-to-end for encrypted user
    # ---------------------------------------------------------
    print("\n[Scenario 7] Attendance matching works for encrypted user")
    from app.services.attendance_service import mark_student_self_attendance
    db.class_sessions = AsyncMock()
    async def mock_find_one_session(*args, **kwargs):
        return {"id": 1, "department": "CSE", "status": "active", "course_id": "C1", "batch_id": "B1", "academic_year": "2023"}
    db.class_sessions.find_one = mock_find_one_session
    
    encrypted_student = {
        "id": 1, "is_active": True, "department": "CSE", "course_id": "C1", "batch_id": "B1", "academic_year": "2023",
        "face_encoding": migrated_str  # This is an encrypted string
    }
    
    # We patch vector store search to fall back to linear search, OR patch linear search
    # Let's patch vector store to not have this user so it falls back to linear search, which decrypts it.
    vector_store.is_ready = False 
    
    with patch("app.services.attendance_service.extract_multiple_encodings", new_callable=AsyncMock) as mock_extract, \
         patch("app.services.attendance_service._get_geo_policy", new_callable=AsyncMock) as mock_geo, \
         patch("app.services.attendance_service._insert_or_update_attendance", new_callable=AsyncMock) as mock_insert, \
         patch("app.services.attendance_service.verify_liveness", new_callable=AsyncMock) as mock_live:
         
        # The user's face is [0.9] * 128. We provide [0.9]*128 to match perfectly.
        mock_extract.return_value = [[0.9] * 128]
        mock_geo.return_value = {"geofencing_enabled": False}
        mock_insert.return_value = ({"check_in": "now", "status": "Present"}, True)
        db.room_code_attempts = AsyncMock()
        db.room_code_attempts.find_one.return_value = {}
        
        try:
            await mark_student_self_attendance(db=db, student=encrypted_student, session_id=1, image="img", latitude=0, longitude=0, room_code="code")
            print("✅ SUCCESS: Attendance marked successfully using encrypted face_encoding.")
        except Exception as e:
            print(f"❌ FAIL: Attendance marking failed: {e}")

    # ---------------------------------------------------------
    # Scenario 8: App startup without ENCRYPTION_KEY fails
    # ---------------------------------------------------------
    print("\n[Scenario 8] Startup with missing ENCRYPTION_KEY fails loudly")
    import importlib
    import app.services.crypto
    
    with patch.dict(os.environ, clear=True):
        if "ENCRYPTION_KEY" in os.environ:
            del os.environ["ENCRYPTION_KEY"]
            
        # Bypass frozen instance error
        object.__setattr__(settings, "encryption_key", None)
        try:
            importlib.reload(app.services.crypto)
            print("❌ FAIL: Module reload should have failed with RuntimeError!")
        except RuntimeError as e:
            if "ENCRYPTION_KEY is required" in str(e):
                print("✅ SUCCESS: App startup prevented securely with explicit error.")
            else:
                print(f"❌ FAIL: Wrong RuntimeError: {e}")
        finally:
            object.__setattr__(settings, "encryption_key", "F8Z9xU9xJ4UuE1Wv6XQ8Q7c8q2l3Z1Vb1u2P0X9wG5I=")

if __name__ == "__main__":
    asyncio.run(run_tests())
