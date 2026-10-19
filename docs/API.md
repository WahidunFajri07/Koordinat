# API.md — Dokumentasi API Rekonsiliasi Data Pelanggan

Base URL: `/api/v1`

## 1. Autentikasi
Semua endpoint (kecuali `/health`) memerlukan header Authorization Bearer Token dari OIDC (Keycloak):
```http
Authorization: Bearer <access_token>
```

Format Error: RFC 7807 (Problem Details for HTTP APIs - `application/problem+json`).

---

## 2. Daftar Endpoint

### Health
- **`GET /api/v1/health`**
  - Deskripsi: Cek ketersediaan layanan backend (publik).
  - Response:
    ```json
    {
      "status": "ok",
      "service": "Rekonsiliasi Data Pelanggan"
    }
    ```

### Upload File
- **`POST /api/v1/upload/master`** (Role: Analis, Admin)
  - Content-Type: `multipart/form-data`
  - Parameter: `file` (CSV atau XLSX, maks 200MB)
  - Kolom utama: `idpel`, `koordinat_x`, `koordinat_y`, `tglbaca`, `jenis_pel`.
  - Response: Metadata upload, SHA-256 hash, cuplikan baris, dan deteksi kolom otomatis.
- **`POST /api/v1/upload/pdpj`** (Role: Analis, Admin)
  - Content-Type: `multipart/form-data`
  - Parameter: `file`
  - Kolom utama: `idpel`, `koordinat` (opsional). Fungsi anti-join.
- **`POST /api/v1/upload/kosong`** (Role: Analis, Admin)
  - Content-Type: `multipart/form-data`
  - Parameter: `file`, `sub_type` (`idpel_kosong` atau `idpel_tidak_ditemukan`)
  - Subtipe `idpel_kosong`: kolom `koordinat`.
  - Subtipe `idpel_tidak_ditemukan`: kolom `idpel`, `koordinat`.
- **`POST /api/v1/upload/{id}/mapping`** (Role: Analis, Admin)
  - Body: JSON koreksi mapping nama kolom.
  - Memicu pipeline cleaning & loading via Celery.

### Proses Matching Spasial
- **`POST /api/v1/process/match`** (Role: Analis, Admin)
  - Body:
    ```json
    {
      "master_upload_id": "uuid (opsional)",
      "kosong_upload_id": "uuid",
      "tolerance_meters": 25.0
    }
    ```

### Kandidat Pencocokan
- **`GET /api/v1/candidates`** (Role: Analis, Admin)
- **`PATCH /api/v1/candidates/{id}`** (Role: Analis, Admin)
  - Body: `{"status": "valid"}` atau `{"status": "invalid"}`

### Input Manual
- **`POST /api/v1/manual-entry`** (Role: Analis, Admin)

### Riwayat & Monitoring
- **`GET /api/v1/history`** (Role: Analis, Admin, Auditor)
- **`GET /api/v1/history/{id}`** (Role: Analis, Admin, Auditor)

### Audit Log
- **`GET /api/v1/audit-log`** (Role: Admin, Auditor)

### Ekspor Data (CSV)
- **`GET /api/v1/export/{id}`** (Role: Analis, Admin)
  - Format unduhan CSV wajib memuat header exact:
    ```csv
    noagenda,idpelanggan,verif,jenispelanggan,latitudey,longitudex
    ```
