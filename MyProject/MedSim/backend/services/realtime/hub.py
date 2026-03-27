import asyncio
import json
import time
from typing import Any, Dict, Optional, Set
from fastapi import WebSocket

class EncounterRealtimeHub:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._subs: Dict[str, Set[WebSocket]] = {}

    async def subscribe(self, encounter_id: str, ws: WebSocket) -> None:
        if not encounter_id: return
        async with self._lock:
            self._subs.setdefault(encounter_id, set()).add(ws)

    async def unsubscribe(self, encounter_id: str, ws: WebSocket) -> None:
        if not encounter_id: return
        async with self._lock:
            subs = self._subs.get(encounter_id)
            if subs:
                subs.discard(ws)
                if not subs:
                    self._subs.pop(encounter_id, None)

    async def broadcast(self, encounter_id: str, event: Dict[str, Any], msg_type: str = "message_added") -> None:
        if not encounter_id: return
        async with self._lock:
            targets = list(self._subs.get(encounter_id, set()))
        if not targets: return
        payload = {"type": msg_type, "encounter_id": encounter_id, "ts": time.time(), "event": event}
        serialized = json.dumps(payload, ensure_ascii=False)
        for ws in targets:
            try:
                await ws.send_text(serialized)
            except:
                pass

realtime_hub_instance = EncounterRealtimeHub()

def get_realtime_hub() -> EncounterRealtimeHub:
    return realtime_hub_instance
