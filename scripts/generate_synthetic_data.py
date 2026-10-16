"""Synthetic data generator for Rekonsiliasi Data Pelanggan.

Generates realistic datasets with controlled anomalies:
1. Master Data (IDPEL + Coordinates) with duplicates, conflicts, Excel notation, non-digits.
2. PDPJ Data (Verified IDPELs) for anti-join exclusion testing.
3. Koordinat Kosong (Coordinates only) with known distances to master records to test accuracy.
"""

import argparse
import csv
import math
import os
import random
from pathlib import Path

# Indonesia (Java focus for high customer density)
LAT_MIN, LAT_MAX = -7.8, -6.0
LON_MIN, LON_MAX = 106.5, 112.5


def generate_noisy_idpel(base_num: int, anomaly_type: str) -> str:
    """Generate IDPEL with specific real-world formatting anomalies."""
    num_str = f"{base_num:012d}"
    if anomaly_type == "normal":
        return num_str
    elif anomaly_type == "whitespace":
        return f"  {num_str}  "
    elif anomaly_type == "hyphens":
        return f"{num_str[:4]}-{num_str[4:8]}-{num_str[8:]}"
    elif anomaly_type == "prefix":
        return f"PLN{num_str}"
    elif anomaly_type == "scientific":
        # Simulate Excel converting large integer to float string
        return f"{base_num:.5E}"
    elif anomaly_type == "short_invalid":
        return num_str[:8]
    elif anomaly_type == "long_invalid":
        return num_str + "999"
    return num_str


def offset_point(lat: float, lon: float, distance_meters: float, bearing_deg: float) -> tuple[float, float]:
    """Calculate new coordinates given distance in meters and bearing."""
    r_earth = 6378137.0  # WGS84 equatorial radius
    bearing_rad = math.radians(bearing_deg)
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)

    new_lat_rad = math.asin(
        math.sin(lat_rad) * math.cos(distance_meters / r_earth)
        + math.cos(lat_rad) * math.sin(distance_meters / r_earth) * math.cos(bearing_rad)
    )
    new_lon_rad = lon_rad + math.atan2(
        math.sin(bearing_rad) * math.sin(distance_meters / r_earth) * math.cos(lat_rad),
        math.cos(distance_meters / r_earth) - math.sin(lat_rad) * math.sin(new_lat_rad),
    )
    return math.degrees(new_lat_rad), math.degrees(new_lon_rad)


