(function attachUnrealBridge(window) {
    const AudioTools = window.MedSimStudentAudio;
    const sessionIdKey = 'medsim_session_id';

    let currentEncounterId = '';
    let currentSessionId = '';
    let pollTimer = null;
    let joining = false;
    let encounterWs = null;

    let recordingStream = null;
    let recordingContext = null;
    let recordingSource = null;
    let recordingProcessor = null;
    let recordingSampleRate = 44100;
    let audioChunks = [];
    let isRecording = false;

    function emit(type, payload = {}) {
        try {
            const data = { type, ...payload, ts: Date.now() };
            console.log(`MEDSIM_EVENT:${JSON.stringify(data)}`);
        } catch (error) {
            console.log(`MEDSIM_EVENT:${JSON.stringify({ type: 'error', message: String(error?.message || error), ts: Date.now() })}`);
        }
    }

    function emitPlain(prefix, value) {
        console.log(`${prefix}:${String(value ?? '')}`);
    }

    function genSessionId() {
        return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    }

    function ensureSessionId() {
        const existing = localStorage.getItem(sessionIdKey);
        const sid = String(existing || genSessionId()).trim();
        localStorage.setItem(sessionIdKey, sid);
        currentSessionId = sid;
        return sid;
    }

    function headersJson() {
        return {
            'Content-Type': 'application/json',
            'X-Session-Id': ensureSessionId(),
        };
    }

    function stateSnapshot() {
        return {
            encounter_id: currentEncounterId || '',
            session_id: currentSessionId || ensureSessionId(),
            recording: !!isRecording,
            connected: !!currentEncounterId,
        };
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(() => {
            if (!currentEncounterId) {
                connectToActiveSession().catch((error) => {
                    emit('session_waiting', { message: String(error?.message || error) });
                });
            }
        }, 4000);
    }

    function teardownRecorder() {
        if (recordingProcessor) {
            try { recordingProcessor.disconnect(); } catch {}
            recordingProcessor.onaudioprocess = null;
            recordingProcessor = null;
        }
        if (recordingSource) {
            try { recordingSource.disconnect(); } catch {}
            recordingSource = null;
        }
        if (recordingContext) {
            try { recordingContext.close(); } catch {}
            recordingContext = null;
        }
        if (recordingStream) {
            try { recordingStream.getTracks().forEach((track) => track.stop()); } catch {}
            recordingStream = null;
        }
    }

    async function setupRecorder() {
        if (!recordingStream) {
            recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        if (!recordingContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) throw new Error('AudioContext no soportado');
            recordingContext = new AudioCtx();
            recordingSampleRate = recordingContext.sampleRate || 44100;
        }
        if (!recordingSource || !recordingProcessor) {
            recordingSource = recordingContext.createMediaStreamSource(recordingStream);
            recordingProcessor = recordingContext.createScriptProcessor(4096, 1, 1);
            recordingProcessor.onaudioprocess = (event) => {
                if (!isRecording) return;
                const channelData = event.inputBuffer.getChannelData(0);
                audioChunks.push(new Float32Array(channelData));
            };
            recordingSource.connect(recordingProcessor);
            recordingProcessor.connect(recordingContext.destination);
        }
    }

    async function adoptEncounter(sessionId, encounterId) {
        await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
            body: '{}',
        }).catch(() => {});
    }

    function connectEncounterWs(encounterId) {
        if (!encounterId) return;
        if (encounterWs) {
            try { encounterWs.close(); } catch {}
            encounterWs = null;
        }

        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${location.host}/ws/encounters/${encodeURIComponent(encounterId)}?session_id=${encodeURIComponent(ensureSessionId())}`;

        try {
            encounterWs = new WebSocket(url);
        } catch (error) {
            emit('ws_error', { message: String(error?.message || error), encounter_id: encounterId });
            encounterWs = null;
            return;
        }

        encounterWs.onopen = () => {
            emit('ws_connected', { encounter_id: encounterId });
        };

        encounterWs.onerror = () => {
            emit('ws_error', { encounter_id: encounterId, message: 'WebSocket error' });
        };

        encounterWs.onclose = () => {
            emit('ws_closed', { encounter_id: encounterId });
            encounterWs = null;
        };

        encounterWs.onmessage = (event) => {
            let payload = null;
            try { payload = JSON.parse(String(event.data || '{}')); } catch { return; }
            emit('ws_message', {
                encounter_id: encounterId,
                raw: payload,
            });
        };
    }

    async function connectToActiveSession() {
        if (joining) return stateSnapshot();
        joining = true;

        try {
            const sessionId = ensureSessionId();
            const response = await fetch('/api/encounters_public', { headers: { 'X-Session-Id': sessionId } });
            if (!response.ok) {
                throw new Error(`encounters_public (${response.status})`);
            }

            const payload = await response.json();
            const encounters = Array.isArray(payload) ? payload : (Array.isArray(payload.encounters) ? payload.encounters : []);
            const active = encounters.find((encounter) => encounter && encounter.finished_at == null);

            if (!active || !active.encounter_id) {
                currentEncounterId = '';
                emit('session_waiting', { message: 'No hay encounter activo', session_id: sessionId });
                return stateSnapshot();
            }

            currentEncounterId = String(active.encounter_id).trim();
            await adoptEncounter(sessionId, currentEncounterId);
            connectEncounterWs(currentEncounterId);

            emit('session_connected', {
                encounter_id: currentEncounterId,
                session_id: sessionId,
                patient_id: active.patient_id || '',
            });
            emitPlain('MEDSIM_STATUS', 'session_connected');
            emitPlain('MEDSIM_ENCOUNTER_ID', currentEncounterId);
            emitPlain('MEDSIM_PATIENT_ID', active.patient_id || '');

            return stateSnapshot();
        } finally {
            joining = false;
        }
    }

    async function startRecording() {
        if (isRecording) return stateSnapshot();
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microfono no soportado');
        }
        if (!currentEncounterId) {
            await connectToActiveSession();
        }
        if (!currentEncounterId) {
            throw new Error('No hay session activa');
        }

        audioChunks = [];
        await setupRecorder();
        isRecording = true;
        emit('recording_started', stateSnapshot());
        emitPlain('MEDSIM_STATUS', 'recording_started');
        return stateSnapshot();
    }

    async function stopAndSend() {
        if (!isRecording) return stateSnapshot();
        isRecording = false;

        const wavBlob = AudioTools.encodeWavBlob(audioChunks, recordingSampleRate);
        teardownRecorder();
        emit('recording_stopped', { ...stateSnapshot(), bytes: wavBlob?.size || 0 });
        emitPlain('MEDSIM_STATUS', 'recording_stopped');

        if (!wavBlob || !wavBlob.size) {
            throw new Error('No se pudo capturar audio');
        }
        if (!currentEncounterId) {
            throw new Error('No hay encounter activo');
        }

        const formData = new FormData();
        formData.append('file', wavBlob, 'recording.wav');
        formData.append('encounter_id', currentEncounterId);

        const response = await fetch('/api/audio_turn', {
            method: 'POST',
            body: formData,
            headers: { 'X-Session-Id': ensureSessionId() },
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(detail || `audio_turn (${response.status})`);
        }

        const payload = await response.json();
        const userText = String(payload?.user_text || payload?.transcript?.text || '').trim();
        const replyText = String(payload?.reply_text || payload?.assistant_reply?.text || '').trim();
        const audioUrl = String(payload?.assistant_audio?.audio_url || '').trim();
        const audioBase64 = String(payload?.assistant_audio?.audio_base64 || '').trim();
        const contentType = String(payload?.assistant_audio?.content_type || 'audio/wav').trim();

        emitPlain('MEDSIM_USER_TEXT', userText);
        emitPlain('MEDSIM_REPLY_TEXT', replyText);
        emitPlain('MEDSIM_AUDIO_URL', audioUrl);
        emitPlain('MEDSIM_STATUS', 'reply_received');

        if (audioUrl) {
            AudioTools.playAudioFromUrl(audioUrl);
        } else if (audioBase64) {
            AudioTools.playAudioFromBase64(audioBase64, contentType);
        }

        emit('reply_received', {
            encounter_id: currentEncounterId,
            session_id: ensureSessionId(),
            user_text: userText,
            reply_text: replyText,
            audio_url: audioUrl,
            has_audio_base64: !!audioBase64,
            content_type: contentType,
            raw: payload,
        });

        return stateSnapshot();
    }

    async function toggleRecording() {
        if (isRecording) return await stopAndSend();
        return await startRecording();
    }

    function disconnect() {
        stopPolling();
        teardownRecorder();
        if (encounterWs) {
            try { encounterWs.close(); } catch {}
            encounterWs = null;
        }
        currentEncounterId = '';
        isRecording = false;
        emit('disconnected', { session_id: ensureSessionId() });
    }

    window.medsimBridge = {
        connectToActiveSession,
        startRecording,
        stopAndSend,
        toggleRecording,
        disconnect,
        getState: stateSnapshot,
    };

    ensureSessionId();
    emit('bridge_ready', stateSnapshot());
    connectToActiveSession().catch((error) => {
        emit('session_waiting', { message: String(error?.message || error), session_id: ensureSessionId() });
    });
    startPolling();
})(window);
