from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class TokenData(BaseModel):
    email: str | None = None


class AnnouncementCreate(BaseModel):
    message: str
    expires_at: str

class AnnouncementOut(BaseModel):
    id: int | str
    department: str
    message: str
    created_by: int | str
    created_at: str
    expires_at: str


class UserBase(BaseModel):
    full_name: str | None = None
    email: EmailStr
    roll_number: str | None = None
    department: str | None = None
    department_id: str | None = None
    program: str | None = None
    course_id: str | None = None
    class_year: str | None = None
    academic_year: str | None = None
    batch_id: str | None = None
    is_batch_locked: bool = False
    elective_group_ids: list[str] = []
    enrolled_subjects: list[str] = []
    designation: str | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=6)
    face_image: str
    liveness_session_id: str | None = None
    liveness_frames: list[str] | None = None
    requested_role: str = "student"
    id_card_image: str | None = None


class TeacherCreate(BaseModel):
    admin_password: str
    full_name: str
    email: EmailStr
    employee_id: str
    department: str
    password: str = Field(min_length=6)


class AdminAccountCreate(BaseModel):
    admin_password: str
    account_type: Literal["teacher", "admin"] = "teacher"
    full_name: str
    email: EmailStr
    identifier: str = Field(min_length=1)
    department: str = Field(min_length=1)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class OTPRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class SetNewPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6)


class FaceCaptureRequest(BaseModel):
    image: str
    latitude: float | None = None
    longitude: float | None = None


class ManualAttendanceRequest(BaseModel):
    status: str = "Present"
    latitude: float | None = None
    longitude: float | None = None


class AdminFaceUpdateRequest(BaseModel):
    image: str
    admin_password: str


class AdminUserUpdateRequest(BaseModel):
    admin_password: str
    full_name: str | None = None
    email: EmailStr | None = None
    roll_number: str | None = None
    role: str | None = None
    department: str | None = None


class AdminSetActiveRequest(BaseModel):
    admin_password: str
    is_active: bool


class AdminBulkUpdateClassYearRequest(BaseModel):
    admin_password: str
    roll_numbers: list[str]
    class_year: str


class AdminResetPasswordRequest(BaseModel):
    admin_password: str


class AdminDeleteRequest(BaseModel):
    admin_password: str


class MarkAttendanceRequest(BaseModel):
    image: str
    latitude: float | None = None
    longitude: float | None = None
    attendance_status: str | None = None
    liveness_session_id: str | None = None
    liveness_frames: list[str] | None = None


class ClassSessionCreate(BaseModel):
    subject: str
    class_name: str | None = None
    department: str | None = None
    room_id: str | None = None
    course_id: str | None = None
    academic_year: str | None = None
    batch_id: str | None = None
    lecture_start_time: str | None = None
    lecture_end_time: str | None = None


class ClassSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | str
    subject: str
    class_name: str | None = None
    department: str | None = None
    room_id: str | None = None
    course_id: str | None = None
    academic_year: str | None = None
    batch_id: str | None = None
    teacher_id: int | str | None = None
    teacher_name: str | None = None
    status: str | None = "active"
    start_time: str | None = None
    end_time: str | None = None
    lecture_start_time: str | None = None
    lecture_end_time: str | None = None
    created_at: str | None = None
    room_code: str | None = None

class TeacherClassSessionOut(ClassSessionOut):
    pass


