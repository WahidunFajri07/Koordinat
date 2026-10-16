"""Unit tests for AES-256-GCM encryption, blind indexing, and IDPEL masking."""

import pytest

from app.core.encryption import (
    compute_blind_index,
    decrypt_idpel,
    encrypt_idpel,
    mask_idpel,
)


def test_encrypt_decrypt_roundtrip() -> None:
    """Test that IDPEL encrypts and decrypts back to identical string."""
    idpel = "531234567890"
    encrypted = encrypt_idpel(idpel)
    assert isinstance(encrypted, bytes)
    assert len(encrypted) > 28
    assert encrypted != idpel.encode()

    decrypted = decrypt_idpel(encrypted)
    assert decrypted == idpel


def test_encryption_uses_fresh_nonce() -> None:
    """Test that encrypting the same IDPEL twice produces distinct ciphertexts."""
    idpel = "531234567890"
    enc1 = encrypt_idpel(idpel)
    enc2 = encrypt_idpel(idpel)
    assert enc1 != enc2  # Nonce randomness prevents ciphertext reuse


def test_decrypt_invalid_length_raises() -> None:
    """Test that decrypting truncated bytes raises ValueError."""
    with pytest.raises(ValueError, match="Invalid encrypted data length"):
        decrypt_idpel(b"too_short")


def test_blind_index_deterministic() -> None:
    """Test that blind index is deterministic for exact matching and joining."""
    idpel = "531234567890"
    idx1 = compute_blind_index(idpel)
    idx2 = compute_blind_index(idpel)
    assert isinstance(idx1, bytes)
    assert len(idx1) == 32  # SHA-256 is 32 bytes
    assert idx1 == idx2

    # Different IDPEL produces different index
    idx3 = compute_blind_index("531234567891")
    assert idx1 != idx3


def test_mask_idpel() -> None:
    """Test that mask_idpel masks prefix and keeps only last 6 digits."""
    assert mask_idpel("531234567890") == "******567890"
    assert mask_idpel("123456") == "******"
    assert mask_idpel("123") == "***"
