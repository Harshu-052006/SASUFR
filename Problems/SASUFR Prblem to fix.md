# SASUFR — Consolidated Problems & Fixes

**Project:** Smart Attendance System Using Face Recognition (SASUFR)
**Stack:** FastAPI (Python 3.11+) · MongoDB/Motor · face_recognition/dlib · Vanilla HTML/CSS/JS frontend
**Purpose of this document:** A single, prioritized list of known issues and required fixes, written so an engineering agent can pick up any item and implement it without needing additional context. Each item includes the problem, why it matters, and a concrete fix direction.

---

## How to use this document

Work top-down by priority tier. Within a tier, items are independent unless a "Depends on" note says otherwise. Each fix should be implemented as its own change/PR where possible, since several touch the same files (`main.py`, `app/services/attendance.py`, `app/routes/*`, `frontend/js/*`).

---

## Tier 1 — Security (fix before any real deployment)

### 1.1 Static admin password reset
**Problem:** Admin password resets set the temporary password to the hardcoded string `SASUFR` for every account.
**Risk:** Anyone aware of this convention has standing credentials to any reset account.
**Fix:** Generate a cryptographically random one-time temporary password per reset, force a password change on first login after reset, and expire the temp password after a short window (e.g., 24h) if unused.

### 1.2 Weak face liveness challenge
**Problem:** Liveness detection is a left/right head-turn challenge only.
**Risk:** Defeatable with a pre-recorded video played on a second screen.
**Fix:** Randomize challenge order/type per attempt, add a second signal (e.g., blink detection or a randomized prompt sequence), and consider rate-limiting repeated liveness failures per session to slow down automated bypass attempts.

### 1.3 CSV bulk-import ID collisions
**Problem:** Admin CSV "direct import" preserves IDs from the CSV and inserts directly into the Users collection, then updates the counter.
**Risk:** If a CSV row's ID is lower than or equal to the current counter, later auto-created users can collide with or silently overwrite imported records.
**Fix:** On import, set the counter to `max(current_counter, highest_imported_id)`, and validate/reject CSV rows whose IDs already exist in the Users collection before insert.

### 1.4 Registration domain check is a weak identity gate
**Problem:** Registration only restricts to Gmail addresses; the real gate is roll-number-in-whitelist.
**Risk:** If whitelist validation has any bypass path or lacks rate limiting on `/register`, account creation is under-protected.
**Fix:** Confirm and test rate limiting is applied specifically to `/register` and `/verify-otp` (not just globally via slowapi defaults), and add server-side logging/alerting on repeated failed whitelist checks from the same IP.

### 1.5 Biometric data at rest
**Problem:** No stated encryption for stored face encodings.
**Risk:** Face encodings are regulated biometric data in many jurisdictions even though not reversible to a photo.
**Fix:** Add field-level encryption (or Mongo-level encryption at rest) for the encoding field, and document the encryption approach for compliance review.

---

## Tier 2 — Data integrity / correctness

### 2.1 Geofencing can't distinguish adjacent rooms
**Problem:** A student physically in Hall 209 can mark attendance for a lecture happening in Hall 208, because GPS-based geofencing (~5–15m indoor accuracy) can't resolve room-level precision.
**Fix:** Keep GPS as a coarse "on campus" filter. Add a room-precision secondary signal per Class Session — either:
  - Wi-Fi BSSID matching (store expected AP BSSID(s) per room on the session record), or
  - A session-specific QR code/PIN shown only in the classroom when the session opens, scanned/entered alongside the existing face+GPS check.

### 2.2 No way to mark a student absent after they leave early
**Problem:** Attendance is a single mark-at-start event; there's no signal if a student leaves mid-session.
**Fix:** Add a teacher-facing "Mark Left / Revoke Attendance" action on the live session view that flips a student's status and logs the timestamp + reason. Optional: a soft re-verification prompt partway through the session window.

