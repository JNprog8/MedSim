import hashlib
import hmac
import time
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response

from backend.core.config import settings

router = APIRouter()


def _make_token(password: str) -> str:
    """Genera un token HMAC firmado con timestamp para la cookie de sesión."""
    ts = str(int(time.time()))
    h = hmac.new(settings.SECRET_KEY.encode(), f"{password}:{ts}".encode(), hashlib.sha256).hexdigest()
    return f"{ts}:{h}"


def _verify_token(token: str, max_age_seconds: int = 86400 * 30) -> bool:
    """Valida el token de sesión. Caduca a los 30 días por defecto."""
    if not settings.SITE_PASSWORD:
        return True
    try:
        ts_str, h = token.split(":", 1)
        ts = int(ts_str)
    except (ValueError, AttributeError):
        return False
    if time.time() - ts > max_age_seconds:
        return False
    expected = hmac.new(
        settings.SECRET_KEY.encode(),
        f"{settings.SITE_PASSWORD}:{ts_str}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(h, expected)


def is_authenticated(request: Request) -> bool:
    """Comprueba si la request tiene sesión válida."""
    if not settings.SITE_PASSWORD:
        return True
    token = request.cookies.get("medsim_session")
    return bool(token and _verify_token(token))


@router.get("/status")
async def auth_status(request: Request):
    """Devuelve el estado de autenticación y si el sitio requiere contraseña."""
    return {
        "required": bool(settings.SITE_PASSWORD),
        "authenticated": is_authenticated(request),
    }


@router.get("/login")
async def login_page(request: Request, next: str = "/", error: str = ""):
    """Redirige al login de React en /login."""
    err_param = "&error=1" if error else ""
    return RedirectResponse(url=f"/login?next={next}{err_param}", status_code=303)


@router.post("/login")
async def login_submit(request: Request):
    """Procesa el inicio de sesión vía JSON o Form Data."""
    is_json = request.headers.get("content-type", "").startswith("application/json")
    password = ""
    next_path = "/"

    if is_json:
        try:
            body = await request.json()
            password = body.get("password", "")
            next_path = body.get("next", "/")
        except Exception:
            return JSONResponse(status_code=400, content={"detail": "Payload inválido"})
    else:
        form = await request.form()
        password = str(form.get("password", ""))
        next_path = str(form.get("next", "/"))

    if settings.SITE_PASSWORD and password != settings.SITE_PASSWORD:
        if is_json:
            return JSONResponse(status_code=401, content={"detail": "Contraseña incorrecta."})
        return RedirectResponse(url=f"/login?next={next_path}&error=1", status_code=303)

    token = _make_token(password if settings.SITE_PASSWORD else "open")

    if is_json:
        response = JSONResponse(content={"success": True, "redirect": next_path})
    else:
        response = RedirectResponse(url=next_path, status_code=303)

    is_secure = settings.SECURE_COOKIES if settings.SECURE_COOKIES is not None else False

    response.set_cookie(
        key="medsim_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=86400 * 30,
    )
    return response


@router.get("/logout")
async def logout():
    response = RedirectResponse(url="/login", status_code=303)
    response.delete_cookie("medsim_session")
    return response
