from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


IST = ZoneInfo("Asia/Kolkata")


def get_campus_now() -> datetime:
    return datetime.now(IST)


now_ist = get_campus_now


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc() -> str:
    return now_utc().isoformat()


def iso_ist() -> str:
    return get_campus_now().isoformat()


def date_key(dt: datetime | None = None) -> str:
    return (dt or get_campus_now()).date().isoformat()


def time_key(dt: datetime | None = None) -> str:
    return (dt or get_campus_now()).strftime("%H:%M:%S")
