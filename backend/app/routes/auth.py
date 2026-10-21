from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..limiter import limiter
from ..database.mongo import get_database
from ..dependencies import get_current_user
from ..models import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER
from ..schemas import ChangePasswordRequest, LoginRequest, OTPRequest, OTPVerifyRequest, Token, UserCreate, UserOut, UserProfileUpdate, ForgotPasswordRequest, ResetPasswordRequest, LivenessChallengeResponse
from ..services.attendance_service import serialize_attendance
from ..services.email_service import get_last_mail_error, send_password_changed, send_registration_success, send_otp_email, send_password_reset_otp_email
from ..services.face_service import extract_encoding, find_best_match, verify_liveness_sequence, generate_liveness_challenge_sequence
from ..services.security_service import log_security_event
from ..services.user_service import (
    create_access_token_for_user,
    create_registered_user,
    get_user_by_email,
    mark_verified,
    resend_otp,
    serialize_user,
    verify_student_login,
    update_password,
    update_user_profile,
)
from ..utils.security import generate_otp, hash_password, otp_hash, otp_salt, verify_otp as verify_otp_hash
from ..utils.time import iso_ist, now_ist


router = APIRouter(tags=["auth"])


def _security_account_snapshot(user: dict, *, is_active: bool | None = None, blocked_reason: str | None = None) -> dict:
    snapshot = {
        "id": user.get("id"),
        "full_name": user.get("full_name"),
        "email": user.get("email"),
        "roll_number": user.get("roll_number"),
        "department": user.get("department"),
        "role": user.get("role"),
        "is_verified": bool(user.get("is_verified", False)),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }
    if is_active is not None:
        snapshot["is_active"] = bool(is_active)
    elif "is_active" in user:
        snapshot["is_active"] = bool(user.get("is_active", False))
    if blocked_reason is not None:
        snapshot["blocked_reason"] = blocked_reason
    elif user.get("blocked_reason"):
        snapshot["blocked_reason"] = user.get("blocked_reason")
    return snapshot


@router.get("/liveness-challenge", response_model=LivenessChallengeResponse)
async def get_liveness_challenge():
    session_id, challenges = generate_liveness_challenge_sequence()
    return {"session_id": session_id, "challenges": challenges}


