from enum import Enum


class AudioInputMode(str, Enum):
    DEFAULT = "default"
    UNREAL = "unreal"


from typing import Optional

def resolve_audio_input_mode(mode: Optional[str] = None) -> AudioInputMode:
    normalized = (mode or "").strip().lower()
    if normalized == AudioInputMode.UNREAL.value:
        return AudioInputMode.UNREAL
    return AudioInputMode.DEFAULT
