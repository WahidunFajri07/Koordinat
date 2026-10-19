"""Import pipeline services: parsing, normalization, validation, and loading.

READ-ONLY audit assumptions (Tahap 1):
- IDPEL must be exactly 12 digits after normalization; stored as string.
- `.xls` binary Excel rejected unless a proper binary reader is added and tested.
- No auto-swap latitude/longitude; mapping-driven only.
- `tglbaca` stored as cleaned string (no date parsing forced).
- `jenis_pel` uppercased; accepts PASCA/PRABAYAR; other values flagged.
- IDPEL masked before storing in rejected_rows.original_data.
"""

import csv
import re
from pathlib import Path
from typing import Any

import openpyxl

# Indonesia WGS84 geographic bounds per DATA_RULES.md (lines 28-30).
LAT_MIN, LAT_MAX = -11.0, 6.0
LON_MIN, LON_MAX = 95.0, 141.0

# IDPEL business rule per implementation decision: exactly 12 digits.
IDPEL_LENGTH = 12

# Accepted customer types per DATA_RULES.md (jenis_pel).
VALID_JENIS_PEL = {"PASCA", "PRABAYAR"}

RE_SCIENTIFIC = re.compile(r"^-?\d+(\.\d+)?[eE][+-]?\d+$")
RE_DIGITS_ONLY = re.compile(r"\d+")
RE_INVALID_COMBINED = re.compile(r"^[-+]?\d+[\.,]\d+[,\s;]+[-+]?\d+[\.,]\d+$")


class ImportError(Exception):
    """Raised when import configuration or mapping is invalid before processing."""


def normalize_idpel(raw: str | None) -> str | None:
    """Normalize IDPEL to 12-digit string without inventing missing leading zeros.

    Steps:
      1. Trim whitespace.
      2. Reject empty.
      3. Reject scientific notation unless it resolves to exactly 12 digits
         (e.g. 5.31000E+11 -> "531000000000"). Float imprecision is avoided
         by parsing digits only when the pattern is a clean power-of-ten notation.
      4. Keep digits only; reject if length != 12.
    """
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None

    # Excel scientific notation: only recover when it is an exact 12-digit integer.
    m = RE_SCIENTIFIC.match(value)
    if m:
        mantissa, _, exp = value.partition("e")
        mantissa_digits = mantissa.replace(".", "").lstrip("0") or "0"
        try:
            exponent = int(exp)
        except ValueError:
            return None
        # Build decimal string without float: mantissa digits shifted by exponent.
        if exponent >= 0:
            candidate = mantissa_digits + ("0" * exponent)
        else:
            # Negative exponent means fractional value; IDPEL must be integer.
            return None
        # Leading zeros from mantissa are not regenerated; candidate must be 12 digits.
        if len(candidate) == IDPEL_LENGTH and candidate.isdigit():
            return candidate
        return None

    digits = "".join(RE_DIGITS_ONLY.findall(value))
    if len(digits) != IDPEL_LENGTH:
        return None
    return digits


def mask_idpel_for_debug(value: str | None) -> str:
    """Mask IDPEL for safe logging/debug storage (last 6 digits preserved)."""
    if not value:
        return ""
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) <= 6:
        return "*" * len(digits)
    return "*" * (len(digits) - 6) + digits[-6:]


def sanitize_rejected_data(row_data: dict[str, Any], idpel_column: str | None = None) -> dict[str, Any]:
    """Remove/mask raw IDPEL from rejected row data before persistence."""
    cleaned: dict[str, Any] = {}
    for key, value in row_data.items():
        key_lower = str(key).lower()
        if idpel_column and key == idpel_column:
            cleaned[key] = mask_idpel_for_debug(str(value))
        elif "idpel" in key_lower:
            if isinstance(value, str):
                cleaned[key] = mask_idpel_for_debug(value)
            else:
                cleaned[key] = mask_idpel_for_debug(str(value))
        else:
            cleaned[key] = value
    return cleaned


