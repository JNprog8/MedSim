(function () {
  const segueCriteria = [
    { id: '1', area: 'Conectar con paciente', label: 'Saluda adecuadamente al paciente' },
    { id: '2', area: 'Conectar con paciente', label: 'Establece el motivo de consulta' },
    { id: '3', area: 'Conectar con paciente', label: 'Establece agenda y secuencia de problemas' },
    { id: '4', area: 'Conectar con paciente', label: 'Establece conexion personal con el paciente mas alla de los problemas medicos' },
    { id: '5', area: 'Conectar con paciente', label: 'Genera privacidad. Si va a haber interrupcion, lo anticipa' },
    { id: '6', area: 'Obtener informacion', label: 'Recoge la perspectiva del paciente respecto a su problema de salud, sus ideas y dudas' },
    { id: '7', area: 'Obtener informacion', label: 'Explora signos y sintomas, factores fisicos y fisiologicos' },
    { id: '8', area: 'Obtener informacion', label: 'Explora factores psicosociales, situacion familiar, relaciones y estres' },
    { id: '9', area: 'Obtener informacion', label: 'Indaga sobre tratamientos previos o historia del padecimiento' },
    { id: '10', area: 'Obtener informacion', label: 'Indaga como los problemas de salud afectan la vida del paciente' },
    { id: '11', area: 'Obtener informacion', label: 'Indaga estrategias de prevencion y problemas del estilo de vida' },
    { id: '12', area: 'Obtener informacion', label: 'Hace preguntas directas. Evita preguntas directivas o capciosas' },
    { id: '13', area: 'Obtener informacion', label: 'Da tiempo para que el paciente hable, no interrumpe' },
    { id: '14', area: 'Obtener informacion', label: 'Escucha. Presta toda la atencion al paciente. Parafrasea y/o repregunta' },
    { id: '15', area: 'Obtener informacion', label: 'Chequea y/o clarifica informacion' },
    { id: '16', area: 'Dar informacion', label: 'Explica la justificacion del uso de examenes complementarios o procedimientos' },
    { id: '17', area: 'Dar informacion', label: 'Ensenia al paciente sobre su propio cuerpo y situacion' },
    { id: '18', area: 'Dar informacion', label: 'Alienta al paciente para que realice preguntas' },
    { id: '19', area: 'Dar informacion', label: 'Se adapta al nivel de comprension del paciente' },
    { id: '20', area: 'Comprension de la perspectiva del paciente', label: 'Reconoce los logros, el progreso y los desafios del paciente' },
    { id: '21', area: 'Comprension de la perspectiva del paciente', label: 'Reconoce el tiempo de espera' },
    { id: '22', area: 'Comprension de la perspectiva del paciente', label: 'Expresa cuidado, preocupacion y empatia' },
    { id: '23', area: 'Comprension de la perspectiva del paciente', label: 'Mantiene un tono respetuoso' },
    { id: '24', area: 'Cierre', label: 'Pregunta si hay algo mas que quiera discutir o preguntar' },
    { id: '25', area: 'Cierre', label: 'Revisa nuevos pasos a seguir' },
  ];

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
  const statusEl = document.getElementById('status');

  const transcriptEl = document.getElementById('transcript');
  const segueWrap = document.getElementById('segue-table-wrap');
  const hdrStudent = document.getElementById('hdr-student');
  const hdrStudentId = document.getElementById('hdr-student-id');
  const hdrEvaluator = document.getElementById('hdr-evaluator');

  let encounterId = '';
  let encounterFinishedAt = null;
  let ws = null;
  let pingTimer = null;
  let evalSaveTimer = null;
  let currentEvaluation = null;
  let currentTtsAudio = null;
  let currentTtsMessageElement = null;
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

  function stopCurrentAudioPlayback() {
    if (!currentTtsAudio) return;
    try { currentTtsAudio.pause(); } catch {}
    const objectUrl = currentTtsAudio.dataset?.objectUrl;
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
    }
    if (currentTtsMessageElement) {
      currentTtsMessageElement.classList.remove('playing');
      currentTtsMessageElement = null;
    }
    currentTtsAudio = null;
  }

  function playAudioFromUrl(url, messageElement = null, revokeOnStop = false) {
    const u = String(url || '').trim();
    if (!u) return null;
    stopCurrentAudioPlayback();
    const audio = new Audio(u);
    if (revokeOnStop) audio.dataset.objectUrl = u;
    audio.onplay = () => {
      if (messageElement) {
        messageElement.classList.add('playing');
        currentTtsMessageElement = messageElement;
      }
    };
    audio.onended = () => {
      if (messageElement) messageElement.classList.remove('playing');
      if (revokeOnStop) {
        try { URL.revokeObjectURL(u); } catch {}
      }
      currentTtsAudio = null;
      currentTtsMessageElement = null;
    };
    audio.play().catch(() => {});
    currentTtsAudio = audio;
    return audio;
  }

  function playAudioFromBase64(audioBase64, contentType = 'audio/mpeg', messageElement = null) {
    if (!audioBase64) return null;
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: contentType });
    const objectUrl = URL.createObjectURL(blob);
    return playAudioFromUrl(objectUrl, messageElement, true);
  }

  function attachAudioControls(messageElement, text, ttsPayload = null) {
    if (!messageElement) return;
    const existing = messageElement.querySelector('.message-audio-meta');
    if (existing) existing.remove();
    const meta = document.createElement('div');
    meta.className = 'message-audio-meta';

    const status = document.createElement('span');
    status.className = 'message-audio-status';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'message-audio-replay';

    const payload = ttsPayload || {};
    if (payload.audio_url) {
      status.textContent = 'Audio listo';
      button.textContent = 'Reproducir';
      button.addEventListener('click', () => playAudioFromUrl(payload.audio_url, messageElement, false));
    } else if (payload.audio_base64) {
      status.textContent = 'Audio listo';
      button.textContent = 'Reproducir';
      button.addEventListener('click', () => playAudioFromBase64(payload.audio_base64, payload.content_type, messageElement));
    } else {
      status.textContent = 'Sin audio';
      button.textContent = 'Sin audio';
      button.disabled = true;
    }

    meta.append(status, button);
    messageElement.appendChild(meta);
  }

  function addTranscript(role, content, ttsPayload = null, messageId = '') {
    const plainContent = content || '';
    const div = document.createElement('div');
    div.className = `tmsg ${role === 'user' ? 'user' : 'assistant'}`;
    if (messageId) div.dataset.messageId = messageId;
    div.dataset.role = role === 'user' ? 'user' : 'assistant';
    div.dataset.messageText = plainContent;
    div.innerHTML = `<div class="tmeta">${role === 'user' ? 'Estudiante' : 'Paciente'}</div><div>${escapeHtml(plainContent)}</div>`;
    attachAudioControls(div, plainContent, ttsPayload);
    transcriptEl.appendChild(div);
  }

  function updateTranscriptAudio(messageId, ttsPayload) {
    if (!messageId) return;
    const selector = `[data-message-id="${messageId}"]`;
    const messageEl = transcriptEl.querySelector(selector);
    if (!messageEl) return;
    const text = messageEl.dataset.messageText || '';
    attachAudioControls(messageEl, text, ttsPayload);
  }

  async function loadEncounterHistory() {
    if (!encounterId) return;
    try {
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/history`, { headers: { 'X-Session-Id': sessionId } });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => ({}));
      const visible = Array.isArray(data.visible_messages) ? data.visible_messages : [];
      transcriptEl.innerHTML = '';
      for (const m of visible) {
        if (!m?.content) continue;
        addTranscript(m.role, m.content, m.tts, m.message_id || '');
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
        const existingIds = new Set(
          Array.from(transcriptEl.querySelectorAll('[data-message-id]'))
            .map((el) => el?.dataset?.messageId || '')
            .filter(Boolean),
        );
        for (const m of messages) {
          if (!m?.content) continue;
          const mid = m.message_id || '';
          if (mid && existingIds.has(mid)) continue;
          addTranscript(m.role, m.content, m.tts, mid);
        }
        return;
      }
      if (payload.type === 'message_added') {
        const e = payload.event || {};
        if (!e.content) return;
        addTranscript(e.role, e.content, e.tts, e.message_id || '');
        return;
      }
      if (payload.type === 'tts_update') {
        const e = payload.event || {};
        if (!e?.message_id || !e?.tts) return;
        updateTranscriptAudio(e.message_id, e.tts);
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
    const items = [];
    for (const c of segueCriteria) items.push({ id: c.id, value: 'nc', notes: '' });
    return {
      id: '',
      encounter_id: encounterId,
      patient_id: '',
      student_id: '',
      student_name: '',
      student_identifier: '',
      evaluator_name: '',
      items,
    };
  }

  function scheduleSaveEvaluation() {
    if (evalSaveTimer) clearTimeout(evalSaveTimer);
    evalSaveTimer = setTimeout(() => {
      saveEvaluationNow().catch(() => setStatus('No se pudo guardar la evaluacion'));
    }, 450);
  }

  async function saveEvaluationNow() {
    if (!currentEvaluation) return;
    currentEvaluation.encounter_id = encounterId;
    const resp = await fetch('/api/evaluations', {
      method: 'POST',
      headers: headersJson(),
      body: JSON.stringify(currentEvaluation),
    });
    const data = await resp.json().catch(() => ({}));
    if (data?.evaluation) currentEvaluation = data.evaluation;
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
    const resp = await fetch(`/api/evaluations?encounter_id=${encodeURIComponent(encounterId)}`, { headers: { 'X-Session-Id': sessionId } });
    if (!resp.ok) return;
    const data = await resp.json().catch(() => ({}));
    currentEvaluation = data?.evaluation || buildEmptyEvaluation();
    if (hdrStudent) hdrStudent.textContent = currentEvaluation.student_name || '';
    if (hdrStudentId) hdrStudentId.textContent = currentEvaluation.student_identifier || '';
    if (hdrEvaluator) hdrEvaluator.textContent = currentEvaluation.evaluator_name || '';
    renderSegueTable();
  }

  async function joinEncounter(id) {
    encounterId = String(id || '').trim();
    if (!encounterId) return;
    // Try to adopt/link first (helps if opened directly by URL).
    await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/link`, { method: 'POST', headers: headersJson(), body: '{}' }).catch(() => {});

    const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}`, { headers: { 'X-Session-Id': sessionId } });
    if (!resp.ok) throw new Error(await resp.text());
    const meta = await resp.json().catch(() => ({}));
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
      await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/finish`, {
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

  btnActivate?.addEventListener('click', async () => {
    if (!encounterId) return;
    if (encounterFinishedAt) {
      const ok = window.confirm('Activar conversación? El estudiante podrá volver a enviar mensajes.');
      if (!ok) return;
      setStatus('Reabriendo...');
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/reopen`, { method: 'POST', headers: headersJson() });
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
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/finish`, {
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
    joinEncounter(enc).catch((e) => {
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
