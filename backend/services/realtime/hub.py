from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, Optional, Set

from fastapi import WebSocket


class EncounterRealtimeHub:
    """In-memory WebSocket hub for encounter events.

    This is a local sandbox; we keep it simple:
    - each connection subscribes to exactly 1 encounter_id
    - broadcasts are best-effort
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._subs: Dict[str, Set[WebSocket]] = {}

    async def subscribe(self, encounter_id: str, ws: WebSocket) -> None:
        enc_id = str(encounter_id or "").strip()
        if not enc_id:
            return
        async with self._lock:
            self._subs.setdefault(enc_id, set()).add(ws)

    async def unsubscribe(self, encounter_id: str, ws: WebSocket) -> None:
        enc_id = str(encounter_id or "").strip()
        if not enc_id:
            return
        async with self._lock:
            subs = self._subs.get(enc_id)
            if not subs:
                return
            subs.discard(ws)
            if not subs:
                self._subs.pop(enc_id, None)

    async def broadcast(self, encounter_id: str, event: Dict[str, Any], msg_type: str = "message_added") -> None:
        enc_id = str(encounter_id or "").strip()
        if not enc_id:
            return
        async with self._lock:
            targets = list(self._subs.get(enc_id, set()))

        if not targets:
            return

        payload: Dict[str, Any] = {
            "type": msg_type,
            "encounter_id": enc_id,
            "ts": time.time(),
            "event": event,
        }

        serialized = json.dumps(payload, ensure_ascii=False)

        # Best-effort: slow/broken sockets should not kill the request.
        for ws in targets:
            try:
                await ws.send_text(serialized)
            except Exception:
                # The websocket endpoint will cleanup on disconnect; we keep this minimal.
                pass


realtime_hub: Optional[EncounterRealtimeHub] = None


def get_realtime_hub() -> EncounterRealtimeHub:
    global realtime_hub
    if realtime_hub is None:
        realtime_hub = EncounterRealtimeHub()
    return realtime_hub
