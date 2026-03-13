import time

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from domain.models import PatientProfile
from services import services

router = APIRouter()
SERVER_SCHEMA_VERSION = 3


@router.get("/api/config_state")
async def get_config_state():
    llm_urls = services.llm_service.suggested_urls()
    return {
        "server": {"schema_version": SERVER_SCHEMA_VERSION},
        "llm": {
            "base_url": services.llm_service.base_url,
            "uses_gemini": services.llm_service.is_gemini_backend(),
            "api_key_configured": bool((services.llm_service.api_key or "").strip()),
            "saved_urls": llm_urls,
        },
        "audio": {
            "stt_api_url": getattr(services.stt_service, "api_url", ""),
            "stt_api_key_configured": bool((getattr(services.stt_service, "api_key", "") or "").strip()),
            "stt_model": services.stt_service.model,
            "stt_configured": bool(getattr(services.stt_service, "model", "").strip()),
            "tts_api_url": getattr(services.tts_service, "api_url", ""),
            "tts_api_key_configured": bool((getattr(services.tts_service, "api_key", "") or "").strip()),
            "tts_voice_id": services.tts_service.voice_id,
            "tts_model_id": services.tts_service.model_id,
            "tts_language": getattr(services.tts_service, "language", ""),
            "tts_speed": getattr(services.tts_service, "speed", None),
            "tts_temperature": getattr(services.tts_service, "temperature", None),
            "tts_configured": bool(
                services.tts_service.api_key and services.tts_service.voice_id and services.tts_service.model_id
            ),
        },
    }


