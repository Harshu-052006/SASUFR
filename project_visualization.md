# Smart Attendance System - Workflows & Visualizations

You can use the following [Mermaid](https://mermaid.js.org/) diagrams to visualize the architecture, data flow, and core workflows of the Smart Attendance System. Most modern markdown viewers (like GitHub, VS Code, and Obsidian) natively support rendering these diagrams.

---

## 1. High-Level Architecture

This diagram visualizes the overall system components: the FastAPI backend, the MongoDB database, and the frontend interfaces.

```mermaid
graph TD
    %% Frontend Interfaces
    subgraph Frontend [Frontend HTML JS CSS]
        UI_Student[Student Dashboard]
        UI_Teacher[Teacher Dashboard]
        UI_Admin[Admin Dashboard]
        UI_Auth[Authentication Pages]
    end

    %% Backend Services
    subgraph Backend [FastAPI Backend]
        API_Auth[Auth Service JWT OTP]
        API_Admin[Admin Service]
        API_Attendance[Attendance Service]
        API_Users[User Service]
        
        %% Core Logic
        FaceRec[Face Recognition Engine]
    end

    %% Database Layer
    subgraph Database [MongoDB]
        DB_Users[(Users Collection)]
        DB_Valid[(Valid Students Whitelist)]
        DB_Sessions[(Class Sessions)]
        DB_Attendance[(Attendance Logs)]
        DB_Counters[(ID Counters)]
    end

    %% Connections
    UI_Auth -->|Login/Register| API_Auth
    UI_Student -->|View Stats/Sessions| API_Attendance
    UI_Teacher -->|Start Session/Mark| API_Attendance
    UI_Admin -->|Manage Users/Settings| API_Admin

    API_Auth --> DB_Users
    API_Auth --> DB_Valid
    
    API_Attendance --> FaceRec
    API_Attendance --> DB_Sessions
    API_Attendance --> DB_Attendance
    
    API_Admin --> DB_Users
    API_Admin --> DB_Valid
    API_Admin --> DB_Counters
```

---

## 2. Authentication & Account Approval Workflow

Visualizes how different roles (Students, Faculty, Admins) are registered, verified, and approved.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend
    participant API as FastAPI (Auth)
    participant DB as MongoDB

    User->>Frontend: Fills Registration Form
    Frontend->>API: POST /register
    
    alt is Student
        API->>DB: Check roll_number in valid_students
        alt Found in Whitelist
            API->>DB: Create User (Approved & Active)
            API-->>Frontend: Success (Please login)
        else Not Found
            API-->>Frontend: Error (Not in whitelist/domain)
        end
    else is Teacher
        API->>DB: Create User (Pending & Inactive)
        API-->>Frontend: Success (Awaiting Admin Approval)
    end

    %% Admin Approval Flow
    actor Admin
    Admin->>Frontend: Clicks "Approve" on Teacher
    Frontend->>API: POST /admin/approve
    API->>DB: Update approval_status="approved", is_active=true
    API-->>Frontend: User Approved
```

---

## 3. Class Session & Face Recognition Attendance Workflow

Visualizes the core feature: how a teacher starts a session and how students mark their attendance using facial recognition.

```mermaid
sequenceDiagram
    autonumber
    actor Teacher
    participant Frontend as Web Dashboard
    participant API as FastAPI Backend
    participant DB as MongoDB
    actor Student

    %% Teacher Starts Session
    Teacher->>Frontend: Select Department & Start Session
    Frontend->>API: POST /teacher/sessions/start
    API->>DB: Create Session Record (Active)
    API-->>Frontend: Session Started Successfully

    %% Student Notification
    DB-->>Student: (Realtime) Dashboard updates with Active Session

    %% Student Marks Attendance
    Student->>Frontend: Clicks "Mark Attendance"
    Frontend->>Frontend: Captures Webcam Image
    Frontend->>API: POST /student/attendance/mark (Base64 Image)
    
    %% Processing
    API->>API: Run Face Recognition (Compare w/ Profile)
    alt Match Successful
        API->>DB: Record Attendance (Status: Present)
        API-->>Frontend: Success (Attendance Marked)
    else Match Failed
        API-->>Frontend: Error (Face mismatch / Not recognized)
    end

    %% Teacher Ends Session
    Teacher->>Frontend: Clicks "End Session"
    Frontend->>API: POST /teacher/sessions/end
    API->>DB: Update Session (Inactive)
    API->>DB: Mark absent for students who missed it
    API-->>Frontend: Session Ended
```

---

## 4. Admin CSV Import Workflow

Visualizes how admins can bulk-upload users via CSV.

```mermaid
flowchart TD
    A[Admin Uploads CSV] --> B{Does CSV contain 'password' & 'role'?}
    
    B -- Yes (Direct Import) --> C[Hash Passwords]
    C --> D[Preserve specific IDs from CSV]
    D --> E[Insert directly into Users Collection]
    E --> F[Update Database Auto-Increment Counter]
    
    B -- No (Whitelist Import) --> G[Extract roll_number & email]
    G --> H[Insert into valid_students Collection]
    
    F --> I([Users instantly available for Login])
    H --> J([Students can now self-register])
```
