"""Entrypoint shared by Docker and local execution; configured through .env."""

import uvicorn

from backend.core.config import settings


def run():
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1,  # The realtime hub is process-local.
        log_level=settings.LOG_LEVEL,
        access_log=settings.ACCESS_LOG,
        proxy_headers=settings.PROXY_HEADERS,
        forwarded_allow_ips=settings.FORWARDED_ALLOW_IPS,
        timeout_graceful_shutdown=settings.GRACEFUL_TIMEOUT_SECONDS,
    )


if __name__ == "__main__":
    run()
