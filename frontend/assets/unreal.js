(function () {
  const StudentAudio = window.MedSimStudentAudio;
  const attachAudioControls = StudentAudio?.attachAudioControls;

  const sessionIdKey = 'medsim_unreal_session_id';
  const urlParams = new URLSearchParams(window.location.search);
  const sessionFromUrl = (urlParams.get('session_id') || '').trim();
  const encounterId = (urlParams.get('encounter_id') || '').trim();

  if (sessionFromUrl) localStorage.setItem(sessionIdKey, sessionFromUrl);
  const sessionId = (() => {
    const existing = localStorage.getItem(sessionIdKey);
    if (existing) return existing;
    const created = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(sessionIdKey, created);
    return created;
  })();

  const transcriptEl = document.getElementById('transcript');
  const statusEl = document.getElementById('status');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-message');
  const refreshButton = document.getElementById('refresh-history');
  const uploadButton = document.getElementById('upload-audio');
  const audioFileInput = document.getElementById('audio-file');
  const uploadStatusEl = document.getElementById('upload-status');
  const encounterBadgeEl = document.getElementById('encounter-badge');
  const encounterIdValueEl = document.getElementById('encounter-id-value');
  const patientValueEl = document.getElementById('patient-value');
  const encounterStateValueEl = document.getElementById('encounter-state-value');

  let ws = null;
  let messageIds = new Set();
  let encounterFinished = false;

  function setStatus(text, tone = '') {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.remove('status-ok', 'status-error');
    if (tone === 'ok') statusEl.classList.add('status-ok');
    if (tone === 'error') statusEl.classList.add('status-error');
  }

  function setUploadStatus(text, tone = '') {
    if (!uploadStatusEl) return;
    uploadStatusEl.textContent = text || '';
    uploadStatusEl.classList.remove('status-ok', 'status-error');
    if (tone === 'ok') uploadStatusEl.classList.add('status-ok');
    if (tone === 'error') uploadStatusEl.classList.add('status-error');
  }

  function getMessageAudioPayload(message) {
    if (!message) return null;
    if (message.tts) return message.tts;
    if (message.audio_url) {
      return {
        audio_base64: null,
        audio_url: message.audio_url,
        content_type: 'audio/wav',
      };
    }
    return null;
  }

  function messageLabel(role) {
    return String(role || '').trim().toLowerCase() === 'user' ? 'Student' : 'Unreal';
  }

  function addMessage(message) {
    if (!message?.content) return;
    const messageId = String(message.message_id || '').trim();
    if (messageId && messageIds.has(messageId)) return;
    if (messageId) messageIds.add(messageId);

    const role = String(message.role || 'assistant').trim().toLowerCase();
    const item = document.createElement('article');
    item.className = `message ${role === 'user' ? 'user' : 'assistant'}`;
    if (messageId) item.dataset.messageId = messageId;

    const meta = document.createElement('div');
    meta.className = 'message-meta';

    const label = document.createElement('span');
    label.textContent = messageLabel(role);
    meta.appendChild(label);

    const time = document.createElement('span');
    const timestamp = Number(message.timestamp || 0);
    time.textContent = timestamp ? new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    meta.appendChild(time);

    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = String(message.content || '');

    item.appendChild(meta);
    item.appendChild(text);

    if (attachAudioControls) {
      attachAudioControls({
        messageElement: item,
        payload: getMessageAudioPayload(message),
      });
    }

    transcriptEl?.appendChild(item);
    item.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function loadEncounterMeta() {
    if (!encounterId) return;
    try {
      const encounterResp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}`, {
        headers: { 'X-Session-Id': sessionId },
      });
      if (!encounterResp.ok) throw new Error(await encounterResp.text());
      const encounter = await encounterResp.json();

      if (encounterBadgeEl) encounterBadgeEl.textContent = `Encounter ${encounterId}`;
      if (encounterIdValueEl) encounterIdValueEl.textContent = encounterId;

      encounterFinished = encounter.finished_at != null;
      if (encounterStateValueEl) encounterStateValueEl.textContent = encounterFinished ? 'Finalizado' : 'Activo';
      setStatus(encounterFinished ? 'Conectado en modo solo lectura' : 'Conectado al encounter', encounterFinished ? '' : 'ok');

      if (encounter.patient_id) {
        const patientResp = await fetch(`/api/patients/${encodeURIComponent(encounter.patient_id)}`, {
          headers: { 'X-Session-Id': sessionId },
        }).catch(() => null);
        if (patientResp?.ok) {
          const patient = await patientResp.json().catch(() => ({}));
          if (patientValueEl) {
            patientValueEl.textContent = patient?.name || patient?.patient?.name || encounter.patient_id;
          }
        } else if (patientValueEl) {
          patientValueEl.textContent = encounter.patient_id;
        }
      }
    } catch (error) {
      setStatus(String(error?.message || error), 'error');
    }
  }

  async function loadHistory() {
    if (!encounterId) return;
    try {
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/history`, {
        headers: { 'X-Session-Id': sessionId },
      });
      if (!resp.ok) throw new Error(await resp.text());
      const payload = await resp.json().catch(() => ({}));
      const visible = Array.isArray(payload.visible_messages) ? payload.visible_messages : [];
      if (transcriptEl) transcriptEl.innerHTML = '';
      messageIds = new Set();
      for (const message of visible) addMessage(message);
      setStatus(encounterFinished ? 'Historial cargado (solo lectura)' : 'Historial cargado', 'ok');
    } catch (error) {
      setStatus(String(error?.message || error), 'error');
    }
  }

  function connectWs() {
    if (!encounterId) return;
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${location.host}/ws/encounters/${encodeURIComponent(encounterId)}?session_id=${encodeURIComponent(sessionId)}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      setStatus(`WS error: ${String(error?.message || error)}`, 'error');
      return;
    }

    ws.onopen = () => {
      setStatus(encounterFinished ? 'WebSocket conectado (solo lectura)' : 'WebSocket conectado', 'ok');
    };

    ws.onclose = () => {
      ws = null;
      setStatus('WebSocket desconectado', 'error');
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      let payload = null;
      try { payload = JSON.parse(String(event.data || '{}')); } catch { return; }

      if (payload.type === 'snapshot') {
        encounterFinished = payload.finished_at != null;
        if (encounterStateValueEl) encounterStateValueEl.textContent = encounterFinished ? 'Finalizado' : 'Activo';
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        for (const message of messages) {
          if (message?.role === 'system') continue;
          addMessage(message);
        }
        return;
      }

      if (payload.type === 'message_added' && payload.event) {
        addMessage(payload.event);
        return;
      }

      if (payload?.role && payload?.content) {
        addMessage(payload);
        return;
      }

      if (payload.type === 'encounter_finished') {
        encounterFinished = true;
        if (encounterStateValueEl) encounterStateValueEl.textContent = 'Finalizado';
        setStatus('Encounter finalizado', '');
        return;
      }

      if (payload.type === 'encounter_reopened') {
        encounterFinished = false;
        if (encounterStateValueEl) encounterStateValueEl.textContent = 'Activo';
        setStatus('Encounter reactivado', 'ok');
      }
    };
  }

  async function sendMessage() {
    const message = String(messageInput?.value || '').trim();
    if (!message) return;
    if (encounterFinished) {
      setStatus('El encounter está finalizado', 'error');
      return;
    }

    try {
      sendButton.disabled = true;
      setStatus('Enviando mensaje...', '');
      const resp = await fetch(`/api/chat/with_unreal/${encodeURIComponent(encounterId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({
          role: 'assistant',
          message,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      messageInput.value = '';
      setStatus('Mensaje enviado a la conversación', 'ok');
    } catch (error) {
      setStatus(String(error?.message || error), 'error');
    } finally {
      sendButton.disabled = false;
    }
  }

  async function uploadAudio() {
    const file = audioFileInput?.files?.[0];
    if (!file) {
      setUploadStatus('Seleccioná un archivo de audio primero.', 'error');
      return;
    }
    if (encounterFinished) {
      setUploadStatus('El encounter está finalizado.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file, file.name || 'unreal-audio.wav');

    try {
      uploadButton.disabled = true;
      setUploadStatus('Subiendo audio...', '');
      const resp = await fetch(`/api/audio_turn/with_unreal/${encodeURIComponent(encounterId)}`, {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
        body: formData,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const payload = await resp.json().catch(() => ({}));
      if (!payload?.ok) throw new Error('No se pudo confirmar la subida del audio');
      if (audioFileInput) audioFileInput.value = '';
      setUploadStatus('Audio subido correctamente.', 'ok');
    } catch (error) {
      setUploadStatus(String(error?.message || error), 'error');
    } finally {
      uploadButton.disabled = false;
    }
  }

  if (!encounterId) {
    window.location.href = '/frontend/unreal_join';
    return;
  }

  sendButton?.addEventListener('click', sendMessage);
  refreshButton?.addEventListener('click', () => loadHistory());
  uploadButton?.addEventListener('click', uploadAudio);
  messageInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
  });

  loadEncounterMeta().then(loadHistory).finally(connectWs);
})();