class StudentSelfAttendanceRequest(BaseModel):
    session_id: str | int
    room_code: str | None = ""
    image: str
    latitude: float | None = None
    longitude: float | None = None
    liveness_session_id: str | None = None
    liveness_frames: list[str] | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str | None = None
    email: EmailStr
    roll_number: str | None = None
    profile_picture: str | None = None
    is_active: bool
    is_verified: bool
    is_admin: bool
    role: str
    department: str | None = None
    program: str | None = None
    class_year: str | None = None
    enrolled_subjects: list[str] = []
    designation: str | None = None
    approval_status: str | None = None
    id_card_image: str | None = None
    requested_role: str | None = None
    face_image: str | None = None
    preferences: dict = {}
    created_at: str | None = None
    updated_at: str | None = None
    must_change_password: bool = False


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: str
    check_in: str
    check_out: str | None = None
    status: str
    marked_by_user_id: int | None = None
    method: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    session_id: str | int | None = None
    subject: str | None = None
    class_name: str | None = None
    teacher_name: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class AttendanceStats(BaseModel):
    present_days: int
    late_days: int = 0
    attended_days: int = 0
    absences: int
    marked_days: int = 0
    pending_days: int = 0
    calculation_start_date: str | None = None
    calculation_through_date: str | None = None
    avg_check_in: str
    attendance_percentage: float = 0.0
    history: list[AttendanceOut] = []


class AdminStats(BaseModel):
    total_users: int
    total_students: int
    present_today: int
    absent_today: int
    late_today: int = 0
    attendance_percentage: float = 0.0
    system_status: str
    email_status: str = "ok"
    email_error: str | None = None


class TeacherStats(BaseModel):
    total_students: int
    present: int
    late: int
    absent: int
    not_marked: int
    attendance_finalized: bool = False


class TeacherAttendanceRow(BaseModel):
    id: int
    roll_number: str | None = None
    full_name: str | None = None
    email: str
    status: str | None = None
    check_in: str | None = None
    department: str | None = None
    date: str | None = None
    method: str | None = None
    marked_by_user_id: int | None = None
    marked_by_name: str | None = None


class WeeklyReport(BaseModel):
    labels: list[str]
    counts: list[int]


class FacultyAttendanceReport(BaseModel):
    id: int
    full_name: str | None = None
    department: str | None = None
    attendance_percentage: float
    classes_attended: int
    total_classes: int
    status: str = "ACTIVE"


class MonitoringLocation(BaseModel):
    id: int
    name: str
    status: str
    lat: float
    lon: float


class MonthlyAttendanceSummary(BaseModel):
    id: int
    roll_number: str | None = None
    full_name: str | None = None
    department: str | None = None
    attendance_percentage: float
    classes_attended: int
    total_classes: int
    status: str


class PunctualityReport(BaseModel):
    on_time: int
    late: int
    absent: int


class UserStatusReport(BaseModel):
    active: int
    inactive: int


class MessageResponse(BaseModel):
    message: str


class LivenessChallengeResponse(BaseModel):
    session_id: str
    challenges: list[str]


class AdminConfig(BaseModel):
    face_tolerance: float
    campus_lat: float
    campus_lon: float
    max_distance_km: float
    late_hour: int
    late_minute: int
    grace_period_minutes: int
    absent_notice_hour: int
    absent_notice_minute: int
    mfa_enabled: bool = False
    geofencing_enabled: bool = False
    lockout_enabled: bool = False
    organization_type: str = "Engineering College"
    departments: list[str] = ["Computer Science", "Electronics & Communication", "Mechanical Engineering"]
    classes: list[str] = ["CS-201", "CS-202", "CS-203", "EC-201"]
    official_domain: str | None = None


class AdminConfigUpdate(BaseModel):
    admin_password: str
    face_tolerance: float | None = None
    campus_lat: float | None = None
    campus_lon: float | None = None
    max_distance_km: float | None = None
    late_hour: int | None = None
    late_minute: int | None = None
    grace_period_minutes: int | None = None
    absent_notice_hour: int | None = None
    absent_notice_minute: int | None = None
    mfa_enabled: bool | None = None
    geofencing_enabled: bool | None = None
    lockout_enabled: bool | None = None
    organization_type: str | None = None
    departments: list[str] | None = None
    classes: list[str] | None = None
    official_domain: str | None = None


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    department: str | None = None
    class_year: str | None = None
    preferences: dict | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6)


class TimetableCreate(BaseModel):
    admin_password: str
    department: str
    class_year: str
    course_id: str | None = None
    academic_year: str | None = None
    batch_id: str | None = None
    subject: str
    teacher_id: int
    day_of_week: str
    start_time: str
    end_time: str


