import json
import logging
from cryptography.fernet import Fernet, InvalidToken
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Fernet instance if key is provided
if not settings.encryption_key:
    raise RuntimeError("ENCRYPTION_KEY is required in .env for biometric data security, but none is set.")
    
try:
    _fernet = Fernet(settings.encryption_key.encode('utf-8'))
except Exception as e:
    logger.error(f"Failed to initialize encryption: {e}")
    raise RuntimeError(f"Invalid ENCRYPTION_KEY provided: {e}")

def encrypt_encoding(encoding: list[float]) -> str:
    """
    Encrypts a face encoding list into a Fernet token string.
    """
    encoding_json = json.dumps(encoding)
    encrypted_bytes = _fernet.encrypt(encoding_json.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_encoding(data: str | list[float] | None) -> list[float] | None:
    """
    Decrypts a face encoding.
    Handles mixed-state gracefully:
    - If it's a list, it's plaintext, return as is.
    - If it's a string, it's an encrypted token, decrypt it.
    """
    if data is None:
        return None
        
    if isinstance(data, list):
        # Plaintext (unmigrated data or encryption disabled)
        return data
        
    if isinstance(data, str):
        try:
            decrypted_bytes = _fernet.decrypt(data.encode('utf-8'))
            return json.loads(decrypted_bytes.decode('utf-8'))
        except InvalidToken:
            logger.error("Failed to decrypt face encoding: Invalid token (wrong key or corrupted data).")
            raise
        except json.JSONDecodeError:
            logger.error("Failed to decode decrypted face encoding: Not valid JSON.")
            raise
            
    raise ValueError(f"Invalid face_encoding format: expected list or str, got {type(data)}")
