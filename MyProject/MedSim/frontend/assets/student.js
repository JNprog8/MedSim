document.addEventListener('DOMContentLoaded', () => {
    const StudentContract = window.MedSimStudentContract;
    const StudentAudio = window.MedSimStudentAudio;
    const {
        extractErrorMessage,
        getAssistantMessageId,
        getMessageAudioPayload,
        getReplyText,
        getTtsPayload,
        getUserText,
        isFinishedEncounterResponse,
        isMissingEncounterResponse,
        requestChatReply: requestChatReplyFromApi,
    } = StudentContract;
    const {
        attachAudioControls: attachStudentAudioControls,
        encodeWavBlob,
        playAudioFromBase64,
        playAudioFromUrl,
        stopCurrentAudioPlayback,
    } = StudentAudio;

    const micButton = document.getElementById('mic-button');
    const micHint = document.getElementById('mic-hint');
    const messagesContainer = document.getElementById('messages');
    const statusDiv = document.getElementById('status');
    const textMessageInput = document.getElementById('text-message');
    const sendButton = document.getElementById('send-button');
    const patientBar = document.getElementById('patient-bar');
    const clinicalPanel = document.getElementById('clinical-panel');

    const sessionIdKey = 'medsim_session_id';
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = (urlParams.get('session_id') || '').trim();
    const encounterFromUrl = (urlParams.get('encounter_id') || '').trim();
    if (sessionFromUrl) localStorage.setItem(sessionIdKey, sessionFromUrl);

    const patientIdKey = 'medsim_patient_id';
    const sessionId = (() => {
        const existing = localStorage.getItem(sessionIdKey);
        if (existing) return existing;
        const created = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
        localStorage.setItem(sessionIdKey, created);
        return created;
    })();

    let recordingStream = null;
    let recordingRecorder = null;
    let recordingContext = null;
    let recordingSource = null;
    let recordingProcessor = null;
    let audioChunks = [];
    let recordingSampleRate = 44100;
    let recognition = null;
    let lastRecognizedText = '';
    let backendAudioState = null;
    let isRecording = false;
    let sttFinalText = '';
    let cancelRecording = false;
    let speechRecognitionActive = false;
    let dictationSeedText = '';

    // Patient selector container (near chat)
    const patientContainer = document.createElement('div');
    patientContainer.className = 'patient-row';
    patientContainer.hidden = true;
    patientContainer.innerHTML = `
        <select id="patient-select" class="model-select"></select>
        <button id="reload-patients" class="config-button" type="button">Recargar</button>
        <button id="finish-encounter" class="config-button finish-button" type="button">Cerrar</button>
    `;
    patientBar?.appendChild(patientContainer);


    // Get the elements after they're created
    const patientSelect = document.getElementById('patient-select');
    const reloadPatientsButton = document.getElementById('reload-patients');
    const finishEncounterButton = document.getElementById('finish-encounter');
    let chatLocked = false;
    let encounterClosed = false;
    let encounterWs = null;

    function setChatLocked(locked) {
        chatLocked = !!locked;
    }

    function setClinicalText(text) {
        if (!clinicalPanel) return;
        clinicalPanel.textContent = text;
    }

    function isAudioEnabled() {
        return true;
    }

    function renderClinical(patient) {
        if (!clinicalPanel) return;
        clinicalPanel.innerHTML = '';

        if (!patient) {
            setClinicalText('Elegi un paciente para ver sus datos clinicos.');
            return;
        }

        const admin = patient.administrative || {};
        const triage = patient.triage || {};
        const inst = patient.institutional_history || {};
        const studies = patient.recent_studies || {};

        const fullName = (admin.full_name || '').trim();
        const dob = (admin.date_of_birth || '').trim();
        const dni = (admin.dni || '').trim();
        const insurance = (admin.insurance || '').trim();
        const sex = (admin.sex || '').trim();
        const occupation = (admin.occupation || '').trim();

        const summary = document.createElement('div');
        summary.className = 'clinical-summary';

        const header = document.createElement('div');
        header.className = 'clinical-header';
        header.textContent = fullName || patient.name || 'Paciente';
        if (patient.age) {
            header.textContent += ` - ${patient.age} Años`;
        }
        summary.appendChild(header);

        clinicalPanel.appendChild(summary);

        function addVisibleBlock(title, valueEl) {
            const block = document.createElement('div');
            block.className = 'clinical-visible';

            const t = document.createElement('div');
            t.className = 'clinical-section-title';
            t.textContent = title;

            block.appendChild(t);
            block.appendChild(valueEl);
            clinicalPanel.appendChild(block);
        }

        function listToUl(items) {
            const ul = document.createElement('ul');
            ul.className = 'clinical-list';
            for (const it of (items || [])) {
                const li = document.createElement('li');
                li.textContent = it;
                ul.appendChild(li);
            }
            return ul;
        }

        const adminRows = [];
        if (fullName) adminRows.push(['Nombre y apellido', fullName]);
        if (dob) adminRows.push(['Fecha de nacimiento', dob]);
        if (dni) adminRows.push(['DNI', dni]);
        if (insurance) adminRows.push(['Obra social / prepaga', insurance]);
        if (sex) adminRows.push(['Sexo', sex]);
        if (occupation) adminRows.push(['Ocupacion', occupation]);

        if (adminRows.length) {
            const dl = document.createElement('dl');
            dl.className = 'clinical-grid';
            for (const [k, v] of adminRows) {
                const dt = document.createElement('dt');
                dt.textContent = k;
                const dd = document.createElement('dd');
                dd.textContent = v;
                dl.appendChild(dt);
                dl.appendChild(dd);
            }
            addVisibleBlock('Datos de identificacion', dl);
        }

        const triageShort = (triage.reference_short || '').trim();
        if (triageShort) {
            const v = document.createElement('div');
            v.className = 'clinical-value';
            v.textContent = triageShort;
            addVisibleBlock('Motivo de consulta (triage)', v);
        }

        const allergies = Array.isArray(inst.allergies) ? inst.allergies : [];
        if (allergies.length) {
            const v = document.createElement('div');
            v.className = 'clinical-allergy';
            v.textContent = `Alergias: ${allergies.join(', ')}`;
            addVisibleBlock('Alergias (HC)', v);
        }

        const diagnoses = Array.isArray(inst.diagnoses) ? inst.diagnoses : [];
        const surgeries = Array.isArray(inst.surgeries) ? inst.surgeries : [];
        const meds = Array.isArray(inst.medications_current) ? inst.medications_current : [];

        if (diagnoses.length || surgeries.length || meds.length) {
            const wrap = document.createElement('div');
            wrap.className = 'clinical-block';
            if (diagnoses.length) {
                const t = document.createElement('div');
                t.className = 'clinical-label';
                t.textContent = 'Diagnosticos previos';
                wrap.appendChild(t);
                wrap.appendChild(listToUl(diagnoses));
            }
            if (surgeries.length) {
                const t = document.createElement('div');
                t.className = 'clinical-label';
                t.textContent = 'Cirugias previas';
                wrap.appendChild(t);
                wrap.appendChild(listToUl(surgeries));
            }
            if (meds.length) {
                const t = document.createElement('div');
                t.className = 'clinical-label';
                t.textContent = 'Medicamentos actuales';
                wrap.appendChild(t);
                wrap.appendChild(listToUl(meds));
            }
            addVisibleBlock('Historia clinica (sistema)', wrap);
        }

        const labs = Array.isArray(studies.labs) ? studies.labs : [];
        const imaging = Array.isArray(studies.imaging) ? studies.imaging : [];
        const notes = Array.isArray(studies.notes) ? studies.notes : [];
        if (labs.length || imaging.length || notes.length) {
            const wrap = document.createElement('div');
            wrap.className = 'clinical-block';
            if (labs.length) {
                const t = document.createElement('div');
                t.className = 'clinical-label';
                t.textContent = 'Laboratorios recientes';
                wrap.appendChild(t);
                wrap.appendChild(listToUl(labs));
            }
            if (imaging.length) {
                const t = document.createElement('div');
                t.className = 'clinical-label';
                t.textContent = 'Imagenes recientes';
                wrap.appendChild(t);
                wrap.appendChild(listToUl(imaging));
            }
            if (notes.length) {
                const t = document.createElement('div');
                t.className = 'clinical-label';
                t.textContent = 'Notas recientes';
                wrap.appendChild(t);
                wrap.appendChild(listToUl(notes));
            }
            addVisibleBlock('Estudios recientes (sistema)', wrap);
        }

        if (!clinicalPanel.children.length) {
            const empty = document.createElement('div');
            empty.className = 'clinical-visible';

            const label = document.createElement('div');
            label.className = 'clinical-section-title';
            label.textContent = 'Ficha clinica';

            const value = document.createElement('div');
            value.className = 'clinical-value';
            value.textContent = 'No hay datos clínicos visibles cargados para este paciente.';

            empty.appendChild(label);
            empty.appendChild(value);
            clinicalPanel.appendChild(empty);
        }
    }

    async function loadClinical(patientId) {
        if (!patientId) {
            renderClinical(null);
            return;
        }
        try {
            setClinicalText('Cargando ficha clinica...');
            const resp = await fetch(`/api/patients/${encodeURIComponent(patientId)}`);
            if (!resp.ok) {
                if (resp.status === 404) {
                    const selectedText = patientSelect?.selectedOptions?.[0]?.textContent || String(patientId || '');
                    clinicalPanel.innerHTML = `
                        <div class="clinical-summary">
                            <div class="clinical-header">${escapeHtml(selectedText)}</div>
                        </div>
                        <div class="clinical-visible">
                            <div class="clinical-section-title">Ficha clinica</div>
                            <div class="clinical-value">No hay una ficha clínica disponible para este paciente en el sistema actual.</div>
                        </div>
                    `;
                    return;
                }
                throw new Error(`patient (${resp.status})`);
            }
            const data = await resp.json();
            const patient = data?.patient || data;
            renderClinical(patient);
        } catch (e) {
            console.error('Failed to load patient details:', e);
            setClinicalText('Error cargando ficha clinica.');
        }
    }

    async function loadStudentView(encounterId, fallbackPatientId = '') {
        const encId = String(encounterId || '').trim();
        if (!encId) {
            await loadClinical(fallbackPatientId);
            return;
        }
        try {
            setClinicalText('Cargando ficha clinica...');
            const resp = await fetch(`/api/encounters/${encodeURIComponent(encId)}/student_view`, {
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
            });
            if (!resp.ok) {
                await loadClinical(fallbackPatientId);
                return;
            }
            const data = await resp.json().catch(() => ({}));
            renderClinical(data?.patient || null);
            if (data?.finished_at) {
                setEncounterClosed('Conversación finalizada (solo lectura)');
            } else if (encounterClosed) {
                setEncounterOpen('Conversación activa');
            }
        } catch (e) {
            console.error('Failed to load student view:', e);
            await loadClinical(fallbackPatientId);
        }
    }

    let currentEncounterId = null;

    const lockedToEncounterFromUrl = !!encounterFromUrl;

    async function adoptEncounterFromUrl() {
        if (!encounterFromUrl) return;
        try {
            currentEncounterId = encounterFromUrl;
            statusDiv.textContent = 'Uniendo a consulta...';
            const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterFromUrl)}`, {
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
            });
            if (!resp.ok) throw new Error(`encounter (${resp.status})`);
            const enc = await resp.json();
            if (enc?.finished_at) {
                setEncounterClosed('Conversación finalizada (solo lectura)');
            }
            connectEncounterWs(encounterFromUrl);
            await loadEncounterHistory(encounterFromUrl);
            const pid = (enc.patient_id || '').trim();
            if (pid) {
                if (patientSelect) {
                    patientSelect.value = pid;
                    localStorage.setItem(patientIdKey, pid);
                }
                await loadStudentView(encounterFromUrl, pid);
            }
            if (patientSelect) patientSelect.disabled = true;
            if (reloadPatientsButton) reloadPatientsButton.disabled = true;
            statusDiv.textContent = `Consulta unida (${encounterFromUrl})`;
        } catch (e) {
            console.error('Failed to adopt encounter from URL:', e);
            statusDiv.textContent = 'No se pudo unir a la consulta.';
        }
    }

    async function startEncounter(patientId) {
        if (lockedToEncounterFromUrl) {
            return;
        }
        if (!patientId) {
            currentEncounterId = null;
            return;
        }
        setChatLocked(false);
        try {
            statusDiv.textContent = 'Iniciando consulta...';
            const resp = await fetch('/api/encounters/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
                body: JSON.stringify({ patient_id: patientId }),
            });
            if (!resp.ok) throw new Error(`encounter start (${resp.status})`);
            const data = await resp.json();
            currentEncounterId = data.encounter_id;
            connectEncounterWs(currentEncounterId);
            messagesContainer.innerHTML = '';
            statusDiv.textContent = 'Consulta iniciada';
            setChatLocked(false);
        } catch (e) {
            console.error('Failed to start encounter:', e);
            currentEncounterId = null;
            statusDiv.textContent = 'Error iniciando consulta';
            setChatLocked(false);
        }
    }

    async function ensureActiveEncounter(patientId = patientSelect?.value) {
        if (lockedToEncounterFromUrl && currentEncounterId) {
            return;
        }
        if (!patientId) {
            currentEncounterId = null;
            throw new Error('No hay paciente seleccionado.');
        }
        await startEncounter(patientId);
        if (!currentEncounterId) {
            throw new Error('No se pudo reiniciar la consulta.');
        }
    }

    function ensureFinishModal() {
        if (document.getElementById('finish-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'finish-modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.hidden = true;

        const modal = document.createElement('div');
        modal.id = 'finish-modal';
        modal.className = 'modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title">Finalizar consulta</div>
                <button id="finish-close" class="icon-button" type="button" aria-label="Cerrar">x</button>
            </div>
            <div class="modal-body">
                <label class="modal-label">Diagnostico principal (tu hipotesis)</label>
                <input id="finish-final-dx" class="modal-input" type="text" placeholder="Ej: migrana / apendicitis / SCA..." />

                <label class="modal-label">Diferenciales (separados por coma)</label>
                <input id="finish-differential" class="modal-input" type="text" placeholder="Ej: gastroenteritis, ITU, ..." />

                <label class="modal-label">Indicaciones / plan</label>
                <textarea id="finish-plan" class="modal-textarea" rows="4" placeholder="Que indicas y por que..."></textarea>

                <label class="modal-label">Receta (opcional)</label>
                <textarea id="finish-rx" class="modal-textarea" rows="3" placeholder="Medicaciones, dosis, etc."></textarea>

                <div class="modal-actions">
                    <button id="finish-cancel" class="config-button" type="button">Cancelar</button>
                    <button id="finish-submit" class="config-button finish-button" type="button">Revelar caso</button>
                </div>
                <div id="finish-status" class="modal-status"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        const close = () => {
            overlay.hidden = true;
            modal.hidden = true;
        };

        overlay.addEventListener('click', close);
        modal.querySelector('#finish-close')?.addEventListener('click', close);
        modal.querySelector('#finish-cancel')?.addEventListener('click', close);

        modal.querySelector('#finish-submit')?.addEventListener('click', async () => {
            const status = modal.querySelector('#finish-status');
            if (!currentEncounterId) {
                if (status) status.textContent = 'No hay consulta activa (reinicia el paciente).';
                return;
            }

            const finalDx = (modal.querySelector('#finish-final-dx')?.value || '').trim();
            const differential = (modal.querySelector('#finish-differential')?.value || '').trim();
            const plan = (modal.querySelector('#finish-plan')?.value || '').trim();
            const rx = (modal.querySelector('#finish-rx')?.value || '').trim();

            try {
                if (status) status.textContent = 'Enviando...';
                const payload = {
                    final_diagnosis: finalDx,
                    differential,
                    plan,
                    prescription: rx,
                };
                let resp = await fetch(`/api/encounters/${encodeURIComponent(currentEncounterId)}/finish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
                    body: JSON.stringify(payload),
                });
                if (!resp.ok) {
                    const detail = await resp.text().catch(() => '');
                    if (isMissingEncounterResponse(resp.status, detail)) {
                        await ensureActiveEncounter();
                        resp = await fetch(`/api/encounters/${encodeURIComponent(currentEncounterId)}/finish`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
                            body: JSON.stringify(payload),
                        });
                    }
                }
                if (!resp.ok) throw new Error(`finish (${resp.status})`);
                 const data = await resp.json();

                const tc = data.true_case || {};
                const mainDx = (tc.diagnostico_principal || data.true_diagnosis || '').trim();
                const diffs = Array.isArray(tc.diferenciales) ? tc.diferenciales.filter(Boolean) : [];
                const planText = String(tc.indicaciones_plan || data.true_details || '').trim();
                const rxText = String(tc.receta || '').trim();
                const toHtml = (t) => escapeHtml(String(t || '')).replaceAll('\n', '<br>');

                modal.querySelector('.modal-title').textContent = 'Resultado verdadero';
                modal.querySelector('.modal-body').innerHTML = `
                    <div class="reveal-box">
                        <div class="reveal-label">Diagnostico principal</div>
                        <div class="reveal-value">${escapeHtml(mainDx)}</div>
                        ${diffs.length ? `
                            <div class="reveal-label" style="margin-top:10px;">Diferenciales</div>
                            <div class="reveal-value">${escapeHtml(diffs.join(', '))}</div>
                        ` : ''}
                        <div class="reveal-label" style="margin-top:10px;">Indicaciones / plan</div>
                        <div class="reveal-value">${toHtml(planText)}</div>
                        ${rxText ? `
                            <div class="reveal-label" style="margin-top:10px;">Receta</div>
                            <div class="reveal-value">${toHtml(rxText)}</div>
                        ` : ''}
                    </div>
                    <div class="modal-actions">
                        <button id="finish-done" class="config-button" type="button">Cerrar</button>
                    </div>
                `;
                modal.querySelector('#finish-done')?.addEventListener('click', close);
            } catch (e) {
                console.error('Failed to finish encounter:', e);
                if (status) status.textContent = 'Error al finalizar la consulta.';
            }
        });
    }

    function openFinishModal() {
        document.getElementById('finish-modal')?.remove();
        document.getElementById('finish-modal-overlay')?.remove();
        ensureFinishModal();
        const overlay = document.getElementById('finish-modal-overlay');
        const modal = document.getElementById('finish-modal');
        if (overlay) overlay.hidden = false;
        if (modal) modal.hidden = false;
    }

    function escapeHtml(text) {
        return String(text)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('\"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    async function loadPatients() {
        try {
            const resp = await fetch('/api/patients', { headers: { 'X-Session-Id': sessionId } });
            if (!resp.ok) throw new Error(`patients (${resp.status})`);
            const data = await resp.json();
            const patients = data.patients || [];

            patientSelect.innerHTML = '';
            for (const p of patients) {
                const opt = document.createElement('option');
                opt.value = p.id;
                const region = p.region ? ` - ${p.region}` : '';
                opt.textContent = `${p.name} (${p.age})${region}`;
                patientSelect.appendChild(opt);
            }

            if (lockedToEncounterFromUrl && encounterFromUrl) {
                await adoptEncounterFromUrl();
                return;
            }

            const saved = localStorage.getItem(patientIdKey);
            const initial = (saved && patients.find(p => p.id === saved)) ? saved : (patients[0]?.id || '');
            if (initial) {
                patientSelect.value = initial;
                localStorage.setItem(patientIdKey, initial);
                await startEncounter(initial);
                await loadStudentView(currentEncounterId, initial);
            } else {
                renderClinical(null);
            }

            patientSelect.onchange = async () => {
                const chosen = patientSelect.value;
                localStorage.setItem(patientIdKey, chosen);
                await startEncounter(chosen);
                await loadStudentView(currentEncounterId, chosen);
                messagesContainer.innerHTML = '';
                statusDiv.textContent = 'Paciente cambiado';
            };
        } catch (e) {
            console.error('Failed to load patients:', e);
            setClinicalText('Error cargando pacientes.');
        }
    }

    if (reloadPatientsButton) {
        reloadPatientsButton.addEventListener('click', async () => {
            await loadPatients();
        });
    }

    if (finishEncounterButton) {
        finishEncounterButton.addEventListener('click', () => {
            openFinishModal();
        });
    }

    function audioFlag(primaryKey, legacyKey) {
        return !!(backendAudioState?.[primaryKey] ?? backendAudioState?.[legacyKey]);
    }

    function hasBackendAudioConfig() {
        const sttConfigured = audioFlag('stt_api_key_configured', 'stt_configured');
        const ttsConfigured = audioFlag('tts_api_key_configured', 'tts_configured');
        return Boolean(sttConfigured || ttsConfigured);
    }

    function hasAudioConfig() {
        return hasBackendAudioConfig();
    }

    function hasSttConfig() {
        return audioFlag('stt_api_key_configured', 'stt_configured');
    }

    function hasTtsConfig() {
        return audioFlag('tts_api_key_configured', 'tts_configured');
    }

    // Load patients early so chat can be tied to a profile
    loadPatients();

    function applyAudioModeUI() {
        const enabled = isAudioEnabled();
        const configured = hasAudioConfig();
        const sttConfigured = hasSttConfig();
        if (micButton) micButton.disabled = !enabled || !sttConfigured;
        if (micHint) {
            micHint.textContent = !enabled
                ? 'Microfono: audio desactivado'
                : sttConfigured
                    ? 'Microfono: listo'
                    : configured
                        ? 'Microfono: STT no disponible'
                        : 'Microfono: audio no configurado';
        }
    }
    async function loadConfigState() {
        try {
            const response = await fetch('/api/config_state');
            if (!response.ok) return;
            const data = await response.json();
            backendAudioState = data?.audio || null;
            applyAudioModeUI();
        } catch (e) {
            console.error('Failed to load backend config state:', e);
        }
    }

    // Initial load
    loadConfigState();

    messagesContainer.innerHTML = '';

    function updateLiveTranscription(finalText, interimText = '') {
        const parts = [dictationSeedText, finalText, interimText]
            .map(part => (part || '').trim())
            .filter(Boolean);
        textMessageInput.value = parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    function stopSpeechRecognition() {
        if (!recognition || !speechRecognitionActive) return;
        speechRecognitionActive = false;
        try { recognition.stop(); } catch (e) { /* ignore */ }
    }

    function startSpeechRecognition() {
        if (!recognition) return;
        dictationSeedText = (textMessageInput.value || '').trim();
        sttFinalText = '';
        lastRecognizedText = '';
        speechRecognitionActive = true;
        try { recognition.start(); } catch (e) { /* ignore duplicate start */ }
    }

    // Initialize recorder and live dictation
    async function setupRecorder() {
        try {
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

            applyAudioModeUI();
        } catch (err) {
            console.error('Error accessing microphone:', err);
            statusDiv.textContent = 'Error: Microphone access denied';
        }
    }

    function setupSpeechRecognition() {
        const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionApi) {
            recognition = null;
            return;
        }

        recognition = new SpeechRecognitionApi();
        recognition.lang = 'es-AR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let finalText = sttFinalText;
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const transcript = (event.results[i][0]?.transcript || '').trim();
                if (!transcript) continue;
                if (event.results[i].isFinal) {
                    finalText = `${finalText} ${transcript}`.trim();
                } else {
                    interimText = `${interimText} ${transcript}`.trim();
                }
            }
            sttFinalText = finalText;
            lastRecognizedText = interimText;
            updateLiveTranscription(finalText, interimText);
        };

        recognition.onerror = (event) => {
            if (event?.error === 'aborted' || event?.error === 'no-speech') return;
            console.warn('Speech recognition error:', event?.error);
        };

        recognition.onend = () => {
            if (isRecording && speechRecognitionActive) {
                try { recognition.start(); } catch (e) { /* ignore */ }
            }
        };
    }

    // Add message to chat with timing info
    function addMessage(text, role, timing = null, audioBlob = null) {
        const rowDiv = document.createElement('div');
        rowDiv.className = `message-row ${role}-row`;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.dataset.messageText = text;
          
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;
        messageDiv.appendChild(textDiv);

        if (audioBlob instanceof Blob && audioBlob.size > 0) {
            messageDiv.classList.add('audio-linked');

            const audioMetaDiv = document.createElement('div');
            audioMetaDiv.className = 'message-audio-meta';

            const statusBadge = document.createElement('span');
            statusBadge.className = 'message-audio-status';
            statusBadge.textContent = 'Audio listo';
            audioMetaDiv.appendChild(statusBadge);

            const replayButton = document.createElement('button');
            replayButton.type = 'button';
            replayButton.className = 'message-audio-replay';
            replayButton.textContent = 'Repetir';
            replayButton.addEventListener('click', () => {
                const objectUrl = URL.createObjectURL(audioBlob);
                playAudioFromUrl(objectUrl, { messageElement: messageDiv, revokeOnStop: true });
                setTtsMode('backend', 'Audio: reproduciendo');
            });
            audioMetaDiv.appendChild(replayButton);

            messageDiv.appendChild(audioMetaDiv);
        } else {
            // Keep the UI consistent: show "Sin audio" when there is no recording attached.
            messageDiv.dataset.role = role;
            attachAudioControls(messageDiv, text, null, { role });
        }

        if (timing) {
            const timingDiv = document.createElement('div');
            timingDiv.className = 'message-timing';
            timingDiv.textContent = `\u23F1\uFE0F ${timing.toFixed(2)}s`;
            messageDiv.appendChild(timingDiv);
        }

        rowDiv.appendChild(messageDiv);

        messagesContainer.appendChild(rowDiv);
        rowDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    function addUserTurn(text, timing = null, ttsPayload = null, metadata = {}) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'message-row user-row';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.dataset.messageText = text || '';
        if (metadata?.message_id) messageDiv.dataset.messageId = metadata.message_id;
        messageDiv.dataset.role = 'user';

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text || '';
        messageDiv.appendChild(textDiv);

        // Attach replay controls when history includes an audio_url/audio_base64 payload (STT recordings).
        attachAudioControls(messageDiv, text || '', ttsPayload, { message_id: metadata?.message_id, role: 'user' });

        if (timing) {
            const timingDiv = document.createElement('div');
            timingDiv.className = 'message-timing';
            timingDiv.textContent = `\u23F1\uFE0F ${timing.toFixed(2)}s`;
            messageDiv.appendChild(timingDiv);
        }

        rowDiv.appendChild(messageDiv);
        messagesContainer.appendChild(rowDiv);
    }

    async function loadEncounterHistory(encounterId) {
        const encId = String(encounterId || '').trim();
        if (!encId) return;
        try {
            const resp = await fetch(`/api/encounters/${encodeURIComponent(encId)}/history`, {
                headers: { 'X-Session-Id': sessionId }
            });
            if (!resp.ok) return;
            const data = await resp.json().catch(() => ({}));
            const messages = Array.isArray(data.visible_messages) ? data.visible_messages : [];
            if (!messages.length) return;

            messagesContainer.innerHTML = '';
            for (const m of messages) {
                const role = m?.role;
                const content = String(m?.content || '').trim();
                if (!content) continue;
                const mid = m?.message_id || '';
                if (role === 'user') {
                    addUserTurn(content, null, getMessageAudioPayload(m), { message_id: mid });
                } else if (role === 'assistant') {
                    addAssistantTurn(content, null, getMessageAudioPayload(m), false, { message_id: mid, role: 'assistant' });
                }
            }
        } catch (e) {
            console.warn('Failed to load encounter history:', e);
        }
    }

    function createTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message typing-indicator';

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = 'Escribiendo';

        const dotsSpan = document.createElement('span');
        dotsSpan.className = 'typing-dots';
        dotsSpan.textContent = '...';

        const timerSpan = document.createElement('span');
        timerSpan.className = 'typing-timer';
        timerSpan.textContent = '0.0s';

        textDiv.appendChild(labelSpan);
        textDiv.appendChild(document.createTextNode(' '));
        textDiv.appendChild(dotsSpan);
        textDiv.appendChild(timerSpan);
        messageDiv.appendChild(textDiv);

        messagesContainer.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

        const started = performance.now();
        let dotsState = 0;
        const interval = setInterval(() => {
            const seconds = (performance.now() - started) / 1000;
            timerSpan.textContent = `${seconds.toFixed(1)}s`;
            dotsState = (dotsState + 1) % 4;
            dotsSpan.textContent = '.'.repeat(dotsState) || ' ';
        }, 100);

        return {
            remove: () => {
                clearInterval(interval);
                try { messageDiv.remove(); } catch {}
            }
        };
    }

    function setTtsMode() {}

    function attachAudioControls(messageElement, _text, ttsPayload = null) {
        attachStudentAudioControls({
            messageElement,
            payload: ttsPayload,
            onModeChange: (mode, text) => setTtsMode(mode, text),
        });
    }

    function setEncounterClosed(reason) {
        encounterClosed = true;
        if (sendButton) sendButton.disabled = true;
        if (micButton) micButton.disabled = true;
        if (textMessageInput) textMessageInput.disabled = true;
        statusDiv.textContent = reason || 'Conversación finalizada';
    }

    function setEncounterOpen(reason) {
        encounterClosed = false;
        if (sendButton) sendButton.disabled = false;
        if (micButton) micButton.disabled = false;
        if (textMessageInput) textMessageInput.disabled = false;
        statusDiv.textContent = reason || 'Conversación activa';
    }

    function connectEncounterWs(encounterId) {
        const encId = String(encounterId || '').trim();
        if (!encId) return;

        // Close previous socket (if any).
        if (encounterWs) {
            try { encounterWs.close(); } catch {}
            encounterWs = null;
        }

        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${location.host}/ws/encounters/${encodeURIComponent(encId)}?session_id=${encodeURIComponent(sessionId)}`;
        try {
            encounterWs = new WebSocket(url);
        } catch {
            encounterWs = null;
            return;
        }

        encounterWs.onmessage = (ev) => {
            let payload = null;
            try { payload = JSON.parse(String(ev.data || '{}')); } catch { return; }
            if (payload.type === 'snapshot') {
                if (payload.finished_at) {
                    setEncounterClosed('Conversación finalizada (solo lectura)');
                } else if (encounterClosed) {
                    setEncounterOpen('Conversación activa');
                }
                return;
            }
            if (payload?.role && payload?.content) {
                const role = String(payload.role || '').trim();
                const ttsPayload = getMessageAudioPayload(payload);
                const mid = payload.message_id || '';
                if (role === 'user') {
                    addUserTurn(payload.content, null, ttsPayload, { message_id: mid });
                } else if (role === 'assistant') {
                    addAssistantTurn(payload.content, null, ttsPayload, false, { message_id: mid, role: 'assistant' });
                }
                return;
            }
            if (payload.type === 'encounter_finished') {
                setEncounterClosed('Conversación finalizada');
                return;
            }
            if (payload.type === 'encounter_reopened') {
                setEncounterOpen('Conversación activada');
                return;
            }
        };

        encounterWs.onclose = () => {
            // Best-effort; the session still works without WS.
            encounterWs = null;
        };
        encounterWs.onerror = () => {};
    }

    function addAssistantTurn(text, timing = null, ttsPayload = null, autoplay = false, metadata = {}) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'message-row assistant-row';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        if (ttsPayload?.audio_url || ttsPayload?.audio_base64) messageDiv.classList.add('audio-linked');
        messageDiv.dataset.messageText = text;
        if (metadata?.message_id) {
            messageDiv.dataset.messageId = metadata.message_id;
        }
        messageDiv.dataset.role = metadata?.role || 'assistant';

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;
        messageDiv.appendChild(textDiv);

        attachAudioControls(messageDiv, text, ttsPayload, metadata);

        if (timing) {
            const timingDiv = document.createElement('div');
            timingDiv.className = 'message-timing';
            timingDiv.textContent = `\u23F1\uFE0F ${timing.toFixed(2)}s`;
            messageDiv.appendChild(timingDiv);
        }

        rowDiv.appendChild(messageDiv);
        messagesContainer.appendChild(rowDiv);
        rowDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

        if (autoplay && (ttsPayload?.audio_url || ttsPayload?.audio_base64)) {
            if (ttsPayload?.audio_url) {
                playAudioFromUrl(ttsPayload.audio_url, { messageElement: messageDiv, revokeOnStop: false });
            } else {
                playAudioFromBase64(ttsPayload.audio_base64, ttsPayload.content_type, { messageElement: messageDiv });
            }
            setTtsMode('backend', 'Audio: reproduciendo');
        }
        return messageDiv;
    }

    async function requestChatReply(message) {
        return await requestChatReplyFromApi({
            message,
            sessionId,
            includeTts: isAudioEnabled() && hasTtsConfig(),
            patientId: patientSelect?.value || '',
            encounterId: currentEncounterId,
            ensureActiveEncounter,
            onEncounterFinished: () => setEncounterClosed('Conversación finalizada'),
        });
    }

    async function sendTextMessage() {
        if (encounterClosed) return;
        const message = (textMessageInput.value || '').trim();
        if (!message) return;

        textMessageInput.value = '';
        await processTextConversation(message, 0, false);
    }

    // Process the conversation flow
    async function processConversation(audioBlob) {
        if (encounterClosed) return;
        if (!audioBlob) return;
        let payload = null;
        const buildAudioFormData = () => {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.wav');
            if (patientSelect?.value) formData.append('patient_id', patientSelect.value);
            if (currentEncounterId) formData.append('encounter_id', currentEncounterId);
            return formData;
        };

        let response = await fetch('/api/audio_turn', {
            method: 'POST',
            body: buildAudioFormData(),
            headers: { 'X-Session-Id': sessionId }
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            if (currentEncounterId && isFinishedEncounterResponse(response.status, detail)) {
                setEncounterClosed('Conversación finalizada');
                throw new Error('Conversación finalizada');
            }
            if (currentEncounterId && isMissingEncounterResponse(response.status, detail)) {
                await ensureActiveEncounter();
                response = await fetch('/api/audio_turn', {
                    method: 'POST',
                    body: buildAudioFormData(),
                    headers: { 'X-Session-Id': sessionId }
                });
            } else {
                throw new Error(extractErrorMessage(detail, 'Audio roundtrip failed'));
            }
        }

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            if (currentEncounterId && isFinishedEncounterResponse(response.status, detail)) {
                setEncounterClosed('Conversación finalizada');
                throw new Error('Conversación finalizada');
            }
            throw new Error(extractErrorMessage(detail, 'Audio roundtrip failed'));
        }

        payload = await response.json();
        const userText = getUserText(payload);
        if (userText) addMessage(userText, 'user', null, audioBlob);
        const replyText = getReplyText(payload);
        const ttsPayload = getTtsPayload(payload);
        const assistantMessageId = getAssistantMessageId(payload);
        if (replyText) {
            addAssistantTurn(
                replyText,
                payload.chat?.elapsed_time || null,
                ttsPayload,
                true,
                { message_id: assistantMessageId, role: 'assistant' },
            );
        }
        statusDiv.textContent = 'Listo';
    }

    async function processTextConversation(userText, sttElapsedSeconds = 0, autoSpeak = false) {
        addMessage(userText, 'user', sttElapsedSeconds || null);

        let typing = null;
        const shouldLock = !chatLocked;
        try {
            sendButton.disabled = true;
            statusDiv.textContent = 'Esperando respuesta...';
            typing = createTypingIndicator();
            if (shouldLock) setChatLocked(true);

            const chatData = await requestChatReply(userText);
            typing.remove();
            const ttsPayload = getTtsPayload(chatData);
            const assistantMessageId = getAssistantMessageId(chatData);
            const replyText = getReplyText(chatData);
            addAssistantTurn(
                replyText,
                chatData.chat?.elapsed_time || chatData.elapsed_time,
                ttsPayload,
                !!(ttsPayload?.audio_url || ttsPayload?.audio_base64),
                { message_id: assistantMessageId, role: 'assistant' },
            );
            statusDiv.textContent = 'Listo';
        } catch (error) {
            console.error('Conversation error:', error);
            typing?.remove();
            statusDiv.textContent = `Error: ${error.message}`;
            if (shouldLock) setChatLocked(false);
        } finally {
            sendButton.disabled = false;
        }
    }

    function setRecordingUI(recording, hintText) {
        if (micButton) micButton.classList.toggle('recording', !!recording);
        if (micHint && hintText) micHint.textContent = hintText;
    }

    function forceStopRecording(hintText = 'Microfono: listo') {
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
        recordingRecorder = null;
        isRecording = false;
        setRecordingUI(false, hintText);
    }

    async function startRecording() {
        if (!hasAudioConfig()) {
            statusDiv.textContent = 'Audio no configurado';
            return;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!navigator.mediaDevices?.getUserMedia || !AudioCtx) {
            statusDiv.textContent = 'Microfono no soportado';
            return;
        }
        try {
            audioChunks = [];
            await setupRecorder();
            if (!recordingContext || !recordingProcessor) {
                throw new Error('No se pudo iniciar la captura de audio');
            }
            audioChunks = [];
            isRecording = true;
            setRecordingUI(true, 'Microfono: grabando');
            statusDiv.textContent = 'Grabando...';
        } catch (error) {
            console.error('Failed to start recording:', error);
            forceStopRecording('Microfono: error');
            statusDiv.textContent = 'No se pudo acceder al microfono';
        }
    }

    async function stopRecording() {
        if (!isRecording) return;
        setRecordingUI(false, 'Microfono: procesando');
        statusDiv.textContent = 'Procesando audio...';
        const wavBlob = encodeWavBlob(audioChunks, recordingSampleRate);
        forceStopRecording('Microfono: listo');
        if (!wavBlob.size) return;
        try {
            await processConversation(wavBlob);
        } catch (error) {
            console.error('Audio conversation error:', error);
            statusDiv.textContent = `Error: ${error.message}`;
        }
    }

    if (micButton) {
        micButton.addEventListener('click', async () => {
            if (isRecording) await stopRecording();
            else await startRecording();
        });
    }

    applyAudioModeUI();
    // La captura de audio se inicializa bajo demanda y se envia como WAV para Gemini.

    sendButton.addEventListener('click', sendTextMessage);
    textMessageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendTextMessage();
        }
    });
});


