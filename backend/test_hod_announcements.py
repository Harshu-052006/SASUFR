import asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta
import sys
from mongomock_motor import AsyncMongoMockClient

from main import app
from app.dependencies import get_current_user, get_database
from app.utils.time import iso_ist

# Mock users
student_a = {"id": 1001, "role": "student", "department": "DeptA"}
teacher_a = {"id": 1002, "role": "teacher", "department": "DeptA"}
hod_a = {"id": 1003, "role": "hod", "department": "DeptA"}
hod_b = {"id": 1004, "role": "hod", "department": "DeptB"}
student_b = {"id": 1005, "role": "student", "department": "DeptB"}

current_mock_user = student_a
mock_db = AsyncMongoMockClient()["sasufr"]

async def mock_get_current_user():
    return current_mock_user

async def mock_get_database():
    return mock_db

app.dependency_overrides[get_current_user] = mock_get_current_user
app.dependency_overrides[get_database] = mock_get_database

async def run_tests():
    global current_mock_user
    
    # We will use an ASGITransport with AsyncClient to handle requests properly
    transport = ASGITransport(app=app)
    
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger lifespan events manually if needed, but ASGITransport handles lifespan.
        
        # Setup: Clear existing test announcements
        await mock_db.announcements.delete_many({"department": {"$in": ["DeptA", "DeptB"]}})

        print("\n--- Running Test 1 & 2 & 7: Only HOD can POST, correct department, no _id leak ---")
        
        # 1. Student attempt
        current_mock_user = student_a
        res = await client.post("/hod/announcements", json={"message": "Student msg", "expires_at": "2099-01-01T00:00:00Z"})
        assert res.status_code == 403
        print("✓ Student POST rejected (403)")

        # 1. Teacher attempt
        current_mock_user = teacher_a
        res = await client.post("/hod/announcements", json={"message": "Teacher msg", "expires_at": "2099-01-01T00:00:00Z"})
        assert res.status_code == 403
        print("✓ Teacher POST rejected (403)")
        
        # HOD A attempt
        current_mock_user = hod_a
        future_date = (datetime.now() + timedelta(days=1)).isoformat() + "Z"
        res = await client.post("/hod/announcements", json={"message": "HOD A Active", "expires_at": future_date})
        assert res.status_code == 200, res.text
        data = res.json()
        print("✓ HOD POST successful")
        
        # 2. Check department is from current_user
        assert data["department"] == "DeptA"
        print("✓ Department matches HOD's department (DeptA)")
        
        # 7. Check _id leak
        assert "_id" not in data
        assert "id" in data
        print("✓ No raw '_id' in POST response")
        
        ann_id_a = data["id"]
        
        # Create an expired announcement for HOD A
        past_date = (datetime.now() - timedelta(days=1)).isoformat() + "Z"
        res = await client.post("/hod/announcements", json={"message": "HOD A Expired", "expires_at": past_date})
        assert res.status_code == 200
        
        # Create an active announcement for HOD B
        current_mock_user = hod_b
        res = await client.post("/hod/announcements", json={"message": "HOD B Active", "expires_at": future_date})
        assert res.status_code == 200
        ann_id_b = res.json()["id"]

        print("\n--- Running Test 3 & 4: Active excludes expired, Isolation ---")
        
        # Student A fetches active
        current_mock_user = student_a
        res = await client.get("/announcements/active")
        assert res.status_code == 200
        active_a = res.json()
        
        messages = [a["message"] for a in active_a]
        
        # 3. Excludes expired
        assert "HOD A Expired" not in messages
        print("✓ GET /announcements/active correctly excludes expired announcements")
        
        # 4. Doesn't see Dept B
        assert "HOD B Active" not in messages
        assert "HOD A Active" in messages
        print("✓ User in DeptA does not see DeptB announcements")
        
        # Double check DeptB user
        current_mock_user = student_b
        res = await client.get("/announcements/active")
        active_b = res.json()
        messages_b = [a["message"] for a in active_b]
        assert "HOD B Active" in messages_b
        assert "HOD A Active" not in messages_b

        print("\n--- Running Test 6: HOD cannot expire another department's announcement ---")
        current_mock_user = hod_a
        res = await client.patch(f"/hod/announcements/{ann_id_b}/expire")
        assert res.status_code == 403
        print("✓ HOD from DeptA cannot expire DeptB's announcement (403)")
        
        print("\n--- Running Test 5 & 7: HOD can expire own, affects GET active, no _id leak ---")
        current_mock_user = hod_a
        res = await client.patch(f"/hod/announcements/{ann_id_a}/expire")
        assert res.status_code == 200
        patch_data = res.json()
        
        # 7. Check leak on PATCH
        assert "_id" not in patch_data
        print("✓ No raw '_id' in PATCH response")
        
        # Fetch active again
        current_mock_user = student_a
        res = await client.get("/announcements/active")
        active_a_after = res.json()
        messages_after = [a["message"] for a in active_a_after]
        assert "HOD A Active" not in messages_after
        print("✓ PATCH correctly expired the announcement and it is no longer returned in GET /active")
        
        print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    asyncio.run(run_tests())
