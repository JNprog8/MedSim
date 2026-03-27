def normalize_openai_base_url(url: str) -> str:
    normalized = (url or "").strip().rstrip("/")
    if not normalized:
        return ""
    lower = normalized.lower()

    # If the user pasted an endpoint under /v1 (e.g. .../v1/tts or .../v1/audio/speech),
    # truncate to the base OpenAI-compatible root.
    idx = lower.find("/v1beta/openai")
    if idx != -1:
        return normalized[: idx + len("/v1beta/openai")]
    idx = lower.find("/v1")
    if idx != -1:
        return normalized[: idx + len("/v1")]

    return f"{normalized}/v1"
