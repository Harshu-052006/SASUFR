# SASUFR (Smart Attendance System Using Face Recognition) - Full Context Guide

This document is designed to provide Claude AI (or any other LLM) with a complete understanding of the SASUFR project structure, architecture, and business logic.

## 1. Project Overview
**SASUFR** is a modern, full-stack web application designed to automate and secure the attendance tracking process for educational institutions. It eliminates manual roll-calls by leveraging facial recognition technology, geofencing, and OTP-based email verification.

## 2. Core Architecture & Tech Stack
- **Backend**: Python with FastAPI (Asynchronous, High-performance)
- **Database**: MongoDB (accessed asynchronously via the Motor driver)
- **Biometrics Engine**: `face_recognition` and `dlib` (used for extracting facial encodings and similarity matching)
- **Authentication**: JWT (JSON Web Tokens) via PyJWT and OTP verification.
- **Modern Frontend (`frontend/`)**: React 19, Vite, TypeScript, Tailwind CSS, and Lucide React.
- **Legacy Frontend (`frontend-legacy/`)**: Vanilla HTML/CSS/JavaScript (historically served statically via FastAPI).

## 3. Directory Structure
```text
SASUFR Root/
├── backend/                  # FastAPI Application
│   ├── main.py               # App entry point, startup hooks, static mounts
│   ├── requirements.txt      # Python dependencies
│   └── app/
│       ├── routes/           # API Endpoints (admin.py, auth.py, teacher.py, student.py, etc.)
│       ├── services/         # Core Business Logic (face_service.py, attendance_service.py, etc.)
│       ├── database/         # Motor DB client, indexes, counters
│       └── utils/            # Helpers (geo.py for Haversine, security.py for hashing/JWT, time.py)
├── frontend/                 # New React/Vite Application
│   ├── package.json          # Node dependencies
│   ├── tailwind.config.js    # Tailwind configuration
│   └── src/                  # React components, pages, and hooks
├── frontend-legacy/          # Original Vanilla JS Application
│   ├── admin_*.html          # Admin views
│   ├── teacher_*.html        # Teacher views
│   ├── user_*.html           # Student views
│   └── js/, css/             # Scripts and styles
├── Smart_Attendance_FullStack.md  # Deep architectural documentation
└── project_description.md         # High-level feature documentation
```

## 4. Database Models (MongoDB)
- **`users`**: Stores user identity and biometrics.
  - Fields: `id`, `full_name`, `email`, `role`, `face_encoding` (numpy array stored as list), `face_image`, `hashed_password`, `is_active`.
- **`attendance`**: Stores daily logs for students.
  - Fields: `user_id`, `date`, `status` (Present/Absent/Late), `check_in`, `method` (Face/Manual), `latitude`, `longitude`.
- **`security_logs`**: Tracks sensitive actions and potential threats.
  - Fields: `event_type`, `severity`, `details`, `metadata`, `ip_address`.
- **`config`** & **`counters`**: 
  - `config` holds global settings like geofencing coordinates and absent-notice cutoffs.
  - `counters` manages auto-incrementing sequential IDs.

## 5. User Roles and Workflows

### A. Students
- **Enrollment**: Register via their institutional email (OTP verified). They capture a baseline face image which `face_service.py` converts into an encoding.
- **Self-Service Attendance**: Students mark their own attendance at the classroom door using their device's camera.
- **Validation**: The system cross-references their face and GPS location (using the Haversine formula to ensure they are inside the campus geofence).

### B. Faculty (Teachers)
- **Session Management**: Initiate 30-minute active attendance windows for specific subjects.
- **Live Monitoring**: View real-time dashboards showing who is present, late, or unmarked.
- **Overrides & Actions**: Manually mark students present for edge cases, and dispatch automated absent alerts to unmarked students.

### C. Administrators
- **System Telemetry**: Monitor system enrollment, security logs, and attendance processing.
- **User Lifecycle**: Approve, suspend, or reset user accounts.
- **Global Settings**: Configure geofencing coordinates, allowed email domains, and facial recognition tolerance levels.

## 6. Key Business Logic & Security Constraints
- **Anti-Spoofing & Duplicate Detection**: During enrollment, the extracted face encoding is compared against all existing active student encodings. If a duplicate is found, the system suspends the account, rejects the registration, and logs a critical security event.
- **Geofencing**: Self-marking attendance will fail if the student's reported GPS coordinates are outside the configured Haversine distance from the campus center.
- **Rate Limiting**: `slowapi` is integrated across endpoints to defend against brute-force attacks (e.g., on login or OTP routes).

## 7. Instructions for Claude AI
When assisting with this project, strictly adhere to the following rules:
1. **Frontend Context**: Determine if the user is working on the modern React app (`frontend/`) or the vanilla JS app (`frontend-legacy/`). Default to assuming new work happens in the React app unless specified otherwise.
2. **Backend Separation of Concerns**: Keep API routing in `backend/app/routes/` and complex business logic in `backend/app/services/`. Do not pollute routes with heavy logic.
3. **Async Database**: All database interactions must use the async `motor` client. Avoid blocking calls.
4. **Biometric Integrity**: Any modifications to `face_service.py` must preserve the strict duplicate detection and image validation checks to prevent biometric spoofing.
5. **Timezones**: Time logic is primarily configured around IST (Indian Standard Time). Rely on `backend/app/utils/time.py` for date/time formatting.
