# ARCHITECTURE.md — Rekonsiliasi Data Pelanggan & Spasial

## 1. Ikhtisar Sistem
Aplikasi **Rekonsiliasi Data Pelanggan & Spasial** dirancang untuk memproses, membersihkan, dan mencocokkan data pelanggan listrik (Master, PDPJ, Koordinat Kosong) secara spasial menggunakan PostGIS geography dan alur rekonsiliasi anti-join.

## 2. Arsitektur Komponen

```mermaid
graph TD
    Client[Browser / Analis] -->|HTTPS| Proxy[Nginx Reverse Proxy]
    Proxy -->|Static / HMR| Frontend[React 18 + Vite + Tailwind]
    Proxy -->|/api/v1| Backend[FastAPI Async Server]
    
    Backend -->|JWT Validation| Keycloak[Keycloak OIDC]
    Backend -->|Enqueue Batch| RabbitMQ[RabbitMQ Broker]
    Backend -->|Cache / Session| Redis[Redis]
    Backend -->|Data Store| Postgres[(PostgreSQL 16 + PostGIS)]
    
    RabbitMQ --> CeleryWorker[Celery Workers]
    CeleryWorker --> Postgres
    CeleryWorker --> Redis
```

## 3. Komponen Utama
- **Frontend SPA**: React 18 + TS + Vite, TanStack Query/Table, MapProvider (Mapbox/Google).
  - Mendukung **Web Filter Kolom Otomatis** dinamis berdasarkan tipe upload.
- **Backend API**: FastAPI, SQLAlchemy, Pydantic, Alembic.
- **Geospasial**: PostgreSQL 16 + PostGIS (`geography(Point, 4326)`, GiST index).

## 4. Keamanan & Proteksi IDPEL
- **At-rest Encryption**: AES-256-GCM (`idpel_encrypted`).
- **Blind Index**: HMAC-SHA256 (`idpel_blind_index`) untuk dedup/anti-join.
- **Log Masking**: IDPEL tidak pernah dicatat plaintext di Audit Log.
