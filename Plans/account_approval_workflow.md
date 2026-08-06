# Secure Account Registration & Approval Workflow

This plan outlines the architectural changes required to prevent fake profile creation, ensure only legitimate users access the system, properly route students to their specific classes, and manage faculty permissions.

## 1. Preventing Fake Profiles (Verification Strategy)
We will use a dual-track strategy tailored to the user's role:
- **For Faculty/Staff:** ID Card Upload + Manual Admin Approval Queue.
- **For Students:** Automated Verification via Whitelist + Domain Validation (Zero Admin Effort).
  - **Primary Check**: The Admin uploads a CSV of valid student Roll Numbers.
  - **Backup Check**: If a student is a late admission, they must register using the official organization email domain (e.g., `@yourcollege.edu`).

## 2. Targeting the Right Students (Handling Programs & Elective Subjects)
Currently, if a teacher starts a session, all students in the entire department get the notification banner. This is flawed because a single department can have multiple programs, and students take different optional/elective subjects.

**The Solution: Subject-Based Routing**
We will implement an **Enrollment Mapping** system:
1. **Programs & Subjects**: We will add a `program` (e.g., "BCA") and a list of `enrolled_subjects` (e.g., `["Java", "Web Dev"]`) to the Student Profile.
2. **Whitelist Assignment**: The Admin's CSV whitelist will include columns for the student's Program and their comma-separated Subjects. When a student registers, their enrolled subjects are automatically pulled from the whitelist and saved to their profile.
3. **Session Filtering**: When a Teacher starts a Live Session, they specify the `program` and `subject`. The backend will filter the active sessions so that the Live Class Banner is **only** sent to students who actually have that exact subject in their `enrolled_subjects` list. 

## 3. Teacher Hierarchy (Different Roles for Faculty)
Not all teachers have the same responsibilities. We will introduce a **Faculty Designation/Role** system.

Since teachers already know their roles, **they will select their specific role from a dropdown during registration**:
- **HOD (Head of Department)**: Elevated access. Can view reports and attendance stats for all students and classes across the entire department.
- **Professor / Assistant Professor**: Standard access. Can start sessions, mark attendance, and view stats only for the subjects they teach.
- **Lab Assistant / Guest Lecturer**: Restricted access. Can start sessions and mark attendance, but may have limited access to overarching historical reports.

The Admin does not need to guess or manually assign these roles. The Admin simply reviews the requested role and uploaded ID card in the Pending Queue, and clicks "Approve" to let them in!

## 4. How We Are Going to Implement It

### A. Database Changes
- Modify the user schema to track `approval_status` (`"pending"`, `"approved"`, `"rejected"`).
- Modify the user schema to track `designation` for teachers (e.g., `"HOD"`, `"Professor"`).
- Modify the student schema to include `program` (String) and `enrolled_subjects` (Array of Strings).
- Create `valid_students` collection to store pre-approved roll numbers along with their assigned `program` and `subjects`.
- Create `global_settings` collection to store the official organization email domain.

### B. Registration Flow
- Add a role dropdown (Student/Faculty) to the registration form.
- **For Faculty Registration**: 
  - They select their own Designation (HOD, Professor, etc.).
  - They must upload a photo of their ID Card. 
  - Account is set to `approval_status = "pending"`. They cannot log in until an admin approves.
- **For Student Registration**: 
  - The system checks if their Roll Number exists in the `valid_students` collection. If it does, it copies their `program` and `enrolled_subjects` over.
  - If EITHER the Whitelist check OR Domain check passes, they are auto-approved.

### C. Backend Session Filtering & Permissions
- **Students**: Update `GET /student/sessions/active`. The API will only return sessions where the session's `subject` is inside the student's `enrolled_subjects` array.
- **Teachers**: Update the analytics endpoints. If a teacher's designation is "HOD", they can fetch department-wide stats. If they are a standard Professor, they only fetch stats for sessions they personally created.

### D. Admin Dashboard
- **Faculty Approvals Tab**: Interface for the admin to review pending faculty registrations, view their requested role and ID card, and click Approve or Reject.
- **Student Whitelist Importer**: A tool to upload the CSV list of valid students.
