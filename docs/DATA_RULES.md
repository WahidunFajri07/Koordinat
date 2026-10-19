# DATA_RULES.md — Aturan Pembersihan, Validasi, & Spesifikasi Kolom Data

## 1. Spesifikasi Kolom Data (Per Jenis Upload)
Sistem melakukan auto-mapping kolom berdasarkan header dengan aturan berikut:

| Jenis File | Kolom Wajib/Relevan |
|---|---|
| **Master** | `idpel`, `koordinat_x` (X), `koordinat_y` (Y), `tglbaca`, `jenis_pel` |
| **PDPJ** | `idpel`, `koordinat` |
| **K. Kosong (idpel_kosong)** | `koordinat` |
| **K. Kosong (idpel_tdk_ditemukan)** | `idpel`, `koordinat` |

## 2. Aturan Validasi IDPEL
1. **Pembersihan String**:
   - Trim whitespace depan & belakang.
   - Hapus semua karakter non-digit (tanda minus, spasi, titik, dsb.).
   - Normalisasi format scientific notation dari Excel ke string integer.
2. **Validasi Panjang**:
   - Default: 12 digit.
   - Jika tidak sesuai/kosong: ditolak ke `rejected_rows`.
3. **Deduplikasi**:
   - Exact deduplication menggunakan HMAC-SHA256 `blind_index`.
   - Konflik koordinat untuk IDPEL sama: ditandai `has_coordinate_conflict = true` untuk review.

## 3. Aturan Pembersihan Koordinat
1. **Format Input yang Didukung**:
   - Satu kolom string: `"lat,lon"` atau `"lon,lat"` (separator koma, titik koma, spasi).
   - Dua kolom terpisah: `latitude` dan `longitude` / `koordinat_x` dan `koordinat_y`.
2. **Validasi Wilayah Indonesia**:
   - Latitude: `-11.0` s/d `6.0`
   - Longitude: `95.0` s/d `141.0`
3. **Deteksi Nilai Invalid**: (0, 0), NaN, atau kosong otomatis ditolak.
4. **Auto-swap**: Jika Latitude/Longitude tertukar range, sistem otomatis menukar dan log audit.

## 4. Aturan Eksklusi PDPJ
- Dilakukan operasi **Left Anti-Join** berdasarkan `blind_index` untuk mengecualikan data PDPJ dari proses Master & pencocokan.

## 5. Pencocokan Spasial (Matching)
1. **Exact Match**: Jarak = 0.0 m.
2. **Proximity Match**: Jarak <= `tolerance_meters` (default 25 m).
3. **Algoritma**: PostGIS `ST_DWithin` dan operator KNN `<->` (maks 10 kandidat teratas).