class TimetableOut(BaseModel):
    id: int
    department: str
    class_year: str
    course_id: str | None = None
    academic_year: str | None = None
    batch_id: str | None = None
    subject: str
    teacher_id: int
    teacher_name: str
    day_of_week: str
    start_time: str
    end_time: str
    created_at: str | None = None


class DepartmentOut(BaseModel):
    id: str
    name: str


class CourseOut(BaseModel):
    id: str
    department_id: str
    name: str
    total_years: int


class BatchOut(BaseModel):
    id: str
    course_id: str
    academic_year: str
    batch_name: str
    capacity: int | None = None


class BatchRequestCreate(BaseModel):
    requested_batch_id: str
    reason: str


class BatchRequestOut(BaseModel):
    id: str
    student_id: int
    current_batch_id: str | None = None
    requested_batch_id: str
    reason: str
    status: str
    reviewed_by: int | None = None
    created_at: str


class RoomOut(BaseModel):
    id: str
    name: str
    type: str | None = None


class SubBatchOut(BaseModel):
    id: str
    parent_batch_id: str
    name: str


class AllocationCreate(BaseModel):
    batch_id: str | None = None
    sub_batch_id: str | None = None
    elective_group_id: str | None = None
    subject: str
    teacher_id: int
    room_id: str


class AllocationOut(BaseModel):
    batch_id: str | None = None
    sub_batch_id: str | None = None
    elective_group_id: str | None = None
    subject: str
    teacher_id: int
    teacher_name: str | None = None
    room_id: str


class TimetableV2Create(BaseModel):
    department_id: str
    course_id: str
    academic_year: str
    day_of_week: str
    start_time: str
    end_time: str
    slot_type: str
    allocations: list[AllocationCreate]


class TimetableV2Out(BaseModel):
    id: str
    department_id: str
    course_id: str
    academic_year: str
    day_of_week: str
    start_time: str
    end_time: str
    slot_type: str
    allocations: list[AllocationOut]
    created_at: str | None = None


class ElectiveCourseCreate(BaseModel):
    name: str
    department_id: str
    course_id: str
    academic_year: str


class ElectiveCourseOut(BaseModel):
    id: str
    name: str
    department_id: str
    course_id: str
    academic_year: str


class CustomGroupCreate(BaseModel):
    elective_course_id: str
    name: str
    capacity: int | None = None


class CustomGroupOut(BaseModel):
    id: str
    elective_course_id: str
    name: str
    capacity: int | None = None


class SessionLogCreate(BaseModel):
    timetable_slot_id: str
    subject: str
    room_id: str
    target_group_type: str
    target_group_id: str


class SessionLogOut(BaseModel):
    id: str
    timetable_slot_id: str
    teacher_id: int
    subject: str
    room_id: str
    target_group_type: str
    target_group_id: str
    actual_start_time: str
    actual_end_time: str | None = None
    status: str


class ProfileChangeRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    full_name: str | None = None
    email: EmailStr | None = None
    department: str | None = None
    designation: str | None = None
    employee_id: str | None = None


class ProfileChangeRequestReview(BaseModel):
    status: Literal["approved", "rejected"]


class ProfileChangeRequestOut(BaseModel):
    id: str
    teacher_id: int
    requested_changes: dict
    status: str
    timestamp: str
    reviewed_by: int | None = None
    review_timestamp: str | None = None


class AnnouncementCreate(BaseModel):
    message: str
    title: str | None = "Important Announcement"
    department: str | None = None
    duration_hours: int = 24
    expires_at: str | None = None


class AnnouncementOut(BaseModel):
    id: int | str
    department: str
    message: str
    title: str | None = "Important Announcement"
    created_by: int | str | None = None
    created_at: str
    expires_at: str


class DepartmentCreateWithHOD(BaseModel):
    department_name: str
    department_code: str | None = None
    create_new_hod: bool = True
    hod_full_name: str | None = None
    hod_email: EmailStr | None = None
    hod_roll_number: str | None = None
    hod_password: str | None = None
    promote_user_id: int | None = None
