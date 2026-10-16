"""Unit tests for audit service sanitization and IP extraction."""

from app.services.audit_service import extract_client_ip, sanitize_audit_state


def test_sanitize_audit_state_masks_idpel() -> None:
    """Audit sanitizer must mask IDPEL at all levels without leaking plain digits."""
    raw_state = {
        "idpel": "531234567890",
        "name": "Pelanggan Test",
        "nested": {
            "customer_idpel": "539988776655",
            "status": "active",
        },
        "items": [
            {"idpel_target": "531122334455", "value": 100},
        ],
    }

    sanitized = sanitize_audit_state(raw_state)
    assert sanitized["idpel"] == "******567890"
    assert sanitized["name"] == "Pelanggan Test"
    assert sanitized["nested"]["customer_idpel"] == "******776655"
    assert sanitized["items"][0]["idpel_target"] == "******334455"


def test_extract_client_ip_handles_forwarded() -> None:
    """IP extractor must prioritize the original client IP in X-Forwarded-For header."""

    class DummyRequest:
        def __init__(self) -> None:
            self.headers: dict[str, str] = {"x-forwarded-for": "203.0.113.195, 70.41.3.18"}
            self.client: object | None = None

    req = DummyRequest()
    ip = extract_client_ip(req)  # type: ignore
    assert ip == "203.0.113.195"