@router.post("/api/config")
async def update_config(api_url: str = Form(...), api_key: str = Form(None)):
    try:
        return await services.llm_service.update_config(api_url, api_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/llm_health")
async def llm_health_check():
    return await services.llm_service.health()


@router.post("/api/stt_config")
async def save_stt_config(
    stt_api_url: str = Form(""),
    stt_api_key: str = Form(""),
    stt_model: str = Form(""),
):
    try:
        stt_result = services.stt_service.update_config(
            api_url=stt_api_url or None,
            api_key=stt_api_key or None,
            model=stt_model or None,
        )
        return {"status": "success", "stt": stt_result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/api/tts_config")
async def save_tts_config(
    tts_api_url: str = Form(""),
    tts_api_key: str = Form(""),
    tts_voice_id: str = Form(""),
    tts_model_id: str = Form(""),
    tts_language: str = Form(""),
    tts_speed: str = Form(""),
    tts_temperature: str = Form(""),
):
    try:
        speed = None
        temp = None
        if str(tts_speed or "").strip():
            speed = float(str(tts_speed).strip())
        if str(tts_temperature or "").strip():
            temp = float(str(tts_temperature).strip())
        tts_result = services.tts_service.update_config(
            api_url=tts_api_url or None,
            api_key=tts_api_key or None,
            voice_id=tts_voice_id or None,
            model_id=tts_model_id or None,
            language=tts_language or None,
            speed=speed,
            temperature=temp,
        )
        return {"status": "success", "tts": tts_result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/api/audio_reset")
async def reset_audio_config():
    services.stt_service.update_config(api_url="", api_key="", model="")
    services.tts_service.update_config(api_url="", api_key="", voice_id="", model_id="", language="es", speed=None, temperature=None)
    return {"status": "success"}


@router.get("/api/suggested_urls")
async def get_suggested_urls():
    return {
        "llm_base_urls": services.llm_service.suggested_urls(),
        "audio_defaults": {
            "stt_model": services.stt_service.model or "whisper-1",
            "tts_model_id": services.tts_service.model_id or "gpt-4o-mini-tts",
        },
    }


@router.post("/api/auto_config")
async def run_auto_config(target: str = Form(...), api_key: str = Form(None)):
    try:
        normalized_target = (target or "").strip().lower()
        if normalized_target != "llm":
            raise ValueError("target must be: llm")

        result = {"status": "success", "target": normalized_target}
        chosen_url = None
        for item in services.llm_service.suggested_urls():
            candidate = item.get("url", "")
            if await services.llm_service.probe_base_url(candidate):
                chosen_url = candidate
                break
        if chosen_url:
            await services.llm_service.update_config(chosen_url, api_key)
            result["llm"] = {"status": "healthy", "chosen_url": chosen_url}
        else:
            result["llm"] = {"status": "unhealthy", "chosen_url": None}
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/patients")
async def list_patients():
    patients = services.patient_service.load_patients()
    out = []
    for patient in patients.values():
        triage_short = (patient.triage.reference_short or "").strip() if patient.triage else ""
        out.append(
            {
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "region": patient.region,
                "triage_reference": triage_short,
                "chief_complaint": patient.chief_complaint,
            }
        )
    return {"patients": out, "patients_dir": str(services.settings.patients_dir)}


@router.get("/api/patients/{patient_id}")
async def get_patient_by_id(patient_id: str):
    profile = services.patient_service.get_patient(patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"patient": profile.model_dump()}


@router.post("/api/patients")
async def upsert_patient(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Expected JSON body")
    profile = PatientProfile.model_validate(payload)
    try:
        path = services.patient_service.save_patient(profile)
        return {"status": "success", "saved_as": str(path)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save patient: {exc}")


@router.get("/api/interview_modes")
async def get_interview_modes():
    return {
        "modes": [
            {"id": "free", "label": "Libre", "description": "Consulta normal, sin checklist SEGUE."},
            {"id": "segue", "label": "SEGUE", "description": "Usa el panel manual de checklist SEGUE."},
        ],
        "default_mode": "free",
    }


@router.post("/api/encounters/start")
async def begin_encounter(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Expected JSON body")
    patient_id = (payload.get("patient_id") or "").strip()
    mode = services.encounter_service.normalize_mode(payload.get("mode"))
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    try:
        encounter = services.encounter_service.start_encounter(patient_id, mode, request)
    except KeyError:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "encounter_id": encounter["encounter_id"],
        "patient_id": encounter["patient_id"],
        "mode": encounter["mode"],
        "started_at": encounter["started_at"],
    }


@router.get("/api/encounters/active")
async def get_active_encounter(request: Request):
    encounter = services.encounter_service.get_active_encounter(request)
    if not encounter:
        return {"active": False}
    return {
        "active": True,
        "encounter_id": encounter["id"],
        "patient_id": encounter["patient_id"],
        "mode": encounter["mode"],
        "started_at": encounter["started_at"],
    }


@router.get("/api/encounters/{encounter_id}")
async def read_encounter(encounter_id: str, request: Request):
    encounter = services.encounter_service.get_encounter(encounter_id, request)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return {
        "encounter_id": encounter_id,
        "patient_id": encounter["patient_id"],
        "mode": encounter.get("mode", "free"),
        "started_at": encounter.get("started_at"),
        "finished_at": encounter.get("finished_at"),
    }


@router.get("/api/encounters/{encounter_id}/history")
async def get_encounter_history(encounter_id: str, request: Request):
    encounter = services.encounter_service.get_encounter(encounter_id, request)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    history = services.encounter_service.get_history(encounter_id)
    # We filter out system messages from the history sent to the UI if desired,
    # or just send everything and let the UI handle it.
    return {"history": [msg for msg in history if msg["role"] != "system"]}


@router.post("/api/encounters/{encounter_id}/finish")
async def close_encounter(encounter_id: str, request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Expected JSON body")
    try:
        return services.encounter_service.finish_encounter(encounter_id, payload, request)
    except KeyError as exc:
        detail = str(exc).strip("'")
        raise HTTPException(status_code=404, detail=detail)


@router.get("/api/models")
async def get_models():
    try:
        configured_model = (services.llm_service.settings.patient_llm_model or "").strip()
        if configured_model:
            return {"models": [configured_model]}
        return {"models": [await services.llm_service.get_first_available_model()]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/chat")
async def chat_completion(
    request: Request,
    message: str = Form(...),
    model: str = Form(None),
    patient_id: str = Form(None),
    encounter_id: str = Form(None),
    include_tts: bool = Form(False),
):
    start_time = time.time()
    try:
        payload = await services.audio_turn_service.complete_turn(
            message,
            model,
            patient_id,
            encounter_id,
            request,
            include_tts=include_tts,
        )
        payload["elapsed_time"] = time.time() - start_time
        payload["chat"]["elapsed_time"] = payload["elapsed_time"]
        return JSONResponse(content=payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    return await services.stt_service.transcribe_audio(file)


@router.post("/api/tts")
async def tts(text: str = Form(...), patient_id: str = Form(None), speaker_wav: UploadFile = File(None)):
    return await services.tts_service.text_to_speech(text, speaker_wav, patient_id=patient_id)


@router.post("/api/audio_turn")
async def audio_roundtrip(
    request: Request,
    file: UploadFile = File(...),
    model: str = Form(None),
    patient_id: str = Form(None),
    encounter_id: str = Form(None),
    speaker_wav: UploadFile = File(None),
):
    return await services.audio_turn_service.transcribe_then_reply(
        file,
        model=model,
        patient_id=patient_id,
        encounter_id=encounter_id,
        request=request,
        speaker_wav=speaker_wav,
    )