### 2.3 Late-status calculated against a global clock time, not session start
**Problem:** `LATE_HOUR`/`LATE_MINUTE` are global config values, not relative to each session's actual start time, so batches with legitimately later lecture times get misclassified as late.
**Fix:** Compute lateness relative to the session's own start timestamp plus a grace period (e.g., 10 minutes), not a fixed clock cutoff. Should align with the existing explicit Lecture Start/End Time feature.

### 2.4 Dual session ID formats (legacy int + V2 string) risk mismatched lookups
**Problem:** session_logs supports both legacy integer IDs and new string-based V2 IDs.
**Fix:** Audit every code path that queries/writes session_id for explicit type branching. Add a regression test that exercises both ID formats through the full attendance-marking flow.

### 2.5 Target-group enforcement is V2-only
**Problem:** Batch/Sub-batch/Elective validation is enforced for V2 sessions but not documented as enforced for legacy integer-ID sessions.
**Fix:** Either backport target-group validation to legacy sessions, or migrate all active sessions to V2 format and deprecate legacy ID creation going forward.

### 2.6 No overlapping-session guard
**Problem:** Nothing prevents a teacher from opening two simultaneous 30-minute windows for the same class (double-click, back button, multiple tabs).
**Fix:** Add a uniqueness constraint/check on (teacher_id or class_id, active=true) before creating a new session; reject or reuse the existing active session instead of creating a duplicate.

### 2.7 Timezone handling unspecified
**Problem:** `LATE_HOUR`, `ABSENT_NOTICE_HOUR`, etc. appear to be interpreted in server-local time with no explicit timezone config.
**Fix:** Store and interpret all cutoff times in a configured campus timezone (e.g., via `zoneinfo`), independent of server deployment timezone.

### 2.8 Silent SMTP fallback
**Problem:** If mail credentials are missing/invalid, absence notices silently fall back to console logging instead of failing loudly.
**Fix:** Add a startup health check that validates mail config and surfaces a clear admin-facing warning (dashboard banner or log-level ERROR) when email delivery is degraded, rather than silent console fallback in production.

---

## Tier 3 — Missing features (from original problem list)

### 3.1 HOD Dashboard — emergency announcements
**Problem:** No way for a Head of Department to broadcast an emergency announcement to the whole department.
**Fix:**
  - Add `announcements` collection: `department`, `message`, `created_by`, `created_at`, `expires_at`.
  - Add HOD role to RBAC (does not currently exist — Student/Teacher/Admin only).
  - Add HOD-scoped route to create/expire announcements.
  - Surface active announcements as a banner on student/teacher dashboards, filtered by department, piggybacked on the existing dashboard polling call (avoid a new channel).

### 3.2 Roll number generator
**Problem:** No automated roll number generation.
**Fix:** Generate roll numbers as `{dept_code}{year}{sequence}` using the existing `counters` collection pattern, atomically incremented per department+year via `findOneAndUpdate`. Feed generated numbers directly into the `valid_students` whitelist.

### 3.3 Faculty request for profile changes
**Problem:** Faculty need a way to request profile edits, likely with admin approval (unlike students, who can self-edit).
**Fix:** Add `profile_change_requests` collection (teacher_id, proposed_changes, status, reviewed_by). Teacher submits a request from `teacher_profile.html`; admin approves/rejects from `admin_users.html`; approval applies the diff and logs it in the existing security-log system.

---

## Tier 4 — "Professional site" gaps (beyond functional bugs)

### 4.1 No containerized/repeatable deployment
**Problem:** Setup is a manual venv + `uvicorn --reload`, with a Windows-only `.bat` install script working around `dlib` build issues.
**Fix:** Add a Dockerfile (multi-stage build handling the `face-recognition --no-deps` dlib workaround) and docker-compose for local dev (app + MongoDB), so the environment is reproducible outside Windows-specific scripting.

### 4.2 No CI/CD or automated tests
**Problem:** `test_func.py` is a manual debug script, not an automated test suite. No linting or staged deploys.
**Fix:** Add a test suite (pytest) covering attendance marking, geofencing edge cases, and both session ID formats. Add a CI pipeline (GitHub Actions or equivalent) running tests + lint on every push.

