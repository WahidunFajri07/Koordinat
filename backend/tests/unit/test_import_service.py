"""Unit tests for import_service normalization and validation functions."""

import pytest
from pathlib import Path
from app.services.import_service import (
    normalize_idpel,
    validate_jenis_pel,
    validate_latitude,
    validate_longitude,
    parse_coordinate_combined,
    mask_idpel_for_debug,
    sanitize_rejected_data,
    build_rejected_reason,
    extract_mapped_value,
)


class TestNormalizeIdpel:
    """Test IDPEL normalization: scientific notation recovery, 12-digit validation."""

    def test_valid_12_digit_string(self):
        assert normalize_idpel("123456789012") == "123456789012"
        assert normalize_idpel(" 123456789012 ") == "123456789012"

    def test_scientific_notation_recovery(self):
        # 5.31E+11 -> 531000000000
        assert normalize_idpel("5.31E+11") == "531000000000"
        assert normalize_idpel("5.31000E+11") == "531000000000"
        assert normalize_idpel("1.23456789012E+11") == "123456789012"

    def test_invalid_idpel(self):
        assert normalize_idpel(None) is None
        assert normalize_idpel("") is None
        assert normalize_idpel("   ") is None
        assert normalize_idpel("12345") is None  # too short
        assert normalize_idpel("1234567890123") is None  # too long
        assert normalize_idpel("abcd12345678") is None  # non-digit


class TestValidateJenisPel:
    """Test jenis_pel validation: PASCA/PRABAYAR only, reject invalid."""

    def test_valid_jenis_pel(self):
        assert validate_jenis_pel("PASCA") == "PASCA"
        assert validate_jenis_pel("PRABAYAR") == "PRABAYAR"
        assert validate_jenis_pel("pasca") == "PASCA"  # case insensitive
        assert validate_jenis_pel(" PRABAYAR ") == "PRABAYAR"

    def test_empty_jenis_pel(self):
        assert validate_jenis_pel(None) is None
        assert validate_jenis_pel("") is None
        assert validate_jenis_pel("   ") is None

    def test_invalid_jenis_pel_raises(self):
        with pytest.raises(ValueError, match="jenis_pel tidak valid"):
            validate_jenis_pel("INVALID")
        with pytest.raises(ValueError, match="jenis_pel tidak valid"):
            validate_jenis_pel("PRE")


class TestValidateLatitude:
    """Test latitude validation: Indonesia bounds -11.0 to 6.0."""

    def test_valid_latitude(self):
        assert validate_latitude(-11.0) == -11.0
        assert validate_latitude(6.0) == 6.0
        assert validate_latitude(0.0) == 0.0
        assert validate_latitude(-5.5) == -5.5

    def test_invalid_latitude(self):
        assert validate_latitude(None) is None
        assert validate_latitude(-11.1) is None  # below min
        assert validate_latitude(6.1) is None  # above max
        assert validate_latitude(90.0) is None  # way outside
        assert validate_latitude("not_a_number") is None


class TestValidateLongitude:
    """Test longitude validation: Indonesia bounds 95.0 to 141.0."""

    def test_valid_longitude(self):
        assert validate_longitude(95.0) == 95.0
        assert validate_longitude(141.0) == 141.0
        assert validate_longitude(110.5) == 110.5

    def test_invalid_longitude(self):
        assert validate_longitude(None) is None
        assert validate_longitude(94.9) is None  # below min
        assert validate_longitude(141.1) is None  # above max
        assert validate_longitude(180.0) is None  # way outside
        assert validate_longitude("not_a_number") is None


class TestParseCoordinateCombined:
    """Test combined coordinate parsing: 'lat,lon' format, no auto-swap."""

    def test_valid_combined_format(self):
        result = parse_coordinate_combined("-6.2,106.8")
        assert result == (-6.2, 106.8)

    def test_invalid_combined_format(self):
        assert parse_coordinate_combined(None) is None
        assert parse_coordinate_combined("") is None
        assert parse_coordinate_combined("invalid") is None
        assert parse_coordinate_combined("-6.2") is None  # only one value
        assert parse_coordinate_combined("-6.2,106.8,100") is None  # three values

    def test_swapped_coordinates_not_auto_corrected(self):
        # If user provides lon,lat instead of lat,lon, parse returns it as-is
        result = parse_coordinate_combined("106.8,-6.2")
        assert result == (106.8, -6.2)  # lat=106.8 is invalid, will fail validation


class TestMaskIdpelForDebug:
    """Test IDPEL masking: preserve last 6 digits."""

    def test_mask_idpel(self):
        assert mask_idpel_for_debug("123456789012") == "******789012"
        assert mask_idpel_for_debug("000000000001") == "******000001"

    def test_mask_short_idpel(self):
        # Should still mask, even if not 12 digits
        assert mask_idpel_for_debug("12345") == "12345"[-6:]


class TestSanitizeRejectedData:
    """Test rejected row sanitization: mask IDPEL column."""

    def test_sanitize_with_idpel_column(self):
        row = {"nama": "John", "idpel_col": "123456789012", "tarif": "R1"}
        result = sanitize_rejected_data(row, "idpel_col")
        assert result["nama"] == "John"
        assert result["tarif"] == "R1"
        assert result["idpel_col"] == "******789012"

    def test_sanitize_without_idpel_column(self):
        row = {"nama": "John", "tarif": "R1"}
        result = sanitize_rejected_data(row, None)
        assert result == row  # no masking


class TestBuildRejectedReason:
    """Test rejection reason builder."""

    def test_build_with_field(self):
        result = build_rejected_reason("idpel", "IDPEL tidak valid")
        assert result == ("IDPEL tidak valid", "idpel")

    def test_build_without_field(self):
        result = build_rejected_reason(None, "Kesalahan umum")
        assert result == ("Kesalahan umum", None)


class TestExtractMappedValue:
    """Test column value extraction from row."""

    def test_extract_existing_column(self):
        row = {"col_a": "value_a", "col_b": "value_b"}
        mapping = {"col_a": "idpel", "col_b": "latitude"}
        assert extract_mapped_value(row, mapping, "idpel") == "value_a"
        assert extract_mapped_value(row, mapping, "latitude") == "value_b"

    def test_extract_missing_column(self):
        row = {"col_a": "value_a"}
        mapping = {"col_a": "idpel"}
        assert extract_mapped_value(row, mapping, "longitude") is None

    def test_extract_unmapped_target(self):
        row = {"col_a": "value_a"}
        mapping = {}
        assert extract_mapped_value(row, mapping, "idpel") is None