def generate_datasets(output_dir: Path, count: int = 10000, seed: int = 42) -> None:
    random.seed(seed)
    output_dir.mkdir(parents=True, exist_ok=True)

    master_path = output_dir / "master_sample.csv"
    pdpj_path = output_dir / "pdpj_sample.csv"
    kosong_path = output_dir / "kosong_sample.csv"
    ground_truth_path = output_dir / "ground_truth_matches.csv"

    print(f"Generating synthetic datasets ({count} master rows) in {output_dir}...")

    master_records = []
    base_id = 531000000000

    # 1. Generate Master Records
    for i in range(count):
        cur_id = base_id + i
        lat = random.uniform(LAT_MIN, LAT_MAX)
        lon = random.uniform(LON_MIN, LON_MAX)

        # Decide anomaly
        roll = random.random()
        if roll < 0.70:
            anomaly = "normal"
            coord_fmt = "two_col"
        elif roll < 0.78:
            anomaly = "whitespace"
            coord_fmt = "two_col"
        elif roll < 0.84:
            anomaly = "hyphens"
            coord_fmt = "single_col"
        elif roll < 0.88:
            anomaly = "scientific"
            coord_fmt = "two_col"
        elif roll < 0.92:
            anomaly = "comma_decimal"
            coord_fmt = "comma_decimal"
        elif roll < 0.95:
            anomaly = "swapped_coord"
            coord_fmt = "swapped"
        elif roll < 0.98:
            anomaly = "short_invalid"
            coord_fmt = "two_col"
        else:
            anomaly = "outside_indonesia"
            coord_fmt = "outside"

        idpel_str = generate_noisy_idpel(cur_id, anomaly)

        if coord_fmt == "swapped":
            out_lat, out_lon = lon, lat
        elif coord_fmt == "outside":
            out_lat, out_lon = 48.8566, 2.3522  # Paris
        else:
            out_lat, out_lon = lat, lon

        master_records.append({
            "idpel_raw": idpel_str,
            "idpel_clean": f"{cur_id:012d}",
            "lat": out_lat,
            "lon": out_lon,
            "tglbaca": random.choice(["05", "10", "15", "20", "25"]),
            "jenis_pel": random.choice(["PASCA", "PRABAYAR"]),
            "is_valid_idpel": anomaly not in ("short_invalid", "long_invalid"),
            "is_valid_coord": coord_fmt not in ("outside",),
            "anomaly": anomaly,
        })

    # Write master CSV with standard PLN columns
    with open(master_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["idpel", "koordinat_x", "koordinat_y", "tglbaca", "jenis_pel"])
        for r in master_records:
            writer.writerow([r["idpel_raw"], f"{r['lon']:.6f}", f"{r['lat']:.6f}", r["tglbaca"], r["jenis_pel"]])

    print(f"  [OK] Master CSV: {master_path} ({len(master_records)} baris)")

    # 2. Generate PDPJ (approx 25% of valid master records to exclude)
    valid_master = [r for r in master_records if r["is_valid_idpel"] and r["is_valid_coord"]]
    pdpj_sample = random.sample(valid_master, k=int(len(valid_master) * 0.25))

    with open(pdpj_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["NO_IDPEL_VALID"])
        for r in pdpj_sample:
            writer.writerow([r["idpel_clean"]])

    pdpj_idpels = {r["idpel_clean"] for r in pdpj_sample}
    print(f"  [OK] PDPJ CSV: {pdpj_path} ({len(pdpj_sample)} baris)")

    # 3. Generate Koordinat Kosong
    # Eligible master = valid master that are NOT excluded by PDPJ
    eligible_master = [r for r in valid_master if r["idpel_clean"] not in pdpj_idpels]
    kosong_count = min(len(eligible_master), int(count * 0.3))
    selected_master = random.sample(eligible_master, k=kosong_count)

    kosong_rows = []
    ground_truth = []

    for i, m in enumerate(selected_master):
        roll = random.random()
        if roll < 0.40:
            # Exact match (0 meters)
            k_lat, k_lon = m["lat"], m["lon"]
            dist = 0.0
            match_type = "exact"
        elif roll < 0.90:
            # Proximity match (between 1 and 24 meters)
            dist = random.uniform(1.0, 24.0)
            bearing = random.uniform(0, 360)
            k_lat, k_lon = offset_point(m["lat"], m["lon"], dist, bearing)
            match_type = "spatial_within"
        else:
            # Far / outside tolerance (> 40 meters)
            dist = random.uniform(40.0, 150.0)
            bearing = random.uniform(0, 360)
            k_lat, k_lon = offset_point(m["lat"], m["lon"], dist, bearing)
            match_type = "spatial_far"

        kosong_rows.append((k_lat, k_lon))
        ground_truth.append({
            "kosong_index": i + 1,
            "expected_idpel": m["idpel_clean"],
            "expected_distance_meters": dist,
            "match_type": match_type,
            "within_25m": dist <= 25.0,
        })

    with open(kosong_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["KOORDINAT_TITIK"])
        for lat, lon in kosong_rows:
            writer.writerow([f"{lat:.6f},{lon:.6f}"])

    print(f"  [OK] Koordinat Kosong CSV: {kosong_path} ({len(kosong_rows)} baris)")

    # Write ground truth for benchmark verification
    with open(ground_truth_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["kosong_index", "expected_idpel", "expected_distance_meters", "match_type", "within_25m"])
        writer.writeheader()
        writer.writerows(ground_truth)

    print(f"  [OK] Ground Truth CSV: {ground_truth_path} ({len(ground_truth)} baris)")
    print("Selesai menghasilkan data sintetis.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic customer and spatial datasets.")
    parser.add_argument("--count", type=int, default=10000, help="Number of master rows (default 10,000; use 500,000 for benchmark)")
    parser.add_argument("--out", type=str, default="data/synthetic", help="Output directory")
    args = parser.parse_args()

    out_directory = Path(args.out)
    generate_datasets(out_directory, count=args.count)