### 4.3 No monitoring/alerting
**Problem:** Failures (e.g., degraded email delivery) surface only in server logs.
**Fix:** Add structured logging and error tracking (e.g., Sentry) for backend exceptions, plus an uptime/health-check endpoint suitable for external monitoring.

### 4.4 No backup/retention policy for MongoDB
**Problem:** No stated backup cadence or data retention/expiry policy for attendance logs and face encodings.
**Fix:** Define and implement a backup schedule, and a retention/purge policy for graduated students' biometric data, with a documented deletion mechanism.

### 4.5 Face matching scalability
**Problem:** Face matching appears to compare encodings linearly per attendance mark; FAISS is listed as reference material but not confirmed wired into matching.
**Fix:** Confirm whether encoding comparison is indexed. If linear, evaluate FAISS (or in-memory caching of encodings per department/session) once student counts grow past a few hundred.

### 4.6 Biometric data compliance
**Problem:** A privacy policy page exists, but no stated consent flow, retention policy, or right-to-deletion mechanism specific to biometric data (which is often regulated separately from general PII).
**Fix:** Add an explicit consent capture step during registration, and a self-service or admin-triggered deletion flow for a student's stored encoding.

### 4.7 Backend terminology mapping incomplete
**Problem:** The `data-term` terminology system (teacher→faculty, student→learner, etc.) is frontend-only; backend-generated content (emails, PDF/Excel report headers, API error messages) presumably still hardcodes default terms.
**Fix:** Extend terminology mapping to backend-generated strings (email templates, report headers) so institution-specific terminology is consistent end-to-end.

### 4.8 No accessibility or offline/error-state handling
**Problem:** No stated ARIA labeling, keyboard navigation, or contrast compliance; unclear behavior when camera access fails, geofencing permission is denied, or network drops mid-attendance-mark.
**Fix:** Audit key user flows (registration, attendance marking) for accessibility, and add explicit, user-facing error states for camera/permission/network failures instead of silent failure.

### 4.9 Runtime geofence config changes mid-session
**Problem:** Unclear whether in-flight sessions use old or new campus coordinates if an admin edits geofencing config while sessions are active.
**Fix:** Snapshot the geofencing config (coordinates + max distance) onto the Class Session record at creation time, so active sessions are unaffected by later config changes.

---

## Summary table

| # | Item | Tier | Depends on |
|---|------|------|------------|
| 1.1 | Static admin reset password | Security | — |
| 1.2 | Weak liveness challenge | Security | — |
| 1.3 | CSV import ID collisions | Security | — |
| 1.4 | Registration rate limiting | Security | — |
| 1.5 | Biometric data encryption at rest | Security | — |
| 2.1 | Geofencing room precision | Data integrity | — |
| 2.2 | Mark absent after early leave | Data integrity | — |
| 2.3 | Late status relative to session start | Data integrity | — |
| 2.4 | Dual session ID format audit | Data integrity | — |
| 2.5 | Target-group enforcement on legacy sessions | Data integrity | Depends on 2.4 |
| 2.6 | Overlapping-session guard | Data integrity | — |
| 2.7 | Timezone handling | Data integrity | — |
| 2.8 | Silent SMTP fallback | Data integrity | — |
| 3.1 | HOD announcements | Feature | Requires new HOD role |
| 3.2 | Roll number generator | Feature | — |
| 3.3 | Faculty profile change requests | Feature | — |
| 4.1 | Containerized deployment | Professionalization | — |
| 4.2 | CI/CD + tests | Professionalization | — |
| 4.3 | Monitoring/alerting | Professionalization | — |
| 4.4 | Backup/retention policy | Professionalization | — |
| 4.5 | Face matching scalability | Professionalization | — |
| 4.6 | Biometric data compliance | Professionalization | — |
| 4.7 | Backend terminology mapping | Professionalization | — |
| 4.8 | Accessibility/error states | Professionalization | — |
| 4.9 | Geofence config snapshotting | Professionalization | — |