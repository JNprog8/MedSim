from fastapi import Request
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.api.auth import is_authenticated

# Rutas que nunca requieren autenticación
_PUBLIC_PREFIXES = (
    "/auth/",                   # login / logout / status
    "/login",                   # página de login en React
    "/frontend/login",          # compatibilidad histórica
    "/assets/",                 # bundles compilados de React (JS/CSS)
    "/IMG/",                    # imágenes estáticas (fondo MedSim, etc.)
    "/audio/",                  # audios estáticos (muestras de voz TTS)
    "/favicon",                 # favicons
    "/api/audio/audio_unreal",  # integración Unreal Engine (LAN interna)
    "/api/config_state",        # healthcheck de Docker
)


class SiteAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware de autenticación por cookie de sesión.
    Si SITE_PASSWORD está vacío, no hace nada (modo desarrollo).
    Redirige a /login conservando la URL de destino en ?next=.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Rutas públicas: pasan siempre
        if any(path.startswith(prefix) for prefix in _PUBLIC_PREFIXES):
            return await call_next(request)

        # WebSocket: no se puede redirigir, se cierra con 403
        if request.headers.get("upgrade", "").lower() == "websocket":
            if not is_authenticated(request):
                from starlette.responses import Response
                return Response(status_code=403, content="Forbidden")
            return await call_next(request)

        # Resto: requiere sesión válida
        if not is_authenticated(request):
            if path.startswith("/api/"):
                from starlette.responses import JSONResponse
                return JSONResponse(status_code=401, content={"detail": "No autenticado"})

            return RedirectResponse(url=f"/login?next={path}", status_code=303)

        return await call_next(request)