@router.post("/register")
@limiter.limit("5/minute")
async def register(
    payload: UserCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    email = payload.email.lower().strip()
    roll_number = payload.roll_number.strip() if payload.roll_number else ""
    
    # Registration Logic based on role
    requested_role = payload.requested_role.strip().lower() if payload.requested_role else "student"
    is_active = True
    approval_status = "approved"
    
    if requested_role == "student":
        # 1. Check Whitelist
        valid_student = await db.valid_students.find_one({"roll_number": roll_number}) if roll_number else None
        if valid_student:
            payload.program = valid_student.get("program")
            payload.enrolled_subjects = valid_student.get("enrolled_subjects", [])
            payload.full_name = valid_student.get("name", payload.full_name)
        else:
            # 2. Fallback to Domain Validation
            settings_doc = await db.config.find_one({"_id": "global"})
            official_domain = settings_doc.get("official_domain") if settings_doc else None
            
            if not official_domain or not email.endswith(f"@{official_domain.lstrip('@')}"):
                await log_security_event(
                    db,
                    event_type="FAILED_WHITELIST_CHECK",
                    severity="warning",
                    details=f"Registration rejected: roll number '{roll_number}' not on whitelist and email '{email}' does not match official domain '{official_domain}'",
                    metadata={"email": email, "roll_number": roll_number},
                    ip_address=(request.client.host if request and request.client else None),
                    user_agent=(request.headers.get("user-agent") if request else None),
                )
                raise HTTPException(status_code=400, detail="Student roll number not on whitelist and email does not match official organization domain.")
    elif requested_role == "teacher":
        if not payload.id_card_image:
            raise HTTPException(status_code=400, detail="ID card image is required for faculty registration.")
        is_active = False
        approval_status = "pending"
    else:
        raise HTTPException(status_code=400, detail="Invalid role requested.")

    if await get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")

    if roll_number and await db.users.find_one({"roll_number": roll_number}):
        raise HTTPException(status_code=400, detail="Roll number already registered")

    if not payload.department or not payload.department.strip():
        raise HTTPException(status_code=400, detail="Department is required")

    if payload.liveness_session_id and payload.liveness_frames:
        await verify_liveness_sequence(payload.liveness_session_id, payload.liveness_frames)

    face_encoding = await extract_encoding(payload.face_image)
    
    from ..config import settings
    from ..services.vector_store import vector_store
    
    duplicate = None
    if vector_store.is_ready:
        results = vector_store.search(face_encoding, k=1, threshold=settings.face_tolerance)
        if results:
            target_user = await db.users.find_one({"id": results[0]["user_id"]})
            if target_user:
                duplicate = {"user": target_user, "distance": results[0]["distance"]}
    else:
        # Fallback to linear search if FAISS is not ready
        existing_faces = []
        cursor = db.users.find({"face_encoding": {"$exists": True, "$ne": []}, "is_active": True})
        async for user in cursor:
            existing_faces.append(user)
        duplicate = await find_best_match(face_encoding, existing_faces)
    if duplicate:
        target = duplicate["user"]
        target_snapshot = _security_account_snapshot(target, is_active=False, blocked_reason="BIOMETRIC_DUPLICATION_ATTEMPT")
        attempted_snapshot = {
            "full_name": payload.full_name,
            "email": email,
            "roll_number": roll_number,
            "department": payload.department.strip() if payload.department else None,
            "role": requested_role,
            "is_active": False,
            "is_verified": False,
        }
        # Double-Block Action: deactivating existing account and rejecting new one
        await db.users.update_one(
            {"id": target["id"]}, 
            {"$set": {"is_active": False, "blocked_reason": "BIOMETRIC_DUPLICATION_ATTEMPT", "updated_at": iso_ist()}}
        )
        await log_security_event(
            db,
            event_type="DUPLICATE_FACE_DETECTED",
            severity="critical",
            details=f"Registration attempt for {email} blocked due to biometric match with existing user {target['email']}. Existing account suspended and the new submission queued for administrative review.",
            metadata={
                "duplicate_user_id": target["id"],
                "duplicate_email": target["email"],
                "attempted_email": email,
                "match_distance": round(float(duplicate.get("distance", 0.0)), 4),
                "old_account": target_snapshot,
                "present_account": attempted_snapshot,
            },
            target_user_id=target["id"],
            ip_address=(request.client.host if request and request.client else None),
            user_agent=(request.headers.get("user-agent") if request else None),
        )
        raise HTTPException(status_code=400, detail="Biometric duplication detected. The existing account has been suspended for security verification, and this registration terminal has been locked. Only a system administrator can authorize reactivation.")

    otp = generate_otp()
    await create_registered_user(db, payload, face_encoding, otp, is_active, approval_status)
    # Send directly and fail fast if SMTP delivery is unavailable.
    otp_sent = await send_otp_email(email, otp)
    if not otp_sent:
        mail_error = get_last_mail_error()
        if mail_error == "quota_exceeded":
            raise HTTPException(
                status_code=503,
                detail="Gmail daily sending limit exceeded. This is a rolling 24-hour quota, so the sender account must wait until the limit resets.",
            )
        raise HTTPException(
            status_code=503,
            detail="Unable to deliver verification email right now. Please try again in a few minutes.",
        )
    await log_security_event(
        db,
        event_type="STUDENT_REGISTERED_PENDING_OTP",
        severity="info",
        details=f"Registration created for {email}",
        metadata={"email": email, "roll_number": roll_number},
        ip_address=(request.client.host if request and request.client else None),
        user_agent=(request.headers.get("user-agent") if request else None),
    )
    return {"message": "Registration successful. Please enter the verification code sent to your email address to complete the process."}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, response: Response, payload: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    user = await get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        if user.get("approval_status") == "pending":
            raise HTTPException(status_code=403, detail="Your account is pending admin approval.")
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Please contact the system administrator for assistance.")

    await verify_student_login(user, payload.password)

    if user.get("must_change_password") and user.get("temp_password_expires_at"):
        try:
            expires_dt = datetime.fromisoformat(user["temp_password_expires_at"])
            if now_ist() > expires_dt:
                raise HTTPException(status_code=400, detail="Temporary password has expired. Please contact the administrator.")
        except HTTPException:
            raise
        except Exception:
            pass

    if not user.get("is_verified", False):
        raise HTTPException(status_code=400, detail="Account verification is required. Please verify your email address to proceed.")

    token = await create_access_token_for_user(user)
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": iso_ist(), "updated_at": iso_ist()}})
    
    # Set HttpOnly secure cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        secure=False,    # Disabled for local network HTTP testing
        samesite="lax",
        max_age=86400 * 7 # 7 days
    )
    
    return Token(access_token=token)


