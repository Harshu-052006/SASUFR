import asyncio
from datetime import datetime, timedelta
from app.database.mongo import get_database
from app.services.email_service import send_upcoming_lecture_notice

async def upcoming_lecture_worker():
    while True:
        try:
            db = await get_database()
            now = datetime.now()
            # Look for lectures starting in exactly 15 minutes (give or take a minute)
            target_time = now + timedelta(minutes=15)
            target_time_str = target_time.strftime("%H:%M")
            day_name = now.strftime("%A")
            
            cursor = db.timetables.find({
                "day_of_week": day_name,
                "start_time": target_time_str
            })
            
            async for tt in cursor:
                teacher_id = tt.get("teacher_id")
                if teacher_id:
                    teacher = await db.users.find_one({"id": teacher_id, "role": "teacher"})
                    if teacher and teacher.get("email"):
                        class_details = f"{tt.get('department')} {tt.get('class_year')}"
                        if tt.get("batch_id"):
                            class_details += f" Batch {tt.get('batch_id')}"
                            
                        await send_upcoming_lecture_notice(
                            email=teacher["email"],
                            teacher_name=teacher.get("full_name") or teacher.get("email"),
                            subject=tt.get("subject"),
                            class_details=class_details,
                            time=tt.get("start_time")
                        )
            
            # Sleep for 60 seconds before checking again
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in upcoming_lecture_worker: {e}")
            await asyncio.sleep(60)
