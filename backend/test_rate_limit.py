from __future__ import annotations

import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app


def test_rate_limiting():
    with TestClient(app) as client:
        print("--- Starting Auth Endpoint Rate Limiting Tests ---")

        # --- 1. Test /register rate limiting ---
        print("\nTesting /register rate limit (5/minute)...")
        for i in range(1, 7):
            res = client.post("/register", json={
                "full_name": f"Test Student {i}",
                "roll_number": f"testroll{i}",
                "email": f"test_student_rate_{i}@example.com",
                "department": "Computer Science",
                "password": "Password123",
                "face_image": "dummy_base64"
            })
            print(f"Request {i}: Status Code = {res.status_code}")
            if i <= 5:
                # Prior requests should either succeed or return standard validation/domain errors (not 429)
                assert res.status_code != 429, f"Unexpected 429 on request {i}: {res.json()}"
            else:
                # 6th request must be blocked with 429
                assert res.status_code == 429, f"Expected 429 on request {i}, but got {res.status_code}"
                print("Success: /register 6th request got 429 Too Many Requests.")

        # --- 2. Test /verify-otp rate limiting ---
        print("\nTesting /verify-otp rate limit (5/minute)...")
        for i in range(1, 7):
            res = client.post("/verify-otp", json={
                "email": "test_verify_rate@example.com",
                "otp": f"{i:06d}"
            })
            print(f"Request {i}: Status Code = {res.status_code}")
            if i <= 5:
                # Should not be 429
                assert res.status_code != 429, f"Unexpected 429 on request {i}: {res.json()}"
            else:
                # 6th request must be blocked with 429
                assert res.status_code == 429, f"Expected 429 on request {i}, but got {res.status_code}"
                print("Success: /verify-otp 6th request got 429 Too Many Requests.")

        # --- 3. Test /reset-password rate limiting ---
        print("\nTesting /reset-password rate limit (5/minute)...")
        for i in range(1, 7):
            res = client.post("/reset-password", json={
                "email": "test_reset_rate@example.com",
                "otp": f"{i:06d}",
                "new_password": "NewPassword123"
            })
            print(f"Request {i}: Status Code = {res.status_code}")
            if i <= 5:
                assert res.status_code != 429, f"Unexpected 429 on request {i}: {res.json()}"
            else:
                assert res.status_code == 429, f"Expected 429 on request {i}, but got {res.status_code}"
                print("Success: /reset-password 6th request got 429 Too Many Requests.")

        print("\n--- ALL RATE LIMITING TESTS PASSED SUCCESSFULLY! ---")


if __name__ == "__main__":
    test_rate_limiting()
