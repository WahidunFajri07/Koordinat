# RUNBOOK.md — Panduan Operasional & Deployment

## 1. Persyaratan Sistem
- Docker Engine 24+ & Docker Compose v2.20+
- Host RAM minimum 8 GB (direkomendasikan 16 GB untuk dataset >= 500k baris)
- Disk space bebas minimum 20 GB

## 2. Inisialisasi Proyek dari Nol
1. **Konfigurasi Environment**:
   ```bash
   cp .env.example .env
   python scripts/generate_keys.py
   # Salin ENCRYPTION_KEY dan BLIND_INDEX_KEY ke .env
   ```
2. **Jalankan Semua Service**:
   ```bash
   make up
   # atau: docker compose up -d --build
   ```
3. **Jalankan Migrasi Database**:
   ```bash
   make migrate
   ```
4. **Isi Data Awal (Seed)**:
   ```bash
   make seed
   ```

## 3. Akun Pengguna Contoh (Keycloak)
Semua user terdaftar pada realm `rekonsiliasi` dengan default password `password123`:
- **Analis**: `analis@example.com`
- **Admin**: `admin@example.com`
- **Auditor**: `auditor@example.com`

Konsol Admin Keycloak: `http://localhost:8080/admin` (admin / admin).

## 4. Perintah Pemeliharaan Harian
- **Melihat Log**:
  ```bash
  make logs         # Semua kontainer
  make logs-api     # FastAPI server
  make logs-worker  # Celery workers
  ```
- **Akses CLI Database**:
  ```bash
  make shell-db
  # Didalam psql: \dx untuk melihat extension postgis
  ```
- **Testing**:
  ```bash
  make test
  ```
- **Linting**:
  ```bash
  make lint
  ```

## 5. Pemecahan Masalah (Troubleshooting)
- **Error: PostGIS function not found**:
  Jalankan `CREATE EXTENSION IF NOT EXISTS postgis;` di database `rekonsiliasi`.
- **Worker tidak memproses task**:
  Periksa koneksi RabbitMQ via management console di `http://localhost:15672` (guest/guest) dan pastikan service worker berstatus healthy.
- **Preview file lambat**:
  Pastikan upload dibatasi chunk reader (N baris pertama) tanpa membaca seluruh file ke memori.
