import sys
if sys.platform == 'win32':
    try:
        import dns.win32util
        dns.win32util.set_config_method(dns.win32util.ConfigMethod.Registry)
    except Exception:
        pass

import asyncio
import motor.motor_asyncio
import os

# Add backend to path to import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.face_service import extract_multiple_encodings, find_matches

async def main():
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient("mongodb+srv://shingareharshwardhan521_db_user:0OQ3gZQ83rrduPQ1@cluster1.jqup5p7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1&tlsAllowInvalidCertificates=true")
        db = client.smart_attendance
        
        student = await db.users.find_one({"role": "student"})
        if not student:
            print("No student found")
            return
            
        print(f"Testing with student {student.get('email')}")
        
        image_data = student.get("face_image")
        if not image_data:
            print("No face_image found for student")
            return
            
        print("Extracting encodings...")
        candidates = await extract_multiple_encodings(image_data)
        print(f"Extracted {len(candidates)} candidates.")
        
        print("Finding matches...")
        matches = await find_matches(candidates, [student])
        print(f"Matches: {matches}")
        
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
