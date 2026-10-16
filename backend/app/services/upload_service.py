"""Service for file upload validation, SHA-256 hashing, fast preview, and column auto-detection."""

import csv
import hashlib
import re
from pathlib import Path
from typing import Any

import openpyxl

# Regex patterns for content-based detection
RE_IDPEL = re.compile(r"^\s*(\d{10,14}|\d\.\d+E\+\d+)\s*$", re.IGNORECASE)
RE_COMBINED_COORD = re.compile(r"^\s*[-+]?\d+[\.,]\d+\s*[,;\s]\s*[-+]?\d+[\.,]\d+\s*$")


def compute_file_hash(file_path: Path) -> str:
    """Compute SHA-256 hash of a file efficiently in chunks."""
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def read_file_preview(
    file_path: Path, max_rows: int = 15
) -> tuple[list[str], list[dict[str, Any]], list[str]]:
    """Read first N rows of CSV or XLSX file in < 2 seconds without loading entire file into memory.

    Returns: (headers, preview_rows, sheet_names)
    """
    suffix = file_path.suffix.lower()

    if suffix in (".xlsx", ".xls"):
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        sheet_names = wb.sheetnames
        sheet = wb.active or wb[sheet_names[0]]

        headers: list[str] = []
        preview_rows: list[dict[str, Any]] = []

        for row_idx, row in enumerate(sheet.iter_rows(values_only=True)):
            if row_idx == 0:
                headers = [
                    str(cell).strip() if cell is not None else f"Kolom_{i+1}"
                    for i, cell in enumerate(row)
                ]
            elif row_idx <= max_rows:
                row_dict: dict[str, Any] = {}
                for h_idx, h in enumerate(headers):
                    val = row[h_idx] if h_idx < len(row) else ""
                    row_dict[h] = str(val) if val is not None else ""
                preview_rows.append(row_dict)
            else:
                break
        wb.close()
        return headers, preview_rows, sheet_names

    # Default: CSV reader with encoding fallback
    encodings = ["utf-8-sig", "utf-8", "latin1", "cp1252"]
    for enc in encodings:
        try:
            with open(file_path, encoding=enc, newline="") as f:
                # Read sample to detect delimiter
                sample = f.read(8192)
                f.seek(0)
                delimiter = ","
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                    delimiter = dialect.delimiter
                except Exception:
                    if ";" in sample and "," not in sample:
                        delimiter = ";"

                reader = csv.reader(f, delimiter=delimiter)
                raw_headers = next(reader, None)
                if not raw_headers:
                    return [], [], []

                headers = [
                    h.strip() if h.strip() else f"Kolom_{i+1}" for i, h in enumerate(raw_headers)
                ]
                preview_rows = []
                for row_idx, row in enumerate(reader):
                    if row_idx >= max_rows:
                        break
                    row_dict = {}
                    for h_idx, h in enumerate(headers):
                        val = row[h_idx] if h_idx < len(row) else ""
                        row_dict[h] = val.strip()
                    preview_rows.append(row_dict)
                return headers, preview_rows, ["Sheet1"]
        except UnicodeDecodeError:
            continue

    raise ValueError("Gagal membaca file: format encoding tidak didukung")


