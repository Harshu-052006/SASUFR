from __future__ import annotations

import base64
import io
from typing import Any

from fastapi import HTTPException

from ..config import settings

try:
    import face_recognition
    import numpy as np
    FACE_AVAILABLE = True
except Exception as exc:  # pragma: no cover - import guard
    FACE_AVAILABLE = False
    _FACE_ERROR = exc


def get_face_recognition_status() -> dict[str, bool | str | None]:
    return {
        "available": FACE_AVAILABLE,
        "error": None if FACE_AVAILABLE else str(_FACE_ERROR),
    }


def _decode_image(image_data: str):
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    try:
        raw = base64.b64decode(image_data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image data") from exc
    return face_recognition.load_image_file(io.BytesIO(raw))


async def verify_liveness(image_data: str, challenge: str | None) -> None:
    if not FACE_AVAILABLE or not challenge:
        return

    image = _decode_image(image_data)
    face_landmarks_list = face_recognition.face_landmarks(image)
    
    if len(face_landmarks_list) == 0:
        raise HTTPException(status_code=400, detail="No face detected for liveness check.")
    if len(face_landmarks_list) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected. Please ensure only one face is visible.")
        
    landmarks = face_landmarks_list[0]
    
    if challenge == "smile":
        top_lip = landmarks['top_lip']
        bottom_lip = landmarks['bottom_lip']
        top_y = min([p[1] for p in top_lip])
        bottom_y = max([p[1] for p in bottom_lip])
        left_x = min([p[0] for p in top_lip])
        right_x = max([p[0] for p in top_lip])
        
        mouth_height = bottom_y - top_y
        mouth_width = right_x - left_x
        if mouth_width == 0:
            raise HTTPException(status_code=400, detail="Liveness failed: Could not detect mouth properly")
            
        mar = mouth_height / mouth_width
        if mar < 0.15:
            raise HTTPException(status_code=400, detail="Liveness failed: Please smile widely (open your mouth slightly) for the camera")

    elif challenge in ["turn_left", "turn_right"]:
        nose_x = sum([p[0] for p in landmarks['nose_tip']]) / len(landmarks['nose_tip'])
        left_eye_x = sum([p[0] for p in landmarks['left_eye']]) / len(landmarks['left_eye'])
        right_eye_x = sum([p[0] for p in landmarks['right_eye']]) / len(landmarks['right_eye'])
        
        dist_left_eye = abs(nose_x - left_eye_x)
        dist_right_eye = abs(nose_x - right_eye_x)
        
        if challenge == "turn_left":
            if dist_right_eye >= dist_left_eye * 0.9:
                raise HTTPException(status_code=400, detail="Liveness failed: Please turn your head to your LEFT")
        elif challenge == "turn_right":
            if dist_left_eye >= dist_right_eye * 0.9:
                raise HTTPException(status_code=400, detail="Liveness failed: Please turn your head to your RIGHT")


async def extract_encoding(image_data: str) -> list[float]:
    if not FACE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"Face recognition unavailable: {_FACE_ERROR}")

    image = _decode_image(image_data)
    encodings = face_recognition.face_encodings(image)
    if len(encodings) == 0:
        raise HTTPException(status_code=400, detail="No face detected. Please try again.")
    if len(encodings) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected. Please ensure only one face is visible.")
    return encodings[0].tolist()


async def extract_multiple_encodings(image_data: str) -> list[list[float]]:
    if not FACE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"Face recognition unavailable: {_FACE_ERROR}")

    image = _decode_image(image_data)
    encodings = face_recognition.face_encodings(image)
    return [e.tolist() for e in encodings]


def _as_vector(face_encoding: Any):
    return np.array(face_encoding, dtype=float)


def compare_encoding(candidate: list[float], known: list[float]) -> float:
    if not FACE_AVAILABLE:
        return 1.0
    return float(face_recognition.face_distance([_as_vector(known)], _as_vector(candidate))[0])


async def find_best_match(candidate: list[float], users: list[dict]) -> dict | None:
    if not FACE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"Face recognition unavailable: {_FACE_ERROR}")

    from .vector_store import vector_store
    if vector_store.is_ready:
        results = vector_store.search(candidate, k=10, threshold=settings.face_tolerance)
        valid_users = {u["id"]: u for u in users}
        
        for res in results:
            if res["user_id"] in valid_users:
                return {"user": valid_users[res["user_id"]], "distance": res["distance"]}
        return None

    # Fallback to linear search
    from .crypto import decrypt_encoding
    best_user = None
    best_distance = 1.0
    for user in users:
        try:
            known = decrypt_encoding(user.get("face_encoding")) or []
        except Exception:
            continue
        if not known:
            continue
        try:
            distance = compare_encoding(candidate, known)
        except Exception:
            continue
        if distance < best_distance:
            best_distance = distance
            best_user = {"user": user, "distance": distance}

    if best_user and best_user["distance"] <= settings.face_tolerance:
        return best_user
    return None


async def find_matches(candidates: list[list[float]], users: list[dict]) -> list[dict]:
    if not FACE_AVAILABLE:
        return []

    from .vector_store import vector_store
    if vector_store.is_ready:
        matches = []
        valid_users = {u["id"]: u for u in users}
        
        for candidate in candidates:
            results = vector_store.search(candidate, k=10, threshold=settings.face_tolerance)
            for res in results:
                if res["user_id"] in valid_users:
                    matches.append({"user": valid_users[res["user_id"]], "distance": res["distance"]})
                    break # Take the closest valid user for this face candidate
        return matches

    # Fallback to linear search
    from .crypto import decrypt_encoding
    matches = []
    # Optimization: Convert all known face encodings to numpy arrays once
    known_users = []
    for u in users:
        try:
            encoding = decrypt_encoding(u.get("face_encoding"))
            if encoding:
                known_users.append((u, _as_vector(encoding)))
        except Exception:
            continue

    if not known_users:
        return []

    for candidate in candidates:
        candidate_vec = _as_vector(candidate)
        best_user = None
        best_distance = 1.0

        for user, known_vec in known_users:
            distance = float(face_recognition.face_distance([known_vec], candidate_vec)[0])
            if distance < best_distance:
                best_distance = distance
                best_user = user

        if best_user and best_distance <= settings.face_tolerance:
            matches.append({"user": best_user, "distance": best_distance})

    return matches
