"""Encryption and cryptographic primitives for IDPEL protection.

Dual-column design:
1. idpel_encrypted (AES-256-GCM): Nonce (12B) || Ciphertext || Tag (16B). Used for UI decrypt.
2. idpel_blind_index (HMAC-SHA256): Deterministic 32-byte digest used for dedup, joins, anti-join, and searching without mass decryption.
3. mask_idpel: Utility to mask IDPEL for logs and audit trails (e.g. '531000000001' -> '******000001').
"""

import base64
import hashlib
import hmac
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def get_encryption_key() -> bytes:
    """Load and decode the 32-byte AES-256 key from environment settings."""
    raw = settings.encryption_key
    if not raw or raw == "changeme":
        # Fallback 32-byte key for testing/dev if unset
        return b"\x00" * 32
    try:
        decoded = base64.b64decode(raw)
        if len(decoded) != 32:
            return hashlib.sha256(raw.encode()).digest()
        return decoded
    except Exception:
        return hashlib.sha256(raw.encode()).digest()


def get_blind_index_key() -> bytes:
    """Load and decode the 32-byte HMAC key from environment settings."""
    raw = settings.blind_index_key
    if not raw or raw == "changeme":
        return b"\x01" * 32
    try:
        decoded = base64.b64decode(raw)
        if len(decoded) != 32:
            return hashlib.sha256(raw.encode()).digest()
        return decoded
    except Exception:
        return hashlib.sha256(raw.encode()).digest()


def encrypt_idpel(idpel: str) -> bytes:
    """Encrypt IDPEL string with AES-256-GCM using a fresh 12-byte random nonce.

    Returns: nonce (12 bytes) + ciphertext + tag (16 bytes).
    """
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, idpel.encode("utf-8"), None)
    return nonce + ciphertext


def decrypt_idpel(encrypted_bytes: bytes) -> str:
    """Decrypt IDPEL bytes with AES-256-GCM."""
    if len(encrypted_bytes) < 28:
        raise ValueError("Invalid encrypted data length")
    key = get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = encrypted_bytes[:12]
    ciphertext = encrypted_bytes[12:]
    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode("utf-8")


def compute_blind_index(idpel: str) -> bytes:
    """Compute deterministic HMAC-SHA256 blind index for IDPEL string."""
    key = get_blind_index_key()
    return hmac.new(key, idpel.strip().encode("utf-8"), hashlib.sha256).digest()


def mask_idpel(idpel: str) -> str:
    """Mask IDPEL for safe logging and display: preserves last 6 digits.

    Example: '531000000001' -> '******000001'
    """
    s = idpel.strip()
    if len(s) <= 6:
        return "*" * len(s)
    return "*" * (len(s) - 6) + s[-6:]
