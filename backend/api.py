import json
import time
from pathlib import Path
import mimetypes

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from backend.domain.models import PatientProfile
from backend.services import services

router = APIRouter()
SERVER_SCHEMA_VERSION = 3
_AUDIO_NAME_SAFE = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")

# API surface map
# - student-core: required by the current student chat/join/sessions flow
# - shared: used by both student-facing and evaluator-facing screens
# - evaluator/admin: not used by the current student flow


# shared: frontend reads current server-side config; settings come from backend .env only
@router.get("/api/config_state")
async def get_config_state():
    return {
        "server": {"schema_version": SERVER_SCHEMA_VERSION},
        "llm": {
            "base_url": services.llm_service.base_url,
            "uses_gemini": services.llm_service.is_gemini_backend(),
            "api_key_configured": bool((services.llm_service.api_key or "").strip()),
            "model": (services.llm_service.settings.patient_llm_model or "").strip(),
        },
        "audio": {
            "stt_api_url": getattr(services.stt_service, "api_url", ""),
            "stt_api_key_configured": bool((getattr(services.stt_service, "api_key", "") or "").strip()),
            "stt_model": services.stt_service.model,
            "stt_configured": services.stt_service.is_configured(),
            "tts_api_url": getattr(services.tts_service, "api_url", ""),
            "tts_api_key_configured": bool((getattr(services.tts_service, "api_key", "") or "").strip()),
            "tts_voice_id": services.tts_service.voice_id,
            "tts_model_id": services.tts_service.model_id,
            "tts_language": getattr(services.tts_service, "language", ""),
            "tts_speed": getattr(services.tts_service, "speed", None),
            "tts_temperature": getattr(services.tts_service, "temperature", None),
            "tts_configured": services.tts_service.is_configured(),
        },
    }


# shared: patient catalog powers student, evaluator, and admin screens
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


