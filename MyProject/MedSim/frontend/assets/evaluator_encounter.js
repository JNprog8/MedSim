(function () {
  const EvaluatorEncounterContract = window.MedSimEvaluatorEncounterContract;
  const EvaluatorEncounterTranscript = window.MedSimEvaluatorEncounterTranscript;
  const {
    buildEmptyEvaluation: buildInitialEvaluation,
    fetchSegueCatalog,
    getMessageAudioPayload,
  } = EvaluatorEncounterContract;
  const { createTranscriptController } = EvaluatorEncounterTranscript;
  let segueCriteria = [];

  const sessionIdKey = 'medsim_session_id';
  const sessionId = (() => {
    const existing = localStorage.getItem(sessionIdKey);
    if (existing) return existing;
    const created = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(sessionIdKey, created);
    return created;
  })();

  const btnBack = document.getElementById('btn-back');
  const btnOpenStudent = document.getElementById('btn-open-student');
  const btnFinish = document.getElementById('btn-finish');
  const btnActivate = document.getElementById('btn-activate');
  const btnDownloadPdf = document.getElementById('btn-download-pdf');
  const statusEl = document.getElementById('status');

  const transcriptEl = document.getElementById('transcript');
  const segueWrap = document.getElementById('segue-table-wrap');
  const hdrPatient = document.getElementById('hdr-patient');
  const hdrStudent = document.getElementById('hdr-student');
  const hdrStudentId = document.getElementById('hdr-student-id');
  const hdrEvaluator = document.getElementById('hdr-evaluator');
  const transcriptController = createTranscriptController({ transcriptEl });

  let encounterId = '';
  let encounterFinishedAt = null;
  let encounterMeta = null;
  let ws = null;
  let pingTimer = null;
  let evalSaveTimer = null;
  let currentEvaluation = null;
  let finishingOnExit = false;
  let allowExitWithoutPrompt = false;

  function headersJson() {
    return { 'Content-Type': 'application/json', 'X-Session-Id': sessionId };
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setEncounterFinished(finishedAt) {
    encounterFinishedAt = finishedAt || null;
    if (btnFinish) btnFinish.disabled = !encounterId || !!encounterFinishedAt;
    if (btnOpenStudent) btnOpenStudent.disabled = !encounterId;
    if (btnActivate) btnActivate.innerHTML = '<span class="material-symbols-outlined">play_circle</span><span>Activar conversacion</span>';
  }

  async function loadEncounterHistory() {
    if (!encounterId) return;
    try {
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/history/`, { headers: { 'X-Session-Id': sessionId } });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => ({}));
      const visible = Array.isArray(data.visible_messages) ? data.visible_messages : [];
      transcriptController.clearTranscript();
      for (const m of visible) {
        if (!m?.content) continue;
        transcriptController.addTranscript(m.role, m.content, getMessageAudioPayload(m), m.message_id || '');
      }
    } catch {}
  }

  function connectWs() {
    if (!encounterId) return;
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/encounters/${encodeURIComponent(encounterId)}?session_id=${encodeURIComponent(sessionId)}`);

    ws.onopen = () => {
      try { ws.send('hello'); } catch {}
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => { try { ws.send('ping'); } catch {} }, 20000);
    };
    ws.onclose = (ev) => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      if (ev && ev.code === 1008) {
        setStatus('No se pudo abrir la conversación (no está vinculada a esta sesión).');
      }
    };
    ws.onerror = () => {};
    ws.onmessage = (ev) => {
      let payload = null;
      try { payload = JSON.parse(String(ev.data || '{}')); } catch { return; }
      if (payload.type === 'snapshot') {
        setEncounterFinished(payload.finished_at);
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const existingIds = transcriptController.collectMessageIds();
        for (const m of messages) {
          if (!m?.content) continue;
          const mid = m.message_id || '';
          if (mid && existingIds.has(mid)) continue;
          transcriptController.addTranscript(m.role, m.content, getMessageAudioPayload(m), mid);
        }
        return;
      }
      if (payload?.role && payload?.content) {
        transcriptController.addTranscript(payload.role, payload.content, getMessageAudioPayload(payload), payload.message_id || '');
        return;
      }
      if (payload.type === 'message_added') {
        const e = payload.event || {};
        if (!e.content) return;
        transcriptController.addTranscript(e.role, e.content, getMessageAudioPayload(e), e.message_id || '');
        return;
      }
      if (payload.type === 'tts_update') {
        const e = payload.event || {};
        if (!e?.message_id || !e?.tts) return;
        transcriptController.updateTranscriptAudio(e.message_id, e.tts);
        return;
      }
      if (payload.type === 'encounter_finished') {
        setEncounterFinished(payload.event?.finished_at || Date.now() / 1000);
        setStatus('Conversación finalizada');
        return;
      }
      if (payload.type === 'encounter_reopened') {
        setEncounterFinished(null);
        setStatus('Conversación activada');
      }
    };
  }

  function buildEmptyEvaluation() {
    return buildInitialEvaluation({
      criteria: segueCriteria,
      encounterId,
      encounterMeta,
    });
  }

  function syncEvaluationMetadata() {
    if (!currentEvaluation) return;
    const studentMeta = encounterMeta?.student || {};
    currentEvaluation.encounter_id = encounterId;
    currentEvaluation.patient_id = currentEvaluation.patient_id || encounterMeta?.patient_id || '';
    currentEvaluation.student_id = currentEvaluation.student_id || encounterMeta?.student_id || '';
    currentEvaluation.student_name = currentEvaluation.student_name || studentMeta.name || '';
    currentEvaluation.student_identifier = currentEvaluation.student_identifier || studentMeta.student_identifier || '';
    currentEvaluation.evaluator_name = currentEvaluation.evaluator_name || encounterMeta?.evaluator_name || '';
  }

  function renderEvaluationHeader() {
    if (hdrPatient) hdrPatient.textContent = encounterMeta?.patient_name || encounterMeta?.patient_id || '-';
    if (hdrStudent) hdrStudent.textContent = currentEvaluation?.student_name || encounterMeta?.student?.name || '-';
    if (hdrStudentId) hdrStudentId.textContent = currentEvaluation?.student_identifier || encounterMeta?.student?.student_identifier || '-';
    if (hdrEvaluator) hdrEvaluator.textContent = currentEvaluation?.evaluator_name || encounterMeta?.evaluator_name || '-';
  }

  function scheduleSaveEvaluation() {
    if (evalSaveTimer) clearTimeout(evalSaveTimer);
    evalSaveTimer = setTimeout(() => {
      saveEvaluationNow().catch(() => setStatus('No se pudo guardar la evaluacion'));
    }, 450);
  }

  async function saveEvaluationNow() {
    if (!currentEvaluation) return;
    syncEvaluationMetadata();
    const resp = await fetch('/api/evaluations/', {
      method: 'POST',
      headers: headersJson(),
      body: JSON.stringify(currentEvaluation),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json().catch(() => ({}));
    if (data?.evaluation) currentEvaluation = data.evaluation;
    renderEvaluationHeader();
  }

  function renderSegueTable() {
    if (!segueWrap) return;
    if (!currentEvaluation) {
      segueWrap.textContent = 'No hay evaluación cargada.';
      return;
    }

    const valueById = new Map();
    const notesById = new Map();
    for (const it of (currentEvaluation.items || [])) {
      valueById.set(String(it.id), String(it.value || 'nc').toLowerCase());
      notesById.set(String(it.id), String(it.notes || ''));
    }

    const grouped = [];
    let currentArea = '';
    let areaIndex = 0;
    for (const c of segueCriteria) {
      if (c.area !== currentArea) {
        currentArea = c.area;
        areaIndex += 1;
        grouped.push({
          type: 'area',
          area: c.area,
          areaIndex,
        });
      }
      grouped.push({
        type: 'item',
        criterion: c,
      });
    }

    let itemIndex = 0;
    const rows = grouped.map((entry) => {
      if (entry.type === 'area') {
        return `
        <tr class="segue-area-row">
          <td colspan="4">
            <div class="segue-area-title">${escapeHtml(entry.area)}</div>
          </td>
        </tr>
      `;
      }

      const c = entry.criterion;
      itemIndex += 1;
      const val = valueById.get(c.id) || 'nc';
      const notes = notesById.get(c.id) || '';
      const yesId = `r_${c.id}_yes`;
      const noId = `r_${c.id}_no`;
      const ncId = `r_${c.id}_nc`;
      const obsId = `obs_${c.id}`;
      return `
        <tr data-crit="${escapeHtml(c.id)}">
          <td style="width:32px; text-align:center;">${itemIndex}</td>
          <td>${escapeHtml(c.label)}</td>
          <td style="width:150px;">
            <div class="radio-row">
              <label><input type="radio" name="crit_${escapeHtml(c.id)}" id="${yesId}" value="yes" ${val === 'yes' ? 'checked' : ''}/> Si</label>
              <label><input type="radio" name="crit_${escapeHtml(c.id)}" id="${noId}" value="no" ${val === 'no' ? 'checked' : ''}/> No</label>
              <label><input type="radio" name="crit_${escapeHtml(c.id)}" id="${ncId}" value="nc" ${val === 'nc' ? 'checked' : ''}/> NC</label>
            </div>
          </td>
          <td style="width:340px;">
            <textarea class="obs-textarea" id="${obsId}" placeholder="Observaciones">${escapeHtml(notes)}</textarea>
          </td>
        </tr>
      `;
    }).join('');

    segueWrap.innerHTML = `
      <table class="eval-table">
        <tbody>${rows}</tbody>
      </table>
    `;

    segueWrap.querySelectorAll('input[type="radio"]').forEach((r) => {
      r.addEventListener('change', () => {
        const tr = r.closest('tr');
        const critId = tr?.getAttribute('data-crit') || '';
        if (!critId) return;
        const items = Array.isArray(currentEvaluation.items) ? currentEvaluation.items : [];
        const it = items.find((x) => String(x.id) === String(critId));
        if (it) it.value = String(r.value || 'nc');
        scheduleSaveEvaluation();
      });
    });
    segueWrap.querySelectorAll('textarea').forEach((t) => {
      t.addEventListener('input', () => {
        const tr = t.closest('tr');
        const critId = tr?.getAttribute('data-crit') || '';
        if (!critId) return;
        const items = Array.isArray(currentEvaluation.items) ? currentEvaluation.items : [];
        const it = items.find((x) => String(x.id) === String(critId));
        if (it) it.notes = String(t.value || '');
        scheduleSaveEvaluation();
      });
    });
  }

  async function loadEvaluation() {
    const resp = await fetch(`/api/evaluations/${encodeURIComponent(encounterId)}/view_model`, { headers: { 'X-Session-Id': sessionId } });
    if (!resp.ok) return;
    const data = await resp.json().catch(() => ({}));
    segueCriteria = Array.isArray(data?.criteria) ? data.criteria : segueCriteria;
    currentEvaluation = data?.evaluation || buildEmptyEvaluation();
    encounterMeta = {
      ...(encounterMeta || {}),
      patient_id: data?.patient_id || encounterMeta?.patient_id || '',
      patient_name: data?.patient_name || encounterMeta?.patient_name || '',
      student_id: data?.student_id || encounterMeta?.student_id || '',
      student: {
        ...(encounterMeta?.student || {}),
        name: data?.student_name || encounterMeta?.student?.name || '',
        student_identifier: data?.student_identifier || encounterMeta?.student?.student_identifier || '',
      },
      evaluator_name: data?.evaluator_name || encounterMeta?.evaluator_name || '',
    };
    renderEvaluationHeader();
    renderSegueTable();
  }

  async function joinEncounter(id) {
    encounterId = String(id || '').trim();
    if (!encounterId) return;
    // Try to adopt/link first (helps if opened directly by URL).
    await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/link/`, { method: 'POST', headers: headersJson(), body: '{}' }).catch(() => {});

    const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/`, { headers: { 'X-Session-Id': sessionId } });
    if (!resp.ok) throw new Error(await resp.text());
    const meta = await resp.json().catch(() => ({}));
    let studentMeta = null;
    if (meta.student_id) {
      try {
        const studentResp = await fetch(`/api/students/${encodeURIComponent(meta.student_id)}/`, { headers: { 'X-Session-Id': sessionId } });
        if (studentResp.ok) studentMeta = await studentResp.json().catch(() => null);
      } catch {}
    }
    let patientMeta = null;
    if (meta.patient_id) {
      try {
        const patientResp = await fetch(`/api/patients/${encodeURIComponent(meta.patient_id)}/`, { headers: { 'X-Session-Id': sessionId } });
        if (patientResp.ok) patientMeta = await patientResp.json().catch(() => null);
      } catch {}
    }
    encounterMeta = {
      patient_id: meta.patient_id || '',
      patient_name: patientMeta?.name || '',
      student_id: meta.student_id || '',
      student: studentMeta,
      evaluator_name: meta.evaluator_name || '',
    };
    setEncounterFinished(meta.finished_at);
    if (btnFinish) btnFinish.disabled = !!meta.finished_at;

    await loadEncounterHistory();
    connectWs();
    await loadEvaluation().catch(() => {});
    setStatus(meta.finished_at ? 'Conversación finalizada (solo lectura)' : 'Conversación activa');
  }

  async function finalizeEncounterOnExit() {
    if (!encounterId || encounterFinishedAt || finishingOnExit) return;
    finishingOnExit = true;
    const body = JSON.stringify({
      closed_by: 'evaluator_exit',
      evaluation: currentEvaluation || null,
      finished_at_client: Date.now(),
    });
    try {
      await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/finish/`, {
        method: 'POST',
        headers: headersJson(),
        body,
        keepalive: true,
      });
    } catch {}
  }

  btnBack?.addEventListener('click', () => {
    const shouldExit = window.confirm('Si sales de esta pantalla, la conversacion se finalizara automaticamente. Quieres continuar?');
    if (!shouldExit) return;
    allowExitWithoutPrompt = true;
    finalizeEncounterOnExit().finally(() => {
      window.location.href = '/frontend/evaluator';
    });
  });

  btnOpenStudent?.addEventListener('click', () => {
    if (!encounterId) return;
    const url = `/frontend/student?session_id=${encodeURIComponent(sessionId)}&encounter_id=${encodeURIComponent(encounterId)}`;
    window.open(url, '_blank');
  });

  btnDownloadPdf?.addEventListener('click', async () => {
    if (!encounterId) return;
    try {
      setStatus('Preparando PDF...');
      await saveEvaluationNow();
      const link = document.createElement('a');
      link.href = `/api/evaluations/${encodeURIComponent(encounterId)}/pdf?ts=${Date.now()}`;
      link.download = `evaluacion-segue-${encounterId}.pdf`;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus('PDF descargado');
    } catch (e) {
      setStatus(`No se pudo descargar el PDF: ${String(e?.message || e)}`);
    }
  });

  btnActivate?.addEventListener('click', async () => {
    if (!encounterId) return;
    if (encounterFinishedAt) {
      const ok = window.confirm('Activar conversación? El estudiante podrá volver a enviar mensajes.');
      if (!ok) return;
      setStatus('Reabriendo...');
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/reopen/`, { method: 'POST', headers: headersJson() });
      if (!resp.ok) return setStatus(await resp.text());
      setEncounterFinished(null);
      connectWs();
      setStatus('Conversación activada');
      return;
    }
    connectWs();
    setStatus('Conversación activa');
  });

  btnFinish?.addEventListener('click', async () => {
    if (!encounterId) return;
    if (encounterFinishedAt) return setStatus('La conversación ya está finalizada');
    const ok = window.confirm('Finalizar conversación? Esto bloqueará el chat del estudiante para este encounter.');
    if (!ok) return;
    try {
      setStatus('Finalizando...');
      const body = { closed_by: 'evaluator', evaluation: currentEvaluation || null, finished_at_client: Date.now() };
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/finish/`, {
        method: 'POST',
        headers: headersJson(),
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json().catch(() => ({}));
      setEncounterFinished(data?.finished_at || Date.now() / 1000);
      setStatus('Conversación finalizada');
    } catch (e) {
      setStatus(String(e?.message || e));
    }
  });

  // Boot
  const urlParams = new URLSearchParams(window.location.search);
  const enc = (urlParams.get('encounter_id') || '').trim();
  if (!enc) {
    window.location.href = '/frontend/evaluator';
  } else {
    fetchSegueCatalog(sessionId)
      .then((criteria) => {
        segueCriteria = criteria;
        return joinEncounter(enc);
      })
      .catch((e) => {
        setStatus(String(e?.message || e));
      });
  }

  window.addEventListener('pagehide', () => {
    finalizeEncounterOnExit();
  });

  window.addEventListener('beforeunload', (event) => {
    if (!allowExitWithoutPrompt && encounterId && !encounterFinishedAt) {
      event.preventDefault();
      event.returnValue = 'Si sales de esta pantalla, la conversacion se finalizara automaticamente.';
    }
    finalizeEncounterOnExit();
  });
})();
