from __future__ import annotations
from dotenv import load_dotenv
import os


load_dotenv()



import os
import sys

if sys.platform == 'win32':
    try:
        import dns.win32util
        dns.win32util.set_config_method(dns.win32util.ConfigMethod.Registry)
    except Exception:
        pass

from pathlib import Path

import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import timedelta

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
import uvicorn
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter

from app.config import settings
from app.database.mongo import connect_to_mongo, close_mongo_connection, get_database
from app.services.vector_store import vector_store
from app.realtime import ws_manager
from app.routes.admin import router as admin_router
from app.routes.attendance import router as attendance_router
from app.routes.auth import router as auth_router
from app.routes.teacher import router as teacher_router
from app.routes.student import router as student_router
from app.services.attendance_service import send_absent_notifications
from app.services.face_service import get_face_recognition_status
from app.utils.time import get_campus_now
from app.utils.time import iso_ist


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend-legacy"
REACT_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"

# ── Startup validation ────────────────────────────────────────────────────────
_INSECURE_KEYS = {"change-me-in-production", "change-this-secret", "", "your-secret-key"}
if settings.secret_key in _INSECURE_KEYS:
    import sys
    print(
        "[STARTUP ERROR] SECRET_KEY is not set or is using an insecure default value. "
        "Set a strong SECRET_KEY environment variable before starting the server.",
        file=sys.stderr,
    )
    sys.exit(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    
    # Initialize FAISS Vector Store
    db = await get_database()
    await vector_store.initialize(db)
    
    from app.scheduler import upcoming_lecture_worker
    
    app.state.absent_notices_task = asyncio.create_task(_absent_notices_worker())
    app.state.upcoming_lecture_task = asyncio.create_task(upcoming_lecture_worker())
    try:
        yield
    finally:
        task = getattr(app.state, "absent_notices_task", None)
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
                
        tt_task = getattr(app.state, "upcoming_lecture_task", None)
        if tt_task:
            tt_task.cancel()
            with suppress(asyncio.CancelledError):
                await tt_task
                
        await close_mongo_connection()


app = FastAPI(title="Smart Attendance System Using Face Recognition API", lifespan=lifespan)
app.state.ws_manager = ws_manager
app.state.absent_notices_task = None
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
# On Render the app is same-origin (FastAPI serves both API + static frontend),
# so allow_credentials + wildcard is not needed. We still expose a
# ALLOWED_ORIGINS env var for explicit cross-origin setups (e.g. a separate
# React frontend on a different domain).
_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins: list[str] = (
    [o.strip() for o in _allowed_origins_raw.split(",") if o.strip()]
    if _allowed_origins_raw.strip()
    else ["*"]
)
_use_credentials = "*" not in _allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_use_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

if (REACT_DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(REACT_DIST_DIR / "assets")), name="assets")

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    if (FRONTEND_DIR / "css").exists():
        app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    if (FRONTEND_DIR / "js").exists():
        app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    icon_file = FRONTEND_DIR / "favicon.svg"
    if icon_file.exists():
        return FileResponse(icon_file, media_type="image/svg+xml")
    return Response(status_code=204)


async def _absent_notices_worker() -> None:
    from app.services.attendance_service import get_teacher_department_students, _insert_or_update_attendance
    from app.services.email_service import send_absent_notice

    while True:
        try:
            if not settings.absent_notifications_enabled:
                await asyncio.sleep(60)
                continue

            current = get_campus_now()
            db = await get_database()
            
            cutoff_passed = (current.hour, current.minute) >= (settings.absent_notice_hour, settings.absent_notice_minute)
            if cutoff_passed:
                departments = await db.users.distinct("department", {"role": "student", "department": {"$ne": None}})
                for department in departments:
                    result = await send_absent_notifications(db, department)
                    if result.get("status") == "failed":
                        print(f"[ABSENT:FAILED] {department} | {result.get('message')}")
            
            # New Logic: Process 30-min old active sessions
            thirty_mins_ago = current - timedelta(minutes=30)
            cursor = db.class_sessions.find({
                "status": "active",
                "start_time": {"$lte": thirty_mins_ago.isoformat()}
            })
            
            async for session in cursor:
                students = await get_teacher_department_students(db, session["department"])
                
                await db.class_sessions.update_one(
                    {"id": session["id"]},
                    {"$set": {"status": "closed", "end_time": iso_ist()}}
                )
                
                attended_records = await db.attendance.find({"session_id": session["id"]}).to_list(length=None)
                attended_ids = {r["user_id"] for r in attended_records}
                
                for student in students:
                    if student["id"] not in attended_ids:
                        await _insert_or_update_attendance(
                            db,
                            user=student,
                            marked_by_user_id=None,
                            status="Absent",
                            method="system",
                            latitude=None,
                            longitude=None,
                            session_id=session["id"],
                            subject=session.get("subject"),
                            class_name=session.get("class_name"),
                            teacher_name=session.get("teacher_name")
                        )
                        # Send email
                        subject_name = session.get("subject") or "Class"
                        await send_absent_notice(student["email"], student.get("full_name") or student["email"], f"{subject_name} Session")

            await asyncio.sleep(60)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(60)


@app.get("/")
async def root():
    react_index = REACT_DIST_DIR / "index.html"
    if react_index.exists():
        return FileResponse(react_index)
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return RedirectResponse(url="/static/index.html")
    return {"message": "Smart Attendance System Using Face Recognition API is operational."}


@app.get("/health")
async def health():
    face_status = get_face_recognition_status()
    from app.services.email_service import check_mail_health
    mail_status = await check_mail_health()
    return {
        "status": "ok",
        "time": iso_ist(),
        "face_recognition_available": face_status["available"],
        "face_recognition_error": face_status["error"],
        "mail_service": mail_status,
    }


@app.get("/api/config/public")
async def get_public_config():
    db = await get_database()
    doc = await db.config.find_one({"_id": "global"})
    
    org_type = "Engineering College"
    departments = ["Computer Science", "Electronics & Communication", "Mechanical Engineering"]
    classes = ["CS-201", "CS-202", "CS-203", "EC-201"]
    
    if doc:
        if "organization_type" in doc:
            org_type = doc["organization_type"]
        if "departments" in doc:
            departments = doc["departments"]
        if "classes" in doc:
            classes = doc["classes"]
            
    return {
        "organization_type": org_type,
        "departments": departments,
        "classes": classes
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


from app.routes.timetable import router as timetable_router
from app.routes.hierarchy import router as hierarchy_router
from app.routes.batch import router as batch_router
from app.routes.electives import router as electives_router
from app.routes.hod import router as hod_router
from app.routes.announcements import router as announcements_router

app.include_router(auth_router)
app.include_router(attendance_router)
app.include_router(teacher_router)
app.include_router(student_router)
app.include_router(admin_router)
app.include_router(timetable_router)
app.include_router(hierarchy_router)
app.include_router(batch_router)
app.include_router(electives_router)
app.include_router(hod_router)
app.include_router(announcements_router)


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str):
    react_index = REACT_DIST_DIR / "index.html"
    if full_path.startswith(("api/", "health", "docs", "openapi.json", "static/", "assets/", "ws")):
        raise HTTPException(status_code=404, detail="Not Found")
    if react_index.exists():
        return FileResponse(react_index)
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return RedirectResponse(url="/static/index.html")
    raise HTTPException(status_code=404, detail="Not Found")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