@router.delete("/api/patients/{patient_id}")
async def delete_patient(patient_id: str):
    try:
        deleted = services.patient_service.delete_patient(patient_id)
        return {"status": "deleted" if deleted else "not_found", "patient_id": patient_id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete patient: {exc}")


# shared: encounter lifecycle is the backbone for student and evaluator flows
@router.post("/api/encounters/start")
async def begin_encounter(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Expected JSON body")
    patient_id = (payload.get("patient_id") or "").strip()
    student_id = (payload.get("student_id") or "").strip() or None
    evaluator_name = (payload.get("evaluator_name") or "").strip() or None
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    try:
        encounter = services.encounter_service.start_encounter(
            patient_id, request, student_id=student_id, evaluator_name=evaluator_name
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "encounter_id": encounter["encounter_id"],
        "patient_id": encounter["patient_id"],
        "student_id": encounter.get("student_id"),
        "evaluator_name": encounter.get("evaluator_name"),
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
        "student_id": encounter.get("student_id"),
        "evaluator_name": encounter.get("evaluator_name"),
        "started_at": encounter.get("started_at"),
        "finished_at": encounter.get("finished_at"),
    }


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


@router.post("/api/encounters/{encounter_id}/reopen")
async def reopen_encounter(encounter_id: str, request: Request):
    """Re-open a finished encounter (clears finished_at) so the student can continue chatting."""
    try:
        return services.encounter_service.reopen_encounter(encounter_id, request)
    except KeyError as exc:
        detail = str(exc).strip("'")
        raise HTTPException(status_code=404, detail=detail)


@router.post("/api/encounters/{encounter_id}/link")
async def link_encounter(encounter_id: str, request: Request):
    """Adopt an existing encounter into the current session_id (best-effort).

    Used to open a conversation starting from an evaluation file (which has encounter_id but not session_id).
    """
    session_id = services.encounter_service.get_session_id(request)
    try:
        enc = services.encounter_service.adopt_encounter_to_session(encounter_id, session_id)
        return {
            "encounter_id": enc.get("encounter_id"),
            "patient_id": enc.get("patient_id"),
            "student_id": enc.get("student_id"),
            "evaluator_name": enc.get("evaluator_name"),
            "started_at": enc.get("started_at"),
            "finished_at": enc.get("finished_at"),
        }
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/models")
async def get_models():
    try:
        configured_model = (services.llm_service.settings.patient_llm_model or "").strip()
        if configured_model:
            return {"models": [configured_model]}
        return {"models": [await services.llm_service.get_first_available_model()]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# student-core: live conversation endpoints used by student chat/audio flows
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

@router.post("/api/tts_cache")
async def cache_tts(
    request: Request,
    encounter_id: str = Form(...),
    message_id: str = Form(...),
    role: str = Form(None),
    audio_base64: str = Form(...),
    content_type: str = Form(...),
):
    # `role` is kept for backwards compatibility with older frontends; it's not needed server-side.
    try:
        services.encounter_service.annotate_message_with_tts(
            encounter_id, message_id, {"audio_base64": audio_base64, "content_type": content_type}
        )
        return {"status": "success"}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


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


@router.get("/api/audio/{encounter_id}/{filename}")
async def get_audio_file(encounter_id: str, filename: str, request: Request):
    """Serve persisted audio for a message.

    Evaluator replays via URL so we don't push large base64 payloads over WS.
    """
    enc_id = (encounter_id or "").strip()
    if not enc_id:
        raise HTTPException(status_code=404, detail="Not found")
    name = (filename or "").strip()
    if not name or name != Path(name).name or any(ch not in _AUDIO_NAME_SAFE for ch in name):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Note: we intentionally do NOT validate session_id here.
    # Audio URLs may be embedded in older transcripts with a different session_id query param.
    if enc_id not in services.encounter_service.encounters:
        raise HTTPException(status_code=404, detail="Encounter not found")

    path = (services.settings.audio_dir / enc_id / name).resolve()
    base = services.settings.audio_dir.resolve()
    try:
        path.relative_to(base)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    media_type, _ = mimetypes.guess_type(str(path))
    if not media_type:
        # Common audio fallbacks.
        if path.suffix.lower() == ".mp3":
            media_type = "audio/mpeg"
        elif path.suffix.lower() == ".wav":
            media_type = "audio/wav"
        elif path.suffix.lower() == ".ogg":
            media_type = "audio/ogg"
        else:
            media_type = "application/octet-stream"

    return FileResponse(path, media_type=media_type, filename=path.name)


# shared: transcript/history and session discovery endpoints are used across student/evaluator views
@router.get("/api/encounters/{encounter_id}/history")
async def read_encounter_history(encounter_id: str, request: Request):
    encounter = services.encounter_service.get_encounter(encounter_id, request)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    history = services.encounter_service.chat_histories.get(encounter_id, [])
    visible = [m for m in history if m.get("role") != "system"]
    return {
        "encounter_id": encounter_id,
        "patient_id": encounter.get("patient_id"),
        "messages": history,
        "visible_messages": visible,
    }


@router.get("/api/encounters_saved")
async def list_saved_encounters(request: Request):
    """List encounters known to the server for the current session.

    Encounters are kept in memory and also persisted to disk (encounters_dir).
    The evaluator UI uses this to render a "conversaciones guardadas" list.
    """
    session_id = services.encounter_service.get_session_id(request)
    encounters = []
    for enc in services.encounter_service.encounters.values():
        if not isinstance(enc, dict):
            continue
        if enc.get("session_id") != session_id:
            continue

        enc_id = str(enc.get("encounter_id") or "").strip()
        evaluation = None
        if enc_id:
            evaluation = services.evaluation_service.get_by_encounter(enc_id)
        eval_completed = 0
        eval_total = 0
        eval_updated_at = None
        if evaluation:
            items = list(getattr(evaluation, "items", []) or [])
            eval_total = len(items)
            eval_completed = sum(1 for it in items if str(getattr(it, "value", "") or "").strip().lower() in ("yes", "no"))
            eval_updated_at = float(getattr(evaluation, "updated_at", 0.0) or 0.0) or None

        encounters.append(
            {
                "encounter_id": enc_id,
                "patient_id": enc.get("patient_id"),
                "student_id": enc.get("student_id"),
                "evaluator_name": enc.get("evaluator_name"),
                "started_at": enc.get("started_at"),
                "finished_at": enc.get("finished_at"),
                "has_evaluation": bool(evaluation),
                "evaluation_completed": eval_completed,
                "evaluation_total": eval_total,
                "evaluation_updated_at": eval_updated_at,
            }
        )
    encounters.sort(key=lambda e: float(e.get("started_at") or 0), reverse=True)
    return {"session_id": session_id, "encounters": encounters}


@router.get("/api/encounters_public")
async def list_public_encounters():
    """List encounters for the landing/join page (no session filter).

    This is intended for local/LAN demos where the evaluator shares the server and
    students join by selecting an encounter_id.
    """
    out = []
    for enc in services.encounter_service.encounters.values():
        if not isinstance(enc, dict):
            continue
        out.append(
            {
                "encounter_id": enc.get("encounter_id"),
                "patient_id": enc.get("patient_id"),
                "student_id": enc.get("student_id"),
                "evaluator_name": enc.get("evaluator_name"),
                "started_at": enc.get("started_at"),
                "finished_at": enc.get("finished_at"),
            }
        )
    out.sort(key=lambda e: float(e.get("started_at") or 0), reverse=True)
    return {"encounters": out}


# evaluator/admin: saved evaluation listing is not part of the student flow
@router.get("/api/evaluations_saved")
async def list_saved_evaluations():
    """List saved SEGUE evaluations from disk.

    Evaluations are stored as `evaluation_<encounter_id>.json`. The evaluator dashboard can use this list,
    and open the linked conversation via encounter_id.
    """
    base = services.settings.evaluations_dir
    base.mkdir(parents=True, exist_ok=True)
    out = []
    for path in sorted(base.glob("evaluation_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            raw = path.read_text(encoding="utf-8-sig")
            payload = json.loads(raw)
        except Exception:
            continue

        encounter_id = str(payload.get("encounter_id") or "").strip()
        if not encounter_id:
            continue

        # Best-effort: determine if we also have the conversation persisted for this encounter_id.
        has_conversation = False
        try:
            if encounter_id in services.encounter_service.encounters:
                has_conversation = True
            else:
                enc_path = services.settings.encounters_dir / f"{encounter_id}.json"
                has_conversation = enc_path.exists()
        except Exception:
            has_conversation = False

        items = payload.get("items") or []
        total = len(items) if isinstance(items, list) else 0
        completed = 0
        if isinstance(items, list):
            for it in items:
                if not isinstance(it, dict):
                    continue
                v = str(it.get("value") or "").strip().lower()
                if v in ("yes", "no"):
                    completed += 1

        out.append(
            {
                "encounter_id": encounter_id,
                "patient_id": payload.get("patient_id"),
                "student_id": payload.get("student_id"),
                "student_name": payload.get("student_name"),
                "student_identifier": payload.get("student_identifier"),
                "evaluator_name": payload.get("evaluator_name"),
                "created_at": payload.get("created_at"),
                "updated_at": payload.get("updated_at"),
                "items_completed": completed,
                "items_total": total,
                "has_conversation": has_conversation,
            }
        )
    return {"evaluations": out}


# shared: student directory is used by student session list and admin/evaluator tools
@router.get("/api/students")
async def list_students():
    students = services.student_service.load_students()
    out = []
    for s in students.values():
        out.append({"id": s.id, "name": s.name, "student_identifier": s.student_identifier})
    return {"students": out, "students_dir": str(services.settings.students_dir)}


@router.get("/api/students/{student_id}")
async def get_student_by_id(student_id: str):
    profile = services.student_service.get_student(student_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"student": profile.model_dump()}


@router.post("/api/students")
async def upsert_student(request: Request):
    from backend.domain.models import StudentProfile

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Expected JSON body")

    profile = StudentProfile.model_validate(payload)
    try:
        path = services.student_service.save_student(profile)
        return {"status": "success", "saved_as": str(path)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save student: {exc}")


@router.delete("/api/students/{student_id}")
async def delete_student(student_id: str):
    try:
        deleted = services.student_service.delete_student(student_id)
        return {"status": "deleted" if deleted else "not_found", "student_id": student_id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete student: {exc}")


# evaluator/admin: SEGUE evaluation CRUD is outside the student flow
@router.get("/api/evaluations")
async def get_evaluation(encounter_id: str, request: Request):
    encounter = services.encounter_service.get_encounter(encounter_id, request)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    evaluation = services.evaluation_service.get_by_encounter(encounter_id)
    return {"evaluation": None if evaluation is None else evaluation.model_dump()}


@router.post("/api/evaluations")
async def upsert_evaluation(request: Request):
    import uuid
    import time

    from backend.domain.models import SegueEvaluation

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Expected JSON body")

    encounter_id = str(payload.get("encounter_id") or "").strip()
    if not encounter_id:
        raise HTTPException(status_code=400, detail="encounter_id is required")

    encounter = services.encounter_service.get_encounter(encounter_id, request)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    if not str(payload.get("id") or "").strip():
        payload["id"] = uuid.uuid4().hex

    if not str(payload.get("patient_id") or "").strip():
        payload["patient_id"] = encounter.get("patient_id")

    now = time.time()
    payload.setdefault("created_at", now)
    payload["updated_at"] = now

    evaluation = SegueEvaluation.model_validate(payload)

    try:
        path = services.evaluation_service.upsert(evaluation)
        return {"status": "success", "saved_as": str(path), "evaluation": evaluation.model_dump()}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save evaluation: {exc}")


@router.delete("/api/evaluations/{encounter_id}")
async def delete_evaluation(encounter_id: str):
    """Delete a saved SEGUE evaluation + its linked conversation (encounter) + audios (best-effort)."""
    enc_id = str(encounter_id or "").strip()
    if not enc_id:
        raise HTTPException(status_code=400, detail="encounter_id is required")
    try:
        deleted = services.evaluation_service.delete_by_encounter(enc_id)
        purge = services.encounter_service.purge_encounter(enc_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete evaluation: {exc}")
    return {
        "status": "deleted" if deleted else "not_found",
        "encounter_id": enc_id,
        "encounter_deleted": bool(purge.get("encounter_deleted")),
        "audio_deleted": bool(purge.get("audio_deleted")),
    }
