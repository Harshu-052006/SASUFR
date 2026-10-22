from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage

from ..config import settings


_LAST_MAIL_ERROR: str | None = None
_LAST_MAIL_ERROR_DETAILS: str | None = None


def get_last_mail_error() -> str | None:
    return _LAST_MAIL_ERROR


def get_last_mail_error_details() -> str | None:
    return _LAST_MAIL_ERROR_DETAILS


def _set_last_mail_error(value: str | None) -> None:
    global _LAST_MAIL_ERROR
    _LAST_MAIL_ERROR = value


def _frontend_url(path: str = "") -> str:
    base_url = (settings.frontend_base_url or "").rstrip("/")
    suffix = path.lstrip("/")
    if suffix:
        return f"{base_url}/{suffix}"
    return base_url


def _get_premium_template(title: str, content: str, action_text: str = None, action_url: str = None) -> str:
    """Returns a premium, glassmorphic 'Deep Space' HTML email template."""
    action_button = f"""
        <div style="margin: 40px 0; text-align: center;">
            <a href="{action_url}" style="background: linear-gradient(135deg, #00d1c7 0%, #6f45ff 100%); color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 0.9rem; letter-spacing: 2px; box-shadow: 0 10px 20px rgba(0, 209, 199, 0.2); display: inline-block;">{action_text}</a>
        </div>
    """ if action_text and action_url else ""

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; background-color: #020617; font-family: 'Inter', -apple-system, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                        <tr>
                            <td height="8" style="background: linear-gradient(90deg, #00d1c7 0%, #6f45ff 100%);"></td>
                        </tr>
                        <tr>
                            <td style="padding: 60px 40px;">
                                <div style="margin-bottom: 40px;">
                                    <span style="color: #ffffff; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.5px;">SmartFace <span style="color: #00d1c7;">HUB</span></span>
                                </div>
                                <h1 style="color: #ffffff; font-size: 2rem; font-weight: 900; margin-bottom: 24px; line-height: 1.2; letter-spacing: -1px;">{title}</h1>
                                <div style="color: #94a3b8; font-size: 1.1rem; line-height: 1.6; margin-bottom: 32px;">
                                    {content}
                                </div>
                                {action_button}
                                <div style="margin-top: 60px; padding-top: 40px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                                    <p style="color: #475569; font-size: 0.8rem; line-height: 1.6; margin: 0;">
                                        This is a secure automated notification from the Smart Attendance System Using Face Recognition platform. If you did not expect this communication, please contact your systems administrator immediately.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color: rgba(0, 0, 0, 0.2); padding: 24px 40px; text-align: center;">
                                <p style="color: #475569; font-size: 0.75rem; margin: 0; font-weight: 600; letter-spacing: 1px;">
                                    &copy; 2026 Smart Attendance System Using Face Recognition &bull; DEEP_SPACE_PROTOCOLS v2.0
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def _send_email_sync(recipient: str, subject: str, text_body: str, html_body: str = None) -> bool:
    global _LAST_MAIL_ERROR_DETAILS
    if not settings.mail_enabled:
        _set_last_mail_error("mail_disabled")
        # In local/demo mode we intentionally skip SMTP sends.
        # OTP is already printed by send_otp_email, so avoid extra noisy logs.
        return True

    if not settings.mail_username or not settings.mail_password or not settings.mail_from:
        _set_last_mail_error("mail_not_configured")
        print(f"[MAIL:FALLBACK] {recipient} | {subject} | {text_body}")
        return True

    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text_body)
    
    if html_body:
        message.add_alternative(html_body, subtype="html")

    timeout_seconds = 8
    try:
        if settings.mail_ssl_tls:
            with smtplib.SMTP_SSL(settings.mail_server, settings.mail_port, timeout=timeout_seconds) as client:
                if settings.use_credentials:
                    client.login(settings.mail_username, settings.mail_password)
                client.send_message(message)
        else:
            with smtplib.SMTP(settings.mail_server, settings.mail_port, timeout=timeout_seconds) as client:
                if settings.mail_starttls:
                    client.starttls()
                if settings.use_credentials:
                    client.login(settings.mail_username, settings.mail_password)
                client.send_message(message)
        _LAST_MAIL_ERROR_DETAILS = None
        _set_last_mail_error(None)
        return True
    except Exception as exc:
        error_text = str(exc)
        _LAST_MAIL_ERROR_DETAILS = error_text
        if "5.4.5" in error_text or "Daily user sending limit exceeded" in error_text:
            _set_last_mail_error("quota_exceeded")
            print(f"[MAIL:QUOTA] {recipient} | {subject} | {exc}")
        else:
            _set_last_mail_error("smtp_error")
            print(f"[MAIL:ERROR] {recipient} | {subject} | {exc}")
        return False


