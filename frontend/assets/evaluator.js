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
  const statusEl = document.getElementById('status');
  const sessionLabel = document.getElementById('session-label');
  const transcriptEl = document.getElementById('transcript');

  const savedView = document.getElementById('saved-view');
  const savedStatusEl = document.getElementById('saved-status');
  const savedEncountersEl = document.getElementById('saved-encounters');
  const encounterView = document.getElementById('encounter-view');
  const dashEncounterActions = document.getElementById('dash-encounter-actions');

  const patientSelect = document.getElementById('patient-select');
  const studentSelect = document.getElementById('student-select');
  const evaluatorNameInput = document.getElementById('evaluator-name');

  const btnBack = document.getElementById('btn-back');
  const btnNewSession = document.getElementById('btn-new-session');
  const btnStart = document.getElementById('btn-start');
  const btnOpenStudent = document.getElementById('btn-open-student');
  const btnNewPatient = document.getElementById('btn-new-patient');
  const btnNewStudent = document.getElementById('btn-new-student');
  const btnLauncherCancel = document.getElementById('btn-launcher-cancel');
  const btnFinish = document.getElementById('btn-finish');
  const btnActivate = document.getElementById('btn-activate');
  const activePatientLabel = document.getElementById('active-patient-label');
  const activeStudentLabel = document.getElementById('active-student-label');
  const headerPatientLabel = document.getElementById('active-patient');
  const headerStudentLabel = document.getElementById('active-student');

  const hdrStudent = document.getElementById('hdr-student');
  const hdrStudentId = document.getElementById('hdr-student-id');
  const hdrEvaluator = document.getElementById('hdr-evaluator');
  const segueWrap = document.getElementById('segue-table-wrap');

  const modalOverlay = document.getElementById('modal-overlay');
  const modalSession = document.getElementById('modal-session');
  const modalPatient = document.getElementById('modal-patient');
  const modalStudent = document.getElementById('modal-student');

  const pFirst = document.getElementById('p-first');
  const pLast = document.getElementById('p-last');
  const pAge = document.getElementById('p-age');
  const pRegion = document.getElementById('p-region');
  const pId = document.getElementById('p-id');
  const pChief = document.getElementById('p-chief');
  const pFeel = document.getElementById('p-feel');
  const pSymptoms = document.getElementById('p-symptoms');
  const pSecret = document.getElementById('p-secret');
  const pDisplay = document.getElementById('p-display');
  const pGenId = document.getElementById('p-gen-id');
  const pSave = document.getElementById('p-save');
  const pStatus = document.getElementById('p-status');
  const pResponseStyle = document.getElementById('p-response-style');
  const pPersonality = document.getElementById('p-personality');
  const pLanguageLevel = document.getElementById('p-language-level');
  const pMemoryLevel = document.getElementById('p-memory-level');
  const pCognitive = document.getElementById('p-cognitive');
  const pSpeakingStyle = document.getElementById('p-speaking-style');

  const sId = document.getElementById('s-id');
  const sName = document.getElementById('s-name');
  const sSave = document.getElementById('s-save');
  const sStatus = document.getElementById('s-status');

  let encounterId = '';
  let encounterFinishedAt = null;
  let ws = null;
  let pingTimer = null;
  let evalSaveTimer = null;
  let currentEvaluation = null;
  let currentTtsAudio = null;
  let currentTtsMessageElement = null;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function setEncounterFinished(finishedAt) {
    encounterFinishedAt = finishedAt || null;
    if (btnFinish) btnFinish.disabled = !encounterId || !!encounterFinishedAt;
    if (btnOpenStudent) btnOpenStudent.disabled = !encounterId;
    if (btnActivate) {
      // "Activar" is used as a reconnect/refresh button. If the encounter is finished,
      // make the read-only state explicit to avoid confusion.
      btnActivate.textContent = encounterFinishedAt ? 'Reabrir conversación' : 'Activar conversación';
    }
  }

  function setMainView(mode) {
    // mode: 'saved' | 'encounter'
    if (dashEncounterActions) dashEncounterActions.classList.toggle('hidden', mode !== 'encounter');

    if (mode === 'encounter') {
      encounterView?.classList.remove('hidden');
      savedView?.classList.add('hidden');
      return;
    }

    if (mode === 'saved') {
      encounterView?.classList.add('hidden');
      savedView?.classList.remove('hidden');
      return;
    }

    // saved
    encounterView?.classList.add('hidden');
    savedView?.classList.remove('hidden');
  }

  function disconnectWs() {
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }
  }

  function goToSavedView(pushState = true) {
    disconnectWs();
    setMainView('saved');
    transcriptEl.innerHTML = '';
    setStatus('');
    loadSavedEncounters().catch(() => {});
    if (pushState) {
      try { history.pushState({ view: 'saved' }, '', location.pathname); } catch {}
    }
  }

  function getOrCreateSessionId() {
    const existing = localStorage.getItem(sessionIdKey);
    if (existing) return existing;
    const created = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(sessionIdKey, created);
    return created;
  }

  const sessionId = getOrCreateSessionId();
  // session_id is an internal key used to link evaluator+student tabs; we don't show it in the UI.
  if (sessionLabel) sessionLabel.textContent = '';

  function headersJson() {
    return { 'Content-Type': 'application/json', 'X-Session-Id': sessionId };
  }

  async function loadPatients() {
    const resp = await fetch('/api/patients', { headers: { 'X-Session-Id': sessionId } });
    const data = await resp.json();
    const patients = data.patients || [];
    patientSelect.innerHTML = '';
    for (const p of patients) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.age})`;
      patientSelect.appendChild(opt);
    }
    updateHdr();
  }

  async function loadStudents() {
    const resp = await fetch('/api/students', { headers: { 'X-Session-Id': sessionId } });
    const data = await resp.json();
    const students = data.students || [];
    studentSelect.innerHTML = '';
    for (const s of students) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name}${s.student_identifier ? ` (${s.student_identifier})` : ''}`;
      studentSelect.appendChild(opt);
    }
    updateHdr();
  }

  function updateHdr() {
    const patientOpt = patientSelect?.selectedOptions?.[0];
    const studentOpt = studentSelect?.selectedOptions?.[0];
    const studentLabel = studentOpt ? studentOpt.textContent : '';
    const patientLabel = patientOpt ? patientOpt.textContent : '';

    const studentDisplay = studentLabel ? String(studentLabel).replace(/\s*\([^)]*\)\s*$/, '') : '';
    if (hdrStudent) hdrStudent.textContent = studentDisplay;
    if (hdrStudentId) {
      const match = studentLabel && studentLabel.match(/\(([^)]+)\)/);
      hdrStudentId.textContent = match ? match[1] : '';
    }
    if (hdrEvaluator) hdrEvaluator.textContent = (evaluatorNameInput?.value || '').trim();

    if (activePatientLabel) activePatientLabel.textContent = patientLabel || 'Sin paciente';
    if (activeStudentLabel) activeStudentLabel.textContent = studentLabel || 'Sin alumno';
    if (headerPatientLabel) headerPatientLabel.textContent = patientLabel || 'Sin paciente';
    if (headerStudentLabel) headerStudentLabel.textContent = studentLabel || 'Sin alumno';
  }

  function _labelForSelectValue(selectEl, value) {
    if (!selectEl || !value) return '';
    const opt = Array.from(selectEl.options || []).find((o) => String(o.value) === String(value));
    return opt ? String(opt.textContent || '') : '';
  }

  function _formatTs(tsSeconds) {
    const n = Number(tsSeconds);
    if (!Number.isFinite(n) || n <= 0) return '';
    try { return new Date(n * 1000).toLocaleString(); } catch { return ''; }
  }

  function _shortId(value) {
    const s = String(value || '').trim();
    if (s.length <= 16) return s;
    return `${s.slice(0, 8)}...${s.slice(-6)}`;
  }

  async function loadSavedEncounters() {
    if (!savedEncountersEl) return;
    try {
      if (savedStatusEl) savedStatusEl.textContent = 'Cargando...';
      const resp = await fetch('/api/evaluations_saved', { headers: { 'X-Session-Id': sessionId } });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const encounters = data.evaluations || [];

      if (!encounters.length) {
        savedEncountersEl.innerHTML = '<div class="eval-small">No hay evaluaciones guardadas.</div>';
        if (savedStatusEl) savedStatusEl.textContent = '';
        return;
      }

      const rows = encounters.map((e) => {
        const encId = String(e.encounter_id || '');
        const patientLabel = _labelForSelectValue(patientSelect, e.patient_id) || String(e.patient_id || '');

        const studentFromSelect = _labelForSelectValue(studentSelect, e.student_id);
        const studentFromEval = String(e.student_name || '').trim();
        const studentIdent = String(e.student_identifier || '').trim();
        const studentLabel = (studentFromSelect || studentFromEval || String(e.student_id || '')).trim();
        const studentDisplay = studentLabel
          ? `${String(studentLabel).replace(/\s*\([^)]*\)\s*$/, '')}${studentIdent ? ` (${studentIdent})` : ''}`
          : 'Alumno';
        const started = _formatTs(e.created_at);
        const finished = _formatTs(e.updated_at);
        const state = e.has_conversation ? 'Evaluación + conversación' : 'Solo evaluación';
        const evalMeta = `Eval: ${Number(e.items_completed || 0)}/${Number(e.items_total || 0)}`;
        const stateChip = e.has_conversation ? '<span class="chip ok">Conversación</span>' : '<span class="chip warn">Sin conversación</span>';

        const meta = `
          <div style="margin-top:6px;">
            ${started ? `<span>Creada: ${escapeHtml(started)}</span>` : ''}
            ${finished ? `<span> &nbsp;|&nbsp; Actualizada: ${escapeHtml(finished)}</span>` : ''}
          </div>
          <div style="margin-top:6px;" class="mono">encounter_id: ${escapeHtml(_shortId(encId))}</div>
        `;

        return `
          <div class="saved-item" data-encounter-id="${escapeHtml(encId)}">
            <div class="saved-item-left">
              <div class="saved-item-title">${escapeHtml(studentDisplay)}</div>
              <div class="saved-item-subtitle">${escapeHtml(patientLabel || 'Paciente')}</div>
              <div class="saved-item-meta">${meta}</div>
             </div>
             <div class="saved-item-actions">
               <button class="eval-btn" data-join type="button">Abrir conversación</button>
               <button class="eval-btn danger" data-delete type="button">Eliminar evaluación</button>
               <div class="saved-item-badges">
                 ${stateChip}
                 <span class="chip">${escapeHtml(evalMeta)}</span>
               </div>
             </div>
           </div>
          `;
      }).join('');

      savedEncountersEl.innerHTML = rows;
      savedEncountersEl.querySelectorAll('[data-join]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const item = btn.closest('[data-encounter-id]');
          const encId = item?.getAttribute('data-encounter-id') || '';
          if (!encId) return;
          try {
            if (savedStatusEl) savedStatusEl.textContent = 'Abriendo...';
            // Always attempt to adopt/link first (helps when the evaluation was created under another session_id).
            await fetch(`/api/encounters/${encodeURIComponent(encId)}/link`, { method: 'POST', headers: headersJson(), body: '{}' }).catch(() => {});
            await joinEncounter(encId);
            if (savedStatusEl) savedStatusEl.textContent = '';
          } catch (e) {
            if (savedStatusEl) savedStatusEl.textContent = 'No se pudo abrir la conversación (puede existir solo la evaluación).';
          }
        });
      });

      savedEncountersEl.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const item = btn.closest('[data-encounter-id]');
          const encId = item?.getAttribute('data-encounter-id') || '';
          if (!encId) return;
          const ok = window.confirm(`Eliminar evaluación?\nencounter_id: ${encId}\n\nEsto también borra la conversación guardada y sus audios.`);
          if (!ok) return;
          try {
            if (savedStatusEl) savedStatusEl.textContent = 'Eliminando...';
            const resp = await fetch(`/api/evaluations/${encodeURIComponent(encId)}`, {
              method: 'DELETE',
              headers: { 'X-Session-Id': sessionId },
            });
            if (!resp.ok) throw new Error(await resp.text());
            await loadSavedEncounters();
            if (savedStatusEl) savedStatusEl.textContent = '';
          } catch (e) {
            if (savedStatusEl) savedStatusEl.textContent = String(e?.message || e);
          }
        });
      });

      if (savedStatusEl) savedStatusEl.textContent = '';
    } catch (e) {
      if (savedStatusEl) savedStatusEl.textContent = String(e?.message || e);
      savedEncountersEl.innerHTML = '<div class="eval-small">No se pudieron cargar las conversaciones.</div>';
    }
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function stopCurrentAudioPlayback() {
      if (!currentTtsAudio) return;
      try { currentTtsAudio.pause(); } catch {}
      const objectUrl = currentTtsAudio.dataset?.objectUrl;
      if (objectUrl) {
          try { URL.revokeObjectURL(objectUrl); } catch {}
      }
      if (currentTtsMessageElement) {
          currentTtsMessageElement.style.opacity = '1';
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
              messageElement.style.opacity = '0.7';
              currentTtsMessageElement = messageElement;
              const statusBadge = messageElement.querySelector('.audio-status-badge');
              if (statusBadge) statusBadge.textContent = 'Hablando';
          }
      };
      audio.onended = () => {
          if (revokeOnStop) {
              try { URL.revokeObjectURL(u); } catch {}
          }
          if (messageElement) {
              messageElement.style.opacity = '1';
              const statusBadge = messageElement.querySelector('.audio-status-badge');
              if (statusBadge) statusBadge.textContent = 'Audio listo';
          }
          if (currentTtsMessageElement === messageElement) currentTtsMessageElement = null;
          if (currentTtsAudio === audio) currentTtsAudio = null;
      };
      currentTtsAudio = audio;
      audio.play().catch((error) => {
          console.warn('Audio playback failed:', error);
          if (messageElement) {
              messageElement.style.opacity = '1';
              const statusBadge = messageElement.querySelector('.audio-status-badge');
              if (statusBadge) statusBadge.textContent = 'Error';
          }
      });
      return audio;
  }

  function playAudioFromBase64(audioBase64, contentType = 'audio/mpeg', messageElement = null) {
      if (!audioBase64) return null;
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      return playAudioFromUrl(objectUrl, messageElement, true);
  }

  function attachAudioControls(messageElement, text, ttsPayload = null, metadata = {}) {
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

    // Evaluator must never generate audio; it only replays audio attached to the message.
    const payload = ttsPayload || {};

    if (payload.audio_url) {
      status.textContent = 'Audio listo';
      button.textContent = 'Reproducir';
      button.addEventListener('click', () => {
        // Playback uses a URL served by the backend (audio is persisted on disk).
        playAudioFromUrl(payload.audio_url, messageElement, false);
      });
    } else if (payload.audio_base64) {
      status.textContent = 'Audio listo';
      button.textContent = 'Reproducir';
      button.addEventListener('click', () => {
        playAudioFromBase64(payload.audio_base64, payload.content_type || 'audio/mpeg', messageElement);
      });
    } else {
      status.textContent = 'Audio no disponible';
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
    attachAudioControls(div, plainContent, ttsPayload, { message_id: messageId, role: div.dataset.role });

    transcriptEl.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });

    if (role === 'assistant' && ttsPayload?.audio_base64) {
        playAudioFromBase64(ttsPayload.audio_base64, ttsPayload.content_type, div);
    }
  }

  function updateTranscriptAudio(messageId, ttsPayload) {
    if (!messageId) return;
    const selector = `[data-message-id=\"${messageId}\"]`;
    const messageEl = transcriptEl.querySelector(selector);
    if (!messageEl) return;
    const text = messageEl.dataset.messageText || '';
    attachAudioControls(messageEl, text, ttsPayload, {
      message_id: messageId,
      role: messageEl.dataset.role || 'assistant',
    });
  }

  async function loadEncounterHistory(encId) {
    const id = String(encId || '').trim();
    if (!id) return;
    try {
      const resp = await fetch(`/api/encounters/${encodeURIComponent(id)}/history`, { headers: { 'X-Session-Id': sessionId } });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => ({}));
      const visible = Array.isArray(data.visible_messages) ? data.visible_messages : [];
      if (!visible.length) return;

      // Render the transcript from persisted history. WS snapshot will merge on top.
      transcriptEl.innerHTML = '';
      for (const m of visible) {
        if (!m?.content) continue;
        addTranscript(m.role, m.content, m.tts, m.message_id || '');
      }
    } catch {
      // Best-effort: WS snapshot can still populate.
    }
  }

  function connectWs() {
    if (!encounterId) return;
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws/encounters/${encodeURIComponent(encounterId)}?session_id=${encodeURIComponent(sessionId)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      try { ws.send('hello'); } catch {}
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => { try { ws.send('ping'); } catch {} }, 20000);
    };
    ws.onclose = (ev) => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;

      // Close code 1008 is used by the backend when the encounter isn't available for this session.
      if (ev && ev.code === 1008) {
        setStatus('No se pudo abrir la conversación (no está vinculada a esta sesión). Volvé a "Evaluaciones guardadas" y abrila desde ahí.');
      }
    };
    ws.onerror = () => {
    };
    ws.onmessage = (ev) => {
      let payload = null;
      try { payload = JSON.parse(String(ev.data || '{}')); } catch { return; }
      if (payload.type === 'snapshot') {
        setEncounterFinished(payload.finished_at);

        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        // Merge snapshot into the current transcript (avoid nuking the existing DOM).
        const existingIds = new Set(
          Array.from(transcriptEl.querySelectorAll('[data-message-id]'))
            .map((el) => el?.dataset?.messageId || '')
            .filter(Boolean),
        );
        if (!existingIds.size && transcriptEl.innerHTML) {
          // If the DOM has content but no ids (legacy), fall back to clearing to avoid duplicates.
          transcriptEl.innerHTML = '';
        }

        for (const m of messages) {
          if (!m?.content) continue;
          const mid = m.message_id || '';
          if (mid && existingIds.has(mid)) continue;
          addTranscript(m.role, m.content, m.tts, m.message_id || '');
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
        setTimeout(() => goToSavedView(true), 0);
      }
      if (payload.type === 'encounter_reopened') {
        setEncounterFinished(null);
        setStatus('Conversación reabierta');
        return;
      }
    };
  }

  function buildEmptyEvaluation() {
    const opt = studentSelect?.selectedOptions?.[0];
    const label = opt ? opt.textContent : '';
    const name = label ? String(label).replace(/\s*\([^)]*\)\s*$/, '') : '';
    const match = label && label.match(/\(([^)]+)\)/);
    const ident = match ? match[1] : '';

    return {
      id: '',
      encounter_id: encounterId,
      patient_id: patientSelect?.value || '',
      student_id: studentSelect?.value || '',
      student_name: name,
      student_identifier: ident,
      evaluator_name: (evaluatorNameInput?.value || '').trim(),
      items: segueCriteria.map((c) => ({ item_id: c.id, value: 'nc', observations: '' })),
    };
  }

  function renderSegueTable() {
    if (!currentEvaluation) {
      segueWrap.textContent = 'Inicia una sesion para habilitar la planilla.';
      segueWrap.className = 'eval-small';
      return;
    }

    updateHdr();

    const items = currentEvaluation.items || [];
    const byId = new Map(items.map((it) => [String(it.item_id), it]));

    const rows = segueCriteria.map((c) => {
      const it = byId.get(c.id) || { item_id: c.id, value: 'nc', observations: '' };
      const val = String(it.value || 'nc');
      const obs = String(it.observations || '');
      return `
        <tr>
          <td>${escapeHtml(c.id)}</td>
          <td><div style="font-weight:600;">${escapeHtml(c.area)}</div><div>${escapeHtml(c.label)}</div></td>
          <td>
            <div class="radio-row">
              ${['yes','no','nc'].map((v) => `
                <label style="display:flex; gap:4px; align-items:center;">
                  <input type="radio" name="seg-${escapeHtml(c.id)}" data-seg-id="${escapeHtml(c.id)}" value="${v}" ${val === v ? 'checked' : ''} />
                  <span>${v === 'yes' ? 'Si' : v === 'no' ? 'No' : 'NC'}</span>
                </label>
              `).join('')}
            </div>
          </td>
          <td>
            <textarea class="eval-input obs obs-textarea" data-obs-id="${escapeHtml(c.id)}" placeholder="Observaciones">${escapeHtml(obs)}</textarea>
          </td>
        </tr>
      `;
    }).join('');

    segueWrap.className = '';
    segueWrap.innerHTML = `
      <table class="eval-table">
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Item</th>
            <th style="width:140px;">Si/No/NC</th>
            <th style="width:320px;">Observaciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    segueWrap.querySelectorAll('input[type=radio]').forEach((r) => {
      r.addEventListener('change', () => {
        const id = String(r.getAttribute('data-seg-id') || '');
        const v = String(r.value || 'nc');
        currentEvaluation.items = currentEvaluation.items.map((it) => it.item_id === id ? { ...it, value: v } : it);
        scheduleSaveEvaluation();
      });
    });

    segueWrap.querySelectorAll('[data-obs-id]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = String(inp.getAttribute('data-obs-id') || '');
        const v = String(inp.value || '');
        currentEvaluation.items = currentEvaluation.items.map((it) => it.item_id === id ? { ...it, observations: v } : it);
        scheduleSaveEvaluation();
      });
    });
  }

  async function loadEvaluation() {
    if (!encounterId) return;
    const resp = await fetch(`/api/evaluations?encounter_id=${encodeURIComponent(encounterId)}`, { headers: { 'X-Session-Id': sessionId } });
    const data = await resp.json();
    if (data && data.evaluation) {
      currentEvaluation = data.evaluation;
    } else {
      currentEvaluation = buildEmptyEvaluation();
      await saveEvaluationNow();
    }
    renderSegueTable();
  }

  async function saveEvaluationNow() {
    if (!currentEvaluation) return;
    currentEvaluation.encounter_id = encounterId;
    currentEvaluation.patient_id = patientSelect?.value || currentEvaluation.patient_id;
    currentEvaluation.student_id = studentSelect?.value || currentEvaluation.student_id;
    currentEvaluation.evaluator_name = (evaluatorNameInput?.value || '').trim();

    const resp = await fetch('/api/evaluations', {
      method: 'POST',
      headers: headersJson(),
      body: JSON.stringify(currentEvaluation),
    });
    const data = await resp.json();
    if (data?.evaluation) currentEvaluation = data.evaluation;
  }

  function scheduleSaveEvaluation() {
    if (evalSaveTimer) clearTimeout(evalSaveTimer);
    evalSaveTimer = setTimeout(() => {
      saveEvaluationNow().catch(() => setStatus('No se pudo guardar la evaluacion'));
    }, 450);
  }

  function openModal(el) {
    if (!el) return;
    modalOverlay.style.display = 'block';
    el.style.display = 'block';
  }

  function closeModals() {
    modalOverlay.style.display = 'none';
    if (modalSession) modalSession.style.display = 'none';
    modalPatient.style.display = 'none';
    modalStudent.style.display = 'none';
  }

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  modalOverlay.addEventListener('click', closeModals);

  btnBack?.addEventListener('click', () => goToSavedView(true));
  btnNewSession?.addEventListener('click', () => openModal(modalSession));
  btnNewPatient?.addEventListener('click', () => openModal(modalPatient));
  btnNewStudent?.addEventListener('click', () => openModal(modalStudent));
  btnLauncherCancel?.addEventListener('click', () => closeModals());
  btnActivate?.addEventListener('click', async () => {
    if (!encounterId) {
      setStatus('No hay conversación seleccionada');
      return;
    }

    // If the encounter was finished, "Activar" means "re-open" (allow chat again).
    if (encounterFinishedAt) {
      const ok = window.confirm('Reabrir conversación? El estudiante podrá volver a enviar mensajes.');
      if (!ok) return;
      try {
        setStatus('Reabriendo...');
        const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/reopen`, {
          method: 'POST',
          headers: headersJson(),
        });
        if (!resp.ok) throw new Error(await resp.text());
        setEncounterFinished(null);
        setMainView('encounter');
        connectWs();
        setStatus('Conversación reabierta');
        loadSavedEncounters().catch(() => {});
      } catch (e) {
        setStatus(String(e?.message || e));
      }
      return;
    }

    // Otherwise, just reconnect WS and ensure the encounter view is visible (useful if WS dropped).
    setMainView('encounter');
    connectWs();
    setStatus('Conversación activa');
  });

  // Browser back button support: go back to the saved list.
  window.addEventListener('popstate', (ev) => {
    const state = ev?.state || {};
    if (state.view === 'encounter' && state.encounterId) {
      joinEncounter(state.encounterId).catch(() => goToSavedView(false));
      return;
    }
    goToSavedView(false);
  });

  pGenId.addEventListener('click', () => {
    const first = (pFirst.value || '').trim().toLowerCase();
    const last = (pLast.value || '').trim().toLowerCase();
    const age = (pAge.value || '').trim();
    const base = `${first}_${last}_${age}`.replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    pId.value = base || `paciente_${Date.now()}`;
  });

  pSave.addEventListener('click', async () => {
    pStatus.textContent = '';
    try {
      const first = (pFirst.value || '').trim();
      const last = (pLast.value || '').trim();
      const fullName = [first, last].filter(Boolean).join(' ').trim();
      const id = (pId.value || '').trim();
      const age = parseInt(String(pAge.value || '').trim(), 10);
      if (!id) throw new Error('id requerido');
      if (!first) throw new Error('Nombre requerido');
      if (!Number.isFinite(age)) throw new Error('Edad requerida');

      const symptoms = String(pSymptoms.value || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const responseProfile = (pResponseStyle?.value || 'Calmado');
      const personality = (pPersonality?.value || 'Neutral');
      const languageLevel = (pLanguageLevel?.value || 'B');
      const memoryLevel = (pMemoryLevel?.value || 'Low');
      const cognitive = (pCognitive?.value || 'Normal');
      const speakingStyle = (pSpeakingStyle?.value || 'rioplatense');

      const payload = {
        id,
        name: first,
        age,
        region: (pRegion.value || 'AMBA').trim() || 'AMBA',
        administrative: { full_name: fullName || first },
        triage: { reference_short: (pChief.value || '').slice(0, 70) },
        institutional_history: { diagnoses: [], surgeries: [], allergies: [], medications_current: [] },
        recent_studies: { labs: [], imaging: [], notes: [] },
        chief_complaint: (pChief.value || '').trim() || 'Hola, doc. Vine a la guardia.',
        what_they_feel: (pFeel.value || '').trim() || 'Me siento mal.',
        symptoms_reported: symptoms,
        known_medical_history: {},
        unknown_real_problem: (pSecret.value || '(Completar)').trim() || '(Completar)',
        doctor_display_real_problem: (pDisplay.value || '(Completar)').trim() || '(Completar)',
        true_case: null,
        personality,
        language_level: languageLevel,
        medical_history_recall: memoryLevel,
        cognitive_confusion: cognitive,
        speaking_style: speakingStyle,
        behavior_profile: responseProfile,
        response_style: responseProfile
      };

      const resp = await fetch('/api/patients', { method: 'POST', headers: headersJson(), body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error(await resp.text());
      pStatus.textContent = 'Guardado';
      closeModals();
      await loadPatients();
      patientSelect.value = id;
    } catch (e) {
      pStatus.textContent = String(e?.message || e);
    }
  });

  sSave.addEventListener('click', async () => {
    sStatus.textContent = '';
    try {
      const id = (sId.value || '').trim();
      const name = (sName.value || '').trim();
      if (!id || !name) throw new Error('Completa DNI y nombre');

      // DNI is both the storage id (filename) and the identifier shown in UI/SEGUE.
      const payload = { id, name, student_identifier: id, metadata: {} };
      const resp = await fetch('/api/students', { method: 'POST', headers: headersJson(), body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error(await resp.text());
      sStatus.textContent = 'Guardado';
      closeModals();
      await loadStudents();
      studentSelect.value = id;
      updateHdr();
    } catch (e) {
      sStatus.textContent = String(e?.message || e);
    }
  });

  patientSelect.addEventListener('change', () => {
    updateHdr();
  });
  studentSelect.addEventListener('change', () => {
    updateHdr();
    if (encounterId) loadEvaluation().catch(() => {});
  });
  evaluatorNameInput.addEventListener('input', () => {
    updateHdr();
    if (currentEvaluation) scheduleSaveEvaluation();
  });

  btnStart.addEventListener('click', async () => {
    try {
      setStatus('Iniciando...');
      const patientId = patientSelect.value;
      const studentId = studentSelect.value;
      const evalName = (evaluatorNameInput.value || '').trim();
      if (!patientId) throw new Error('Selecciona paciente');
      if (!studentId) throw new Error('Selecciona alumno');
      if (!evalName) throw new Error('Completa evaluador/a');

      updateHdr();

      const resp = await fetch('/api/encounters/start', {
        method: 'POST',
        headers: headersJson(),
        body: JSON.stringify({ patient_id: patientId, student_id: studentId, evaluator_name: evalName }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      encounterId = data.encounter_id;
      setEncounterFinished(null);

      transcriptEl.innerHTML = '';
      connectWs();

      currentEvaluation = buildEmptyEvaluation();
      await saveEvaluationNow();
    renderSegueTable();

    closeModals();
    setMainView('encounter');
    loadSavedEncounters().catch(() => {});
    try { history.pushState({ view: 'encounter', encounterId }, '', `?encounter_id=${encodeURIComponent(encounterId)}`); } catch {}
    if (btnFinish) btnFinish.disabled = false;
    setStatus(`Listo (encounter_id: ${encounterId})`);
    } catch (e) {
      setStatus(String(e?.message || e));
    }
  });

  btnOpenStudent.addEventListener('click', () => {
    if (!encounterId) {
      setStatus('Primero inicia una sesion');
      return;
    }
    const url = `/frontend/student?session_id=${encodeURIComponent(sessionId)}&encounter_id=${encodeURIComponent(encounterId)}`;
    window.open(url, '_blank');
  });

  async function joinEncounter(encId) {
    const id = String(encId || '').trim();
    if (!id) throw new Error('Completa encounter_id');

    // Validates the encounter exists for this session, and returns metadata (patient_id / finished_at).
    const resp = await fetch(`/api/encounters/${encodeURIComponent(id)}`, { headers: { 'X-Session-Id': sessionId } });
    if (!resp.ok) throw new Error(await resp.text());
    const meta = await resp.json();

    encounterId = id;
    setEncounterFinished(meta.finished_at);

    // Align patient selector so downloads/exports use the same patient as the encounter.
    if (meta.patient_id && patientSelect) patientSelect.value = meta.patient_id;
    if (meta.student_id && studentSelect) studentSelect.value = meta.student_id;
    if (meta.evaluator_name && evaluatorNameInput) evaluatorNameInput.value = meta.evaluator_name;
    updateHdr();

    transcriptEl.innerHTML = '';
    // Load persisted history via HTTP first (robust across WS drops/adoption quirks).
    await loadEncounterHistory(encounterId).catch(() => {});
    connectWs();
    await loadEvaluation().catch(() => {});
    closeModals();
    setMainView('encounter');
    loadSavedEncounters().catch(() => {});
    try { history.pushState({ view: 'encounter', encounterId }, '', `?encounter_id=${encodeURIComponent(encounterId)}`); } catch {}
    setStatus(encounterFinishedAt ? 'Conversación vinculada (finalizada)' : 'Conversación vinculada');
  }

  btnFinish?.addEventListener('click', async () => {
    if (!encounterId) return setStatus('No hay encounter');
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
      loadSavedEncounters().catch(() => {});
      goToSavedView(true);
    } catch (e) {
      setStatus(String(e?.message || e));
    }
  });


  setMainView('saved');
  closeModals();
  try { history.replaceState({ view: 'saved' }, '', location.pathname); } catch {}

  Promise.all([loadPatients(), loadStudents()])
    .then(() => loadSavedEncounters())
    .catch(() => {});

  updateHdr();
  setStatus('Listo');
})();