def auto_detect_columns(
    headers: list[str], sample_rows: list[dict[str, Any]], file_type: str
) -> dict[str, str]:
    """Auto-detect target column mappings using header names and cell content patterns.

    Target fields:
    - idpel
    - latitude
    - longitude
    - coordinate_combined
    - ignore
    """
    mapping: dict[str, str] = {}
    assigned_targets: set[str] = set()

    for h in headers:
        norm = h.lower().replace(" ", "_").replace("-", "_")

        # 1. Match IDPEL
        if "idpel" not in assigned_targets and any(
            kw in norm
            for kw in (
                "idpel",
                "id_pelanggan",
                "id_pel",
                "no_pelanggan",
                "id_cust",
                "nomor_pelanggan",
            )
        ):
            mapping[h] = "idpel"
            assigned_targets.add("idpel")
            continue

        # 2. Match Latitude (koordinat_y / lintang)
        if "latitude" not in assigned_targets and (
            norm in ("y", "koordinat_y", "coord_y", "y_coord")
            or any(
                kw in norm
                for kw in (
                    "latitude",
                    "lat",
                    "lintang",
                    "koordinat_lat",
                    "y_coord",
                    "coord_y",
                    "koordinat_y",
                )
            )
        ):
            mapping[h] = "latitude"
            assigned_targets.add("latitude")
            continue

        # 3. Match Longitude (koordinat_x / bujur)
        if "longitude" not in assigned_targets and (
            norm in ("x", "koordinat_x", "coord_x", "x_coord")
            or any(
                kw in norm
                for kw in (
                    "longitude",
                    "lon",
                    "lng",
                    "bujur",
                    "koordinat_lon",
                    "x_coord",
                    "coord_x",
                    "koordinat_x",
                )
            )
        ):
            mapping[h] = "longitude"
            assigned_targets.add("longitude")
            continue

        # 4. Match Tanggal Baca (tglbaca)
        if "tglbaca" not in assigned_targets and any(
            kw in norm for kw in ("tglbaca", "tgl_baca", "tanggal_baca", "tgl_baca_meter")
        ):
            mapping[h] = "tglbaca"
            assigned_targets.add("tglbaca")
            continue

        # 5. Match Jenis Pelanggan (jenis_pel)
        if "jenis_pel" not in assigned_targets and any(
            kw in norm
            for kw in ("jenis_pel", "jenispel", "jenis_pelanggan", "tipe_pelanggan", "gol_tarif")
        ):
            mapping[h] = "jenis_pel"
            assigned_targets.add("jenis_pel")
            continue

        # 6. Match Combined Coordinate
        if "coordinate_combined" not in assigned_targets and any(
            kw in norm for kw in ("koordinat", "coordinate", "lat_lon", "titik", "lokasi", "geom")
        ):
            mapping[h] = "coordinate_combined"
            assigned_targets.add("coordinate_combined")
            continue

        # Fallback to ignore for header match
        mapping[h] = "ignore"

    # 5. Content-based verification/fallback if essential targets not found
    if sample_rows:
        for h in headers:
            if mapping[h] != "ignore":
                continue

            values = [row.get(h, "").strip() for row in sample_rows if row.get(h, "").strip()]
            if not values:
                continue

            # Check IDPEL by content (all digits 10-14 or Excel sci notation)
            if (
                "idpel" not in assigned_targets
                and file_type in ("master", "pdpj")
                and all(RE_IDPEL.match(v) for v in values[:5])
            ):
                mapping[h] = "idpel"
                assigned_targets.add("idpel")
                continue

            # Check combined coordinate by content ("lat,lon")
            if (
                "coordinate_combined" not in assigned_targets
                and file_type in ("master", "kosong")
                and all(RE_COMBINED_COORD.match(v) for v in values[:5])
            ):
                mapping[h] = "coordinate_combined"
                assigned_targets.add("coordinate_combined")
                continue

            # Check latitude by numeric range (-11 to 6)
            if "latitude" not in assigned_targets and file_type in ("master", "kosong"):
                try:
                    floats = [float(v.replace(",", ".")) for v in values[:5]]
                    if all(-11.5 <= f <= 6.5 for f in floats):
                        mapping[h] = "latitude"
                        assigned_targets.add("latitude")
                        continue
                except ValueError:
                    pass

            # Check longitude by numeric range (95 to 141)
            if "longitude" not in assigned_targets and file_type in ("master", "kosong"):
                try:
                    floats = [float(v.replace(",", ".")) for v in values[:5]]
                    if all(94.5 <= f <= 141.5 for f in floats):
                        mapping[h] = "longitude"
                        assigned_targets.add("longitude")
                        continue
                except ValueError:
                    pass

    return mapping