async def send_email(recipient: str, subject: str, text_body: str, html_body: str = None) -> bool:
    success = False
    err_msg = None
    try:
        success = await asyncio.to_thread(_send_email_sync, recipient, subject, text_body, html_body)
        if not success:
            err_msg = get_last_mail_error_details() or "SMTP send failed"
    except Exception as exc:
        _set_last_mail_error("smtp_error")
        err_msg = str(exc)
        print(f"[MAIL:FALLBACK] {recipient} | {subject} | {text_body} | reason={exc}")
        success = False

    # Record SMTP status in database
    try:
        from ..database.mongo import get_database
        from ..utils.time import iso_ist
        db = await get_database()
        status = "ok" if success else "failing"
        await db.config.update_one(
            {"_id": "global"},
            {"$set": {
                "email_status": status,
                "email_error": err_msg if not success else None,
                "email_status_checked_at": iso_ist()
            }},
            upsert=True
        )
    except Exception as db_exc:
        print(f"[MAIL:DB_LOG_ERROR] Failed to log email status to DB: {db_exc}")

    return success


def check_smtp_connectivity_sync() -> tuple[bool, str | None]:
    """Lightweight connectivity check to the configured SMTP server."""
    if not settings.mail_enabled:
        return True, "mail_disabled"
    if not settings.mail_username or not settings.mail_password or not settings.mail_from:
        return False, "mail_not_configured"
        
    timeout_seconds = 8
    try:
        if settings.mail_ssl_tls:
            with smtplib.SMTP_SSL(settings.mail_server, settings.mail_port, timeout=timeout_seconds) as client:
                if settings.use_credentials:
                    client.login(settings.mail_username, settings.mail_password)
        else:
            with smtplib.SMTP(settings.mail_server, settings.mail_port, timeout=timeout_seconds) as client:
                if settings.mail_starttls:
                    client.starttls()
                if settings.use_credentials:
                    client.login(settings.mail_username, settings.mail_password)
        return True, None
    except Exception as exc:
        return False, str(exc)


async def check_smtp_connectivity() -> tuple[bool, str | None]:
    return await asyncio.to_thread(check_smtp_connectivity_sync)


async def send_otp_email(email: str, otp: str) -> bool:
    # High-visibility logging for development/troubleshooting
    print("\n" + "="*50)
    print(f" OTP FOR {email}: {otp} ")
    print("="*50 + "\n")
    
    title = "Verification Code"
    content = f"Your secure verification code is below. This sequence will expire in 10 minutes for your security."
    otp_display = f'<div style="background: rgba(0, 209, 199, 0.1); color: #00d1c7; font-size: 2.5rem; font-weight: 900; letter-spacing: 8px; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid rgba(0, 209, 199, 0.2); font-family: monospace; margin: 32px 0;">{otp}</div>'
    
    html = _get_premium_template(title, f"{content}{otp_display}")
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", f"Your verification code is: {otp}", html)


async def send_registration_success(email: str) -> bool:
    title = "Registration Successful"
    content = "Welcome to the future of biometric attendance. Your student account has been successfully initialized and synchronized with the Smart Attendance System Using Face Recognition platform."
    html = _get_premium_template(title, content)
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", content, html)


async def send_password_changed(email: str) -> bool:
    title = "Security Alert: Password Updated"
    content = "Your account password was recently updated via the security terminal. If you did not authorize this action, your account may be compromised. Please lock your account and contact your administrator immediately."
    html = _get_premium_template(title, content, "PROTECT_ACCOUNT", "#")
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", content, html)


