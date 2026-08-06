# Logic and Flow Breaks Fixes

This plan outlines the necessary fixes for the five critical issues identified in the backend logic. 

## User Review Required

Please review the proposed approach for Issue 5 (Geofencing Bypass). Since the backend natively relies on the client's provided latitude and longitude, completely preventing GPS spoofing requires client-side changes (such as utilizing native secure location APIs or app attestation). The backend alone cannot perfectly trust coordinates. I propose we proceed with the other fixes first, and optionally log client IPs for potential manual audits as a mitigation.

## Proposed Changes

---

### Backend Database Logic

#### [MODIFY] [mongo.py](file:///c:/Users/Admin/Downloads/Telegram%20Desktop/Smart-Attendance-System-Using-Face-Recognition-main/backend/app/database/mongo.py)
- **Change**: Update the unique index for the `attendance` collection to include `session_id`.
- **Details**: Change `await database.attendance.create_index([("user_id", ASCENDING), ("date", ASCENDING)], unique=True)` to `await database.attendance.create_index([("user_id", ASCENDING), ("date", ASCENDING), ("session_id", ASCENDING)], unique=True)`. This allows multiple distinct session check-ins per day for a single user, plus a single non-session (daily) check-in if `session_id` is null.

---

### Attendance Service

#### [MODIFY] [attendance_service.py](file:///c:/Users/Admin/Downloads/Telegram%20Desktop/Smart-Attendance-System-Using-Face-Recognition-main/backend/app/services/attendance_service.py)
- **Change**: Fix `_insert_or_update_attendance` uniqueness query.
- **Details**: Update the query to include `session_id` to prevent collisions when a student marks attendance for multiple sessions on the same day.
  ```python
  query = {"user_id": user["id"], "date": today}
  if session_id is not None:
      query["session_id"] = session_id
  else:
      query["session_id"] = None
  ```
- **Change**: Merge V1 & V2 support in `mark_student_self_attendance`.
- **Details**: Try parsing the incoming `session_id` as an `int` for V1 (`class_sessions`). If it fails, treat it as a UUID for V2 (`session_logs`). Apply the appropriate validation checks (`department` for V1 vs `target_group_type` for V2) and status checks (`"active"` vs `"ONGOING"`). 

---

### Face Service

#### [MODIFY] [face_service.py](file:///c:/Users/Admin/Downloads/Telegram%20Desktop/Smart-Attendance-System-Using-Face-Recognition-main/backend/app/services/face_service.py)
- **Change**: Correct the liveness check head turn direction logic.
- **Details**: Swap the logic inside the `turn_left` and `turn_right` conditions so that turning left correctly checks if `dist_right_eye >= dist_left_eye * 0.9` (nose moving towards the left side of the physical face/image right eye).

---

### Routes & Schemas

#### [MODIFY] [attendance.py](file:///c:/Users/Admin/Downloads/Telegram%20Desktop/Smart-Attendance-System-Using-Face-Recognition-main/backend/app/routes/attendance.py)
- **Change**: Fix attendance percentage recalculation discrepancy.
- **Details**: Update the `/attendance/me/stats` route to return the correctly calculated `stats.attendance_percentage` from the service layer instead of improperly recalculating it by ignoring `late_days`.

#### [MODIFY] [schemas.py](file:///c:/Users/Admin/Downloads/Telegram%20Desktop/Smart-Attendance-System-Using-Face-Recognition-main/backend/app/schemas.py)
- **Change**: Adjust `StudentSelfAttendanceRequest` and `AttendanceOut` schemas.
- **Details**: Change `session_id` typing from `int` to `str | int` in `StudentSelfAttendanceRequest` to seamlessly support both V1 (integer IDs) and V2 (UUIDs). Update `AttendanceOut`'s `session_id` similarly.

## Verification Plan

### Automated/Manual Tests
- Attempt to check-in for two different sessions on the same day to ensure uniqueness logic holds.
- Verify `turn_left` failure/success using test encodings or manually reviewing the logic.
- Send a V2 string UUID session ID to the self attendance route and verify it successfully logs.
- Fetch stats from `/attendance/me/stats` to verify it matches the detailed history percentage.
