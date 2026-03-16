from __future__ import annotations

import socket
from typing import Dict, List


def normalize_base_url(url: str) -> str:
    """Normaliza una URL eliminando la barra final y el sufijo /v1."""
    normalized = (url or "").strip().rstrip("/")
    if normalized.endswith("/v1"):
        normalized = normalized[: -len("/v1")]
    return normalized


def normalize_openai_base_url(url: str) -> str:
    """Asegura que la URL sea compatible con el root de OpenAI (con /v1)."""
    normalized = (url or "").strip().rstrip("/")
    if not normalized:
        return ""
    lower = normalized.lower()

    # Si ya contiene v1 o v1beta/openai, lo dejamos ahí
    for suffix in ["/v1beta/openai", "/v1"]:
        idx = lower.find(suffix)
        if idx != -1:
            return normalized[: idx + len(suffix)]

    return f"{normalized}/v1"


def get_suggested_llm_urls(current_base_url: str) -> List[Dict[str, str]]:
    """Genera una lista de URLs sugeridas usando lambdas y list comprehensions."""
    hostnames = ["host.docker.internal", "localhost", "127.0.0.1"]
    try:
        hostnames.append(socket.gethostname())
    except Exception:
        pass

    base_suggestions = [
        {"url": current_base_url, "label": "Actual (Configurado)"},
        {"url": "http://127.0.0.1:11434", "label": "Ollama (localhost)"},
        {"url": "https://generativelanguage.googleapis.com/v1beta/openai", "label": "Gemini (OpenAI-compatible)"},
    ]

    infra_suggestions = [
        {"url": f"http://{host}:{port}", "label": f"{service} ({host})"}
        for host in hostnames
        for port, service in [(11434, "Ollama"), (7000, "vLLM"), (8000, "OpenAI-compatible")]
    ]

    combined = base_suggestions + infra_suggestions
    
    # Filtrar duplicados manteniendo el orden
    seen = set()
    return [x for x in combined if not (x["url"] in seen or seen.add(x["url"]))]