async def send_absent_notice(email: str, student_name: str, date_label: str) -> bool:
    title = "Attendance Notification"
    name = student_name or 'Student'
    content = f"Hello {name},<br><br>This is an automated telemetry report to inform you that your presence was <b>not detected</b> during the scheduled session on <b>{date_label}</b>. If this is a mismatch, please submit a synchronization request to your teacher."
    html = _get_premium_template(title, content, "VIEW_HISTORY", f"{_frontend_url('user-dashboard')}#attendance-history")
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", f"Notification: You were marked absent on {date_label}.", html)


async def send_password_reset_otp_email(email: str, otp: str) -> bool:
    # High-visibility logging for development/troubleshooting
    print("\n" + "="*50)
    print(f" PASSWORD RESET OTP FOR {email}: {otp} ")
    print("="*50 + "\n")
    
    title = "Password Reset Request"
    content = "You requested a password reset. Enter the secure verification code below to authorize this change. This code will expire in 10 minutes."
    otp_display = f'<div style="background: rgba(255, 110, 110, 0.1); color: #ff6e6e; font-size: 2.5rem; font-weight: 900; letter-spacing: 8px; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid rgba(255, 110, 110, 0.2); font-family: monospace; margin: 32px 0;">{otp}</div>'
    
    html = _get_premium_template(title, f"{content}{otp_display}")
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", f"Your verification code is: {otp}", html)

async def send_upcoming_lecture_notice(email: str, teacher_name: str, subject: str, class_details: str, time: str) -> bool:
    title = "Upcoming Lecture Reminder"
    content = f"Hello {teacher_name},<br><br>This is a reminder that you have an upcoming lecture for <b>{subject}</b> ({class_details}) starting at <b>{time}</b>.<br>Please log into the Faculty Hub to start the session."
    html = _get_premium_template(title, content, "OPEN FACULTY HUB", _frontend_url('teacher-dashboard'))
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", f"Reminder: Lecture for {subject} at {time}.", html)

async def send_lecture_commenced_notice(email: str, student_name: str, subject: str, class_details: str, teacher_name: str) -> bool:
    title = "Lecture Commenced"
    name = student_name or 'Student'
    content = f"Hello {name},<br><br>Your lecture for <b>{subject}</b> ({class_details}) with <b>{teacher_name}</b> has just commenced.<br>Please open the Student Portal to mark your attendance via facial recognition."
    html = _get_premium_template(title, content, "MARK ATTENDANCE", _frontend_url('user-dashboard'))
    return await send_email(email, f"Smart Attendance System - {subject} Started", f"Lecture for {subject} has commenced.", html)


async def send_account_approved_notice(email: str) -> bool:
    title = "Account Approved"
    content = "Your faculty account for the Smart Attendance System Using Face Recognition platform has been successfully approved by an administrator. You may now log in to the system and access your dashboard."
    html = _get_premium_template(title, content, "LOGIN NOW", _frontend_url('login.html'))
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", content, html)


async def send_account_rejected_notice(email: str) -> bool:
    title = "Account Status Update"
    content = "Thank you for registering with the Smart Attendance System Using Face Recognition platform. Unfortunately, your faculty account request has not been approved at this time. If you believe this is an error or require further clarification, please contact your system administrator."
    html = _get_premium_template(title, content)
    return await send_email(email, f"Smart Attendance System Using Face Recognition - {title}", content, html)


def check_mail_health_sync() -> dict:
    if not settings.mail_enabled:
        return {"status": "disabled", "error": None}
    if not settings.mail_username or not settings.mail_password or not settings.mail_from:
        return {"status": "degraded", "error": "Missing SMTP credentials (username, password, or sender)"}
    try:
        timeout = 5
        if settings.mail_ssl_tls:
            with smtplib.SMTP_SSL(settings.mail_server, settings.mail_port, timeout=timeout) as client:
                if settings.use_credentials:
                    client.login(settings.mail_username, settings.mail_password)
        else:
            with smtplib.SMTP(settings.mail_server, settings.mail_port, timeout=timeout) as client:
                if settings.mail_starttls:
                    client.starttls()
                if settings.use_credentials:
                    client.login(settings.mail_username, settings.mail_password)
        return {"status": "healthy", "error": None}
    except Exception as exc:
        return {"status": "degraded", "error": str(exc)}


async def check_mail_health() -> dict:
    return await asyncio.to_thread(check_mail_health_sync)