@router.post("/verify-otp")
@limiter.limit("5/minute")
async def verify_otp(
    payload: OTPVerifyRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    user = await get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    otp_hash_value = user.get("otp_hash")
    if not otp_hash_value:
        raise HTTPException(status_code=400, detail="Verification code is invalid or has already been used.")

    expires_at = user.get("otp_expires_at")
    if expires_at:
        try:
            expires_dt = datetime.fromisoformat(expires_at)
        except Exception:
            expires_dt = None
        if expires_dt and now_ist() > expires_dt:
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    if not verify_otp_hash(payload.otp, otp_salt(), otp_hash_value):
        raise HTTPException(status_code=400, detail="The verification code entered is incorrect.")

    await mark_verified(db, user)
    
    if user.get("role") == ROLE_TEACHER:
        await log_security_event(
            db,
            event_type="EMAIL_VERIFIED",
            severity="info",
            details=f"Email verified for {user['email']} (pending admin approval)",
            user_id=user["id"],
            ip_address=(request.client.host if request and request.client else None),
            user_agent=(request.headers.get("user-agent") if request else None),
        )
        return {"message": "Email verification successful. Your faculty account is currently pending administrator approval. You will not be able to log in until an admin reviews and approves your account."}
    else:
        background_tasks.add_task(send_registration_success, user["email"])
        await log_security_event(
            db,
            event_type="EMAIL_VERIFIED",
            severity="info",
            details=f"Email verified for {user['email']}",
            user_id=user["id"],
            ip_address=(request.client.host if request and request.client else None),
            user_agent=(request.headers.get("user-agent") if request else None),
        )
        return {"message": "Verification successful"}


@router.post("/resend-otp")
@limiter.limit("5/minute")
async def resend_otp_endpoint(
    request: Request,
    payload: OTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    user = await get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_verified"):
        return {"message": "Account is already verified. Please login instead of requesting a new OTP.", "already_verified": True}

    otp = generate_otp()
    await resend_otp(db, user, otp)
    otp_sent = await send_otp_email(user["email"], otp)
    if not otp_sent:
        mail_error = get_last_mail_error()
        if mail_error == "quota_exceeded":
            raise HTTPException(
                status_code=503,
                detail="Gmail daily sending limit exceeded. This is a rolling 24-hour quota, so the sender account must wait until the limit resets.",
            )
        raise HTTPException(
            status_code=503,
            detail="Unable to deliver verification email right now. Please try again in a few minutes.",
        )
    return {"message": "Verification code has been resent to your email address."}


@router.get("/users/me", response_model=UserOut)
async def read_current_user(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/users/me/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    await update_password(db, current_user, payload.current_password, payload.new_password)
    background_tasks.add_task(send_password_changed, current_user["email"])
    await log_security_event(
        db,
        event_type="PASSWORD_CHANGED",
        severity="info",
        details=f"Password changed for {current_user['email']}",
        user_id=current_user["id"],
        ip_address=(request.client.host if request and request.client else None),
        user_agent=(request.headers.get("user-agent") if request else None),
    )
    return {"message": "Password updated successfully"}


@router.patch("/users/me")
async def update_current_user_profile(
    payload: UserProfileUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user),
):
    await update_user_profile(db, current_user.get("id"), payload)
    return {"message": "Profile updated successfully"}


@router.post("/forgot-password")
async def forgot_password_endpoint(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    email = payload.email.strip().lower()
    user = await get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="No account registered with this email address.")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Please contact the administrator.")

    otp = generate_otp()
    
    # Save the hashed OTP and expiration time on user profile
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "otp_hash": otp_hash(otp, otp_salt()),
                "otp_expires_at": (now_ist() + timedelta(minutes=10)).isoformat(),
                "updated_at": iso_ist()
            }
        }
    )
    
    # Send the OTP email
    otp_sent = await send_password_reset_otp_email(email, otp)
    delivery_failed = not otp_sent
    if delivery_failed:
        print(f"[WARNING] Email delivery failed to {email}. You can retrieve the OTP from the terminal console.")
        
    await log_security_event(
        db,
        event_type="FORGOT_PASSWORD_REQUESTED",
        severity="info",
        details=f"Password reset OTP requested for {email} (Email delivery failed: {delivery_failed})",
        user_id=user["id"],
        ip_address=(request.client.host if request and request.client else None),
        user_agent=(request.headers.get("user-agent") if request else None),
    )
    
    return {"message": "Verification code has been generated. Please check your email or terminal console."}


@router.post("/reset-password")
async def reset_password_endpoint(
    payload: ResetPasswordRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    email = payload.email.strip().lower()
    user = await get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="No account registered with this email address.")
        
    otp_hash_value = user.get("otp_hash")
    if not otp_hash_value:
        raise HTTPException(status_code=400, detail="Verification code is invalid or has already been used.")
        
    expires_at = user.get("otp_expires_at")
    if expires_at:
        try:
            expires_dt = datetime.fromisoformat(expires_at)
        except Exception:
            expires_dt = None
        if expires_dt and now_ist() > expires_dt:
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")
            
    if not verify_otp_hash(payload.otp, otp_salt(), otp_hash_value):
        raise HTTPException(status_code=400, detail="The verification code entered is incorrect.")
        
    # Reset the password and clear OTP fields
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "hashed_password": hash_password(payload.new_password),
                "otp_hash": None,
                "otp_expires_at": None,
                "updated_at": iso_ist()
            }
        }
    )
    
    # Notify user that password was updated
    background_tasks.add_task(send_password_changed, email)
    
    await log_security_event(
        db,
        event_type="PASSWORD_RESET_VIA_OTP",
        severity="info",
        details=f"Password reset successfully via OTP for {email}",
        user_id=user["id"],
        ip_address=(request.client.host if request and request.client else None),
        user_agent=(request.headers.get("user-agent") if request else None),
    )
    
    return {"message": "Password reset successfully. Please log in with your new password."}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=True,
        samesite="lax"
    )
    return {"message": "Logged out successfully"}

