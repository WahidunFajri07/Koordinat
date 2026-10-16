"""Key generator utility for IDPEL AES-256 encryption and blind index HMAC-SHA256."""

import base64
import os
import secrets


def generate_keys() -> None:
    """Generate 256-bit cryptographic keys encoded in base64."""
    encryption_key = base64.b64encode(secrets.token_bytes(32)).decode("utf-8")
    blind_index_key = base64.b64encode(secrets.token_bytes(32)).decode("utf-8")

    print("=" * 60)
    print("Rekonsiliasi Data Pelanggan — Security Keys Generated")
    print("=" * 60)
    print(f"ENCRYPTION_KEY={encryption_key}")
    print(f"BLIND_INDEX_KEY={blind_index_key}")
    print("=" * 60)
    print("Salin kedua key di atas ke file .env Anda!")
    print("=" * 60)


if __name__ == "__main__":
    generate_keys()
