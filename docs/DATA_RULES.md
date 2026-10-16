# DATA_RULES.md — Aturan Pembersihan & Validasi Data

## 1. Aturan Validasi IDPEL
1. **Pembersihan String**:
   - Trim whitespace depan & belakang.
   - Hapus semua karakter non-digit (tanda minus, spasi, titik, dsb.).
   - Normalisasi format scientific notation dari Excel (contoh: `5.31234E+11` diubah kembali ke string integer `531234000000`).
2. **Validasi Panjang**:
   - Default: 12 digit (configurable via `system_config` atau env `IDPEL_LENGTH`).
   - Jika panjang tidak sesuai atau kosong: baris ditolak dan dicatat ke `rejected_rows`.
3. **Deduplikasi**:
   - Exact deduplication menggunakan HMAC-SHA256 `blind_index`.
   - Jika IDPEL yang sama memiliki koordinat berbeda: ditandai `has_coordinate_conflict = true` untuk review analis.

## 2. Aturan Pembersihan Koordinat
1. **Format Input yang Didukung**:
   - Satu kolom string: `"lat,lon"` atau `"lon,lat"` (dengan separator koma, titik koma, atau spasi).
   - Dua kolom terpisah: `latitude` dan `longitude`.
   - Format desimal dengan tanda koma (contoh: `-6,12345` dinormalisasi menjadi `-6.12345`).
2. **Deteksi Nilai Kosong / Invalid**:
   - Nilai (0, 0) atau `NaN` / kosong otomatis ditolak ke `rejected_rows`.
3. **Validasi Wilayah Indonesia**:
   - Latitude: `-11.0` s/d `6.0`
   - Longitude: `95.0` s/d `141.0`
4. **Deteksi Lat/Lon Tertukar (Auto-swap)**:
   - Jika Latitude di luar range `[-11, 6]` tetapi berada dalam range `[95, 141]`, dan Longitude berada dalam range `[-11, 6]`, maka sistem otomatis menukar nilainya dan menandai log audit.

## 3. Aturan Eksklusi PDPJ
- File PDPJ berisi IDPEL yang sudah terverifikasi sebelumnya.
- Dilakukan operasi **Left Anti-Join**:
  ```sql
  SELECT m.* 
  FROM master_records m
  LEFT JOIN pdpj_records p ON m.idpel_blind_index = p.idpel_blind_index
  WHERE p.idpel_blind_index IS NULL;
  ```
- Hanya baris master yang belum ada di PDPJ yang akan diikutsertakan dalam pencocokan spasial.

## 4. Pencocokan Spasial (Matching)
1. **Exact Match**: Jarak = 0.0 m (koordinat identik).
2. **Proximity Match**: Jarak <= `tolerance_meters` (default 25 m).
3. **Algoritma**: Menggunakan PostGIS `ST_DWithin(geom, geom, tolerance)` dan operator KNN `<->` untuk perankingan terdekat (maks 10 kandidat teratas).
