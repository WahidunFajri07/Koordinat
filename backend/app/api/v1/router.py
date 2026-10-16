from fastapi import APIRouter

from app.api.v1.endpoints import audit, upload

api_router = APIRouter()

api_router.include_router(audit.router, prefix="/audit-log", tags=["audit-log"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])


# Endpoint routers will be registered here as they are implemented:
# from app.api.v1.endpoints import upload, candidates, process, history, audit, export, manual
# api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
# api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
# api_router.include_router(process.router, prefix="/process", tags=["process"])
# api_router.include_router(history.router, prefix="/history", tags=["history"])
# api_router.include_router(audit.router, prefix="/audit-log", tags=["audit"])
# api_router.include_router(export.router, prefix="/export", tags=["export"])
# api_router.include_router(manual.router, prefix="/manual-entry", tags=["manual"])
