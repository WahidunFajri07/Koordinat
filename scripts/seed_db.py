"""Database seeding script for default system configs and initial administrative settings."""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.system_config import SystemConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INITIAL_CONFIGS = [
    {
        "key": "default_match_tolerance_meters",
        "value": "5.0",
        "description": "Toleransi jarak spasial default untuk pencocokan koordinat (meter)",
    },
    {
        "key": "idpel_length",
        "value": "12",
        "description": "Panjang standar karakter digit IDPEL",
    },
    {
        "key": "max_candidates_per_kosong",
        "value": "10",
        "description": "Maksimum kandidat yang disimpan per titik koordinat kosong",
    },
    {
        "key": "audit_log_retention_months",
        "value": "6",
        "description": "Masa retensi log audit (bulan)",
    },
]


async def seed_database() -> None:
    """Insert initial system configuration if not already present."""
    logger.info("Memulai seeding basis data...")
    async with async_session_factory() as session:
        for conf in INITIAL_CONFIGS:
            stmt = select(SystemConfig).where(SystemConfig.key == conf["key"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if not existing:
                item = SystemConfig(
                    key=conf["key"],
                    value=conf["value"],
                    description=conf["description"],
                )
                session.add(item)
                logger.info("Menambahkan config: %s = %s", conf["key"], conf["value"])
            else:
                logger.info("Config sudah ada: %s", conf["key"])
        await session.commit()
    logger.info("Seeding selesai dengan sukses.")


if __name__ == "__main__":
    asyncio.run(seed_database())