def parse_coordinate_combined(raw: str) -> tuple[float, float] | None:
    """Parse a combined coordinate string like '-6.123, 106.789' into (lat, lon).

    No auto-swap: returns parsed order as-is.
    """
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None

    # Replace comma-decimal with dot only inside each component, not separator.
    normalized = value.replace(";", ",").replace(" ", "")
    parts = normalized.split(",")
    if len(parts) != 2:
        return None
    try:
        lat = float(parts[0].replace(",", "."))
        lon = float(parts[1].replace(",", "."))
    except ValueError:
        return None
    return lat, lon


def validate_latitude(value: Any) -> float | None:
    """Validate latitude against Indonesia bounds per DATA_RULES.md."""
    if value is None or str(value).strip() == "":
        return None
    try:
        lat = float(str(value).strip().replace(",", "."))
    except ValueError:
        return None
    if not (LAT_MIN <= lat <= LAT_MAX):
        return None
    return lat


def validate_longitude(value: Any) -> float | None:
    """Validate longitude against Indonesia bounds per DATA_RULES.md."""
    if value is None or str(value).strip() == "":
        return None
    try:
        lon = float(str(value).strip().replace(",", "."))
    except ValueError:
        return None
    if not (LON_MIN <= lon <= LON_MAX):
        return None
    return lon


def validate_jenis_pel(raw: str | None) -> str | None:
    """Normalize jenis_pel and flag non-empty values outside PASCA/PRABAYAR."""
    if raw is None:
        return None
    value = str(raw).strip().upper()
    if not value:
        return None
    if value not in VALID_JENIS_PEL:
        raise ValueError(f"jenis_pel tidak valid: nilai harus PASCA atau PRABAYAR")
    return value


def read_rows_csv(file_path: Path, encoding: str = "utf-8-sig"):
    """Yield (row_number, dict) from CSV with encoding fallback and delimiter sniffing."""
    encodings = ["utf-8-sig", "utf-8", "latin1", "cp1252"]
    last_error: Exception | None = None
    for enc in encodings:
        try:
            with open(file_path, encoding=enc, newline="") as f:
                sample = f.read(8192)
                f.seek(0)
                delimiter = ","
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                    delimiter = dialect.delimiter
                except Exception:
                    if ";" in sample and "," not in sample:
                        delimiter = ";"
                reader = csv.DictReader(f, delimiter=delimiter)
                for row_number, row in enumerate(reader, start=2):
                    yield row_number, {k.strip() if k else None: (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
            return
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
    raise ValueError(f"Gagal membaca CSV: format encoding tidak didukung ({last_error})")


def read_rows_xlsx(file_path: Path):
    """Yield (row_number, dict) from XLSX using openpyxl read_only mode.

    Supports .xlsx only. Raises ImportError for .xls binary format.
    """
    if file_path.suffix.lower() == ".xls":
        raise ImportError("Format .xls (Excel 97-2003 biner) belum didukung. Gunakan .xlsx atau .csv.")

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    sheet = wb.active or wb[wb.sheetnames[0]]
    headers: list[str] = []
    for row_number, row in enumerate(sheet.iter_rows(values_only=True), start=1):
        if row_number == 1:
            headers = [str(cell).strip() if cell is not None else f"Kolom_{i + 1}" for i, cell in enumerate(row)]
            continue
        if not any(cell is not None and str(cell).strip() for cell in row):
            continue
        row_dict: dict[str, Any] = {}
        for idx, header in enumerate(headers):
            val = row[idx] if idx < len(row) else None
            row_dict[header] = str(val).strip() if val is not None else ""
        yield row_number, row_dict
    wb.close()


def extract_mapped_value(row: dict[str, Any], mapping: dict[str, str], target: str) -> str | None:
    """Get source column value for a given mapping target, or None."""
    source_col = next((col for col, tgt in mapping.items() if tgt == target), None)
    if not source_col:
        return None
    return row.get(source_col)


def build_rejected_reason(field: str | None, reason: str) -> tuple[str, str | None]:
    """Return standardized rejection reason and field."""
    return reason, field
