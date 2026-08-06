from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List

async def check_timetable_conflicts(db: AsyncIOMotorDatabase, day_of_week: str, start_time: str, end_time: str, allocations: List[dict]):
    """
    Validates room and faculty conflicts across all timetables (v2) for the given day and time slot.
    Returns (True, None) if valid, or (False, ErrorMessage) if there's a conflict.
    """
    # 1. Fetch all overlapping slots for the same day
    # Assuming start_time and end_time are string formats "HH:MM" (e.g. "10:15")
    # For simplicity, we just check exact overlaps or if the requested time falls within any existing slot.
    # An overlap exists if: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
    
    cursor = db.timetables_v2.find({
        "day_of_week": day_of_week,
        "start_time": {"$lt": end_time},
        "end_time": {"$gt": start_time}
    })
    
    existing_slots = await cursor.to_list(length=None)
    
    used_rooms = set()
    used_teachers = set()
    busy_student_batches = set()
    busy_sub_batches = set()
    busy_elective_groups = set()
    
    for slot in existing_slots:
        for alloc in slot.get("allocations", []):
            if alloc.get("room_id"):
                used_rooms.add(alloc["room_id"])
            if alloc.get("teacher_id"):
                used_teachers.add(alloc["teacher_id"])
            if alloc.get("batch_id"):
                busy_student_batches.add(alloc["batch_id"])
            if alloc.get("sub_batch_id"):
                busy_sub_batches.add(alloc["sub_batch_id"])
            if alloc.get("elective_group_id"):
                busy_elective_groups.add(alloc["elective_group_id"])
                
    # 2. Check the new allocations against the used sets
    for alloc in allocations:
        room_id = alloc.get("room_id")
        teacher_id = alloc.get("teacher_id")
        batch_id = alloc.get("batch_id")
        sub_batch_id = alloc.get("sub_batch_id")
        elective_group_id = alloc.get("elective_group_id")
        
        if room_id and room_id in used_rooms:
            return False, f"RoomCollisionError: Room {room_id} is already booked during this time."
            
        if teacher_id and teacher_id in used_teachers:
            return False, f"TeacherDoubleBookingError: Faculty ID {teacher_id} is already scheduled during this time."
            
        if elective_group_id and elective_group_id in busy_elective_groups:
            return False, f"ElectiveGroupConflictError: Elective group {elective_group_id} is already scheduled."
            
        # 3. Sub-batch integrity: A student can't be in a whole-batch lecture and a sub-batch practical at the same time
        if batch_id:
            if batch_id in busy_student_batches:
                return False, f"BatchConflictError: Batch {batch_id} is already scheduled."
            # Also check if any sub-batches of this batch are busy
            cursor_sb = db.sub_batches.find({"parent_batch_id": batch_id})
            sub_batches = await cursor_sb.to_list(length=None)
            for sb in sub_batches:
                if sb["id"] in busy_sub_batches:
                    return False, f"BatchConflictError: Sub-batch {sb['id']} of Batch {batch_id} is already scheduled."
                    
        if sub_batch_id:
            if sub_batch_id in busy_sub_batches:
                return False, f"SubBatchConflictError: Sub-batch {sub_batch_id} is already scheduled."
            
            # Find the parent batch of this sub-batch to ensure the parent isn't busy
            sb_doc = await db.sub_batches.find_one({"id": sub_batch_id})
            if sb_doc:
                parent_batch = sb_doc.get("parent_batch_id")
                if parent_batch and parent_batch in busy_student_batches:
                    return False, f"BatchConflictError: Parent batch {parent_batch} is already scheduled for a full-class session."

    return True, None
