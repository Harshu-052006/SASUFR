# Smart Attendance System Using Face Recognition

## Overview
The Smart Attendance System is a modern, full-stack web application designed to automate and secure the attendance tracking process for educational institutions. It leverages facial recognition technology, geofencing, and OTP-based verification to ensure attendance is recorded accurately and reliably. The platform provides dedicated interfaces for Students, Faculty (Teachers), and Administrators, seamlessly integrating complex biometric operations into a clean, glassmorphism-styled UI.

## Core Architecture
- **Backend:** Powered by **FastAPI** for high-performance, asynchronous API routes.
- **Database:** **MongoDB** (accessed via Motor) provides flexible document storage for users, attendance logs, and security events.
- **Frontend:** Built with **Vanilla HTML/CSS/JavaScript**, delivering a lightweight, fast, and responsive user experience without heavy frameworks.
- **Biometrics:** Integrates `face_recognition` and `dlib` for extracting facial encodings and matching student scans against their enrolled profiles.

## Key Features

### 1. Student Portal
- **Biometric Enrollment:** Students register by capturing a baseline face image. Identity is verified via OTP sent to their institutional email.
- **Self-Service Attendance:** Students mark their own attendance at the classroom door using their device's camera. The system cross-references their face and GPS location (geofencing) to ensure they are physically present.
- **Dashboard:** Provides a calendar view of attendance history, punctuality stats, and profile management tools.

### 2. Faculty Hub (Teacher Portal)
- **Class Session Management:** Faculty can initialize 30-minute attendance windows for specific subjects and classes.
- **Live Monitoring:** Real-time dashboards display attendance metrics, tracking students who are present, late, or unmarked.
- **Manual Overrides:** Teachers retain the ability to manually mark students present for edge cases.
- **Automated Notifications:** One-click dispatch of absent alerts to all unmarked students after a session concludes.
- **Departmental Analytics:** Deep insights into average attendance, peak times, and system accuracy specific to the teacher's department.

### 3. Administrator Dashboard
- **System Telemetry:** Real-time metrics on total system enrollment, security logs, and attendance processing.
- **User Lifecycle:** Tools to approve, suspend, or reset user accounts.
- **Global Settings:** Configuration of geofencing coordinates, allowed email domains, and facial recognition tolerance levels.

---

## What's New (Recent Enhancements)

The system has been recently upgraded to introduce more robustness, customization, and security:

- **API Rate Limiting:** Integrated `slowapi` across the backend endpoints to defend against brute-force attacks and ensure fair usage of system resources.
- **Dynamic UI Terminology:** Implemented a robust frontend terminology mapping system (`js/terminology.js`). This allows institutional terms (e.g., swapping "teacher" for "faculty", or "student" for "learner") to be customized dynamically across the HTML views via `data-term` attributes.
- **Enhanced Session Controls:** Faculty can now explicitly define the **Lecture Start Time** and **Lecture End Time** when opening an automated 30-minute attendance window, providing finer-grained control over scheduling.
- **Student Attendance Requests:** Refined the handling of student requests for self-marking attendance (e.g. `StudentSelfAttendanceRequest`), streamlining the facial recognition and geofencing validation flow during active sessions.
- **Advanced Export Capabilities:** Upgraded the Faculty Hub's Report Generator to allow Daily, Weekly, Monthly, Yearly, and Custom date ranges, exporting directly to Excel or PDF.
- **Automated Bootstrapping & Testing:** Refined the `create_admin.py` utility for seamless database initialization. Added `test_func.py` to allow direct debugging and validation of the facial encoding extraction and matching pipeline against the MongoDB dataset.

## Books, Research Papers, & Documentation

- **dlib C++ Library Reference:** http://dlib.net/
- **Facebook AI Similarity Search (FAISS) Docs:** https://github.com/facebookresearch/faiss
- **Haversine Formula for Spatial Distance Calculations:** https://en.wikipedia.org/wiki/Haversine_formula
- **ReportLab PDF Generation User Guide:** https://www.reportlab.com/documentation/