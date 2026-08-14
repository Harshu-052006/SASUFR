# SASUFR — Fix Distribution by Team Member

Based on the workload split in the project PDF, mapped against the problems in `SASUFR_Problems_to_Fix.md`. Each person only gets items that live in files they already own — this avoids two people editing the same file on different branches and fighting merge conflicts.

**Branching model:**
- Each member works off one personal branch: `backend-member1`, `backend-member2`, `frontend-member1`, `frontend-member2` — cut from `main`/`dev` at the start.
- Within that branch, do **one numbered item at a time** — commit after each item passes its own test, don't batch several items into one commit.
- Open a PR back to `main`/`dev` after each item (or small group of related items) is done and tested — don't wait until the whole list is finished to merge, or conflicts pile up.
- Items marked **⚠ Coordination needed** require a quick sync between the two people listed before either starts, so the API contract (request/response shape) is agreed first.

---

## Backend Member 1 — System Infrastructure & User Management
*Owns: `main.py`, `mongo.py`, `dependencies.py`, `auth.py`, `admin.py` (user routes), `mail_service.py`, seeder CLIs*

| # | Item | Notes |
|---|------|-------|
| 1.1 | Static admin password reset (`SASUFR`) → random one-time password, forced change on first login | Self-contained in `admin.py` user reset endpoint |
| 1.3 | CSV bulk-import ID collisions | `admin.py` import route + `mongo.py` counter logic |
| 1.4 | Registration rate limiting on `/register`, `/verify-otp` | `auth.py` |
| 2.7 | Timezone handling for cutoff times | `config.py` — ⚠ Coordination needed with Backend Member 2 (they consume these values in `attendance_service.py`) |
| 2.8 | Silent SMTP fallback → health check + admin-visible warning | `mail_service.py` |
| 3.1a | HOD role + `announcements` collection + create/expire routes | New role in `dependencies.py` RBAC + new route file — ⚠ Coordination needed with Frontend Member 2 (banner display) |
| 3.2 | Roll number generator | `mongo.py` counters + `auth.py` registration flow |
| 3.3a | `profile_change_requests` collection + admin approve/reject route | `admin.py` — ⚠ Coordination needed with Frontend Member 2 (approval UI) |

**Suggested order:** 1.1 → 1.4 → 1.3 → 2.8 → 2.7 → 3.2 → 3.1a → 3.3a

---

## Backend Member 2 — Biometrics, Attendance Rules & Analytics
*Owns: `face_service.py`, `attendance_service.py`, `teacher.py`, `student.py`, `security_service.py`, export engines*

| # | Item | Notes |
|---|------|-------|
| 1.2 | Weak liveness challenge → randomized order + second signal | `face_service.py` |
| 1.5 | Biometric data encryption at rest | `face_service.py` / storage layer — ⚠ Coordination needed with Backend Member 1 (`mongo.py` schema) |
| 2.1a | Geofencing room precision — backend verification logic (BSSID or session code check) | `attendance_service.py` — ⚠ Coordination needed with Frontend Member 2 (how the room signal is captured/sent) |
| 2.2a | Mark-absent-after-early-leave — backend endpoint to revoke/update status | `teacher.py` — ⚠ Coordination needed with Frontend Member 2 (UI trigger) |
| 2.3 | Late status relative to session start, not global clock | `attendance_service.py` |
| 2.4 | Dual session ID format audit (legacy int vs V2 string) | `attendance_service.py`, `teacher.py`, `student.py` — do this before 2.5 |
| 2.5 | Target-group enforcement on legacy sessions | Depends on 2.4 findings |
| 2.6 | Overlapping-session guard | `teacher.py` session-start route |

**Suggested order:** 1.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.2a → 2.1a → 1.5

---

## Frontend Member 1 — Base UI, Biometric Registration & Student Dashboard
*Owns: `core.css`, `api.js`, `index.html`, `login.html`, `register.html`, `user_dashboard.html`*

| # | Item | Notes |
|---|------|-------|
| 3.1b | Display active department announcement as a banner on the student dashboard | `user_dashboard.html` — pulls from the polling call Backend Member 1 sets up in 3.1a; wait for their route to exist first |
| 4.8a | Accessibility + offline/error-state handling for registration flow (camera denied, network drop mid-OTP) | `register.html`, `api.js` — self-contained, can start anytime |

**Suggested order:** 4.8a → 3.1b (after Backend Member 1 finishes 3.1a)

*Note: This tier mostly landed on Backend and Frontend Member 2 because the flagged issues live in teacher/admin/session logic. Frontend Member 1's queue is lighter — good candidate to also help review Frontend Member 2's PRs, or pick up early Tier 4 polish once Tier 1–3 items are through.*

---

## Frontend Member 2 — Faculty Dashboard & Administrator Management Portal
*Owns: `teacher_dashboard.html`, `admin_dashboard.html`, admin config UI, security/export UI*

| # | Item | Notes |
|---|------|-------|
| 2.1b | Geofencing room precision — UI to capture/display the session room signal (QR display or BSSID capture trigger) | `teacher_dashboard.html` — ⚠ Coordination needed with Backend Member 2 (agree on payload shape first) |
| 2.2b | "Mark Left / Revoke Attendance" button on live session view | `teacher_dashboard.html` — ⚠ Coordination needed with Backend Member 2 |
| 3.1c | HOD dashboard UI (new portal) + announcement composer + banner on teacher/admin dashboards | New page, following existing dashboard patterns — ⚠ Coordination needed with Backend Member 1 |
| 3.3b | Faculty profile-change-request UI (`teacher_profile.html`) + admin approve/reject screen | ⚠ Coordination needed with Backend Member 1 |
| 4.9 | Snapshot geofence config onto session at creation (display-only confirmation on session-start screen, backend does the actual snapshot) | Small, mostly backend — coordinate briefly with Backend Member 2 |

**Suggested order:** 2.2b → 2.1b → 3.3b → 3.1c → 4.9

---

## What's deliberately left out for now

Tier 4 items other than 4.8a and 4.9 (Docker, CI/CD, monitoring, backups, compliance, terminology mapping) aren't assigned to anyone yet — these are infrastructure/product decisions worth deciding together as a team before splitting them across branches, not something to parallelize blindly.

## Merge order recommendation

To minimize conflicts, merge roughly in this sequence:
1. Backend Member 1's self-contained items (1.1, 1.3, 1.4, 2.7, 2.8) — no dependencies on anyone
2. Backend Member 2's self-contained items (1.2, 2.3, 2.4, 2.5, 2.6)
3. Frontend Member 1's 4.8a — independent
4. The paired items (2.1, 2.2, 3.1, 3.3) — once both people in each pair have agreed the contract, merge backend half first, then frontend half
