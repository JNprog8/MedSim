from enum import Enum


class AudioInputMode(str, Enum):
    DEFAULT = "default"
    UNREAL = "unreal"


def resolve_audio_input_mode(mode: str | None = None) -> AudioInputMode:
    normalized = (mode or "").strip().lower()
    if normalized == AudioInputMode.UNREAL.value:
        return AudioInputMode.UNREAL
    return AudioInputMode.DEFAULT
