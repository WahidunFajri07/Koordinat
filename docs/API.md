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
  - Response: Metadata upload, SHA-256 hash, pratinjau cuplikan baris, dan deteksi kolom.
- **`POST /api/v1/upload/pdpj`** (Role: Analis, Admin)
  - Content-Type: `multipart/form-data`
  - Parameter: `file`
- **`POST /api/v1/upload/kosong`** (Role: Analis, Admin)
  - Content-Type: `multipart/form-data`
  - Parameter: `file`
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
  - Memulai task Celery untuk exact match dan ST_DWithin KNN.

### Kandidat Pencocokan
- **`GET /api/v1/candidates`** (Role: Analis, Admin)
  - Query parameters:
    - `page` (int, default 1)
    - `page_size` (int, default 20)
    - `status` (unresolved|valid|invalid)
    - `max_distance` (float)
    - `q` (string search)
- **`PATCH /api/v1/candidates/{id}`** (Role: Analis, Admin)
  - Body:
    ```json
    {
      "status": "valid" // atau "invalid"
    }
    ```
  - Otomatis mencatat perubahan status ke `audit_log`.

### Input Manual
- **`POST /api/v1/manual-entry`** (Role: Analis, Admin)
  - Body:
    ```json
    {
      "idpel": "123456789012",
      "latitude": -6.2088,
      "longitude": 106.8456,
      "notes": "Survei lapangan permohonan baru"
    }
    ```

### Riwayat & Monitoring
- **`GET /api/v1/history`** (Role: Analis, Admin, Auditor)
  - Daftar riwayat proses upload dan matching beserta status & progress.
- **`GET /api/v1/history/{id}`** (Role: Analis, Admin, Auditor)
  - Detail status proses dan download rejected rows.

### Audit Log
- **`GET /api/v1/audit-log`** (Role: Admin, Auditor)
  - Pagination dan filter berdasarkan tanggal, user, dan aksi.

### Ekspor Data
- **`GET /api/v1/export/{id}`** (Role: Analis, Admin)
  - Download hasil rekonsiliasi dalam format CSV atau XLSX dengan proteksi CSV formula injection.
