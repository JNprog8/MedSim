document.addEventListener('DOMContentLoaded', () => {
    function extractErrorMessage(rawText, fallback = 'Request failed') {
        const text = String(rawText || '').trim();
        if (!text) return fallback;
        try {
            const payload = JSON.parse(text);
            if (payload && typeof payload === 'object') {
                const detail = payload.detail;
                if (typeof detail === 'string' && detail.trim()) return detail.trim();
                if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) {
                    return detail.message.trim();
                }
                if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
            }
        } catch {}
        return text;
    }

    const menuButton = document.getElementById('menu-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const micButton = document.getElementById('mic-button');
    const micHint = document.getElementById('mic-hint');
    const messagesContainer = document.getElementById('messages');
    const statusDiv = document.getElementById('status');
    const llmProviderSelect = document.getElementById('llm-provider');
    const apiKeyInput = document.getElementById('api-key');
    const audioToggle = document.getElementById('audio-toggle');
    const sttApiUrlInput = document.getElementById('stt-api-url');
    const sttApiKeyInput = document.getElementById('stt-api-key');
    const sttModelInput = document.getElementById('stt-model');
    const ttsApiUrlInput = document.getElementById('tts-api-url');
    const ttsApiKeyInput = document.getElementById('tts-api-key');
    const ttsVoiceIdInput = document.getElementById('tts-voice-id');
    const ttsLanguageInput = document.getElementById('tts-language');
    const ttsSpeedInput = document.getElementById('tts-speed');
    const ttsTemperatureInput = document.getElementById('tts-temperature');
    const ttsModelIdInput = document.getElementById('tts-model-id');
    const saveSttConfigButton = document.getElementById('save-stt-config');
    const saveTtsConfigButton = document.getElementById('save-tts-config');
    const sttStatusIndicator = document.getElementById('stt-status');
    const ttsStatusIndicator = document.getElementById('tts-status');
    const autoLlmConfigButton = document.getElementById('auto-llm-config');
    const testSttButton = document.getElementById('test-stt');
    const audioLogList = document.getElementById('audio-log-list');
    const textMessageInput = document.getElementById('text-message');
    const sendButton = document.getElementById('send-button');
    const testTtsButton = document.getElementById('test-tts');
    const sttModeDiv = document.getElementById('stt-mode');
    const ttsModeDiv = document.getElementById('tts-mode');
    const patientBar = document.getElementById('patient-bar');
    const clinicalPanel = document.getElementById('clinical-panel');
    const seguePanel = document.getElementById('segue-panel');
    const clinicalTabs = document.querySelector('.clinical-tabs');
    const tabClinical = document.getElementById('tab-clinical');
    const tabSegue = document.getElementById('tab-segue');
    const panelClinical = document.getElementById('panel-clinical');
    const panelSegue = document.getElementById('panel-segue');

    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.hidden = false;
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.hidden = true;
    }

    if (menuButton) menuButton.addEventListener('click', () => {
        if (sidebar?.classList.contains('open')) closeSidebar();
        else openSidebar();
    });
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => closeSidebar());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });
    if (tabClinical) tabClinical.addEventListener('click', () => setSideTab('clinical'));
    if (tabSegue) tabSegue.addEventListener('click', () => setSideTab('segue'));

    const sessionIdKey = 'medsim_session_id';
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = (urlParams.get('session_id') || '').trim();
    const encounterFromUrl = (urlParams.get('encounter_id') || '').trim();
    if (sessionFromUrl) localStorage.setItem(sessionIdKey, sessionFromUrl);

    const patientIdKey = 'medsim_patient_id';
    const interviewModeKey = 'medsim_interview_mode';
    const sessionId = (() => {
        const existing = localStorage.getItem(sessionIdKey);
        if (existing) return existing;
        const created = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
        localStorage.setItem(sessionIdKey, created);
        return created;
    })();

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

    let recordingStream = null;
    let recordingRecorder = null;
    let recordingContext = null;
    let recordingSource = null;
    let recordingProcessor = null;
    let audioChunks = [];
    let recordingSampleRate = 44100;
    let recognition = null;
    let lastRecognizedText = '';
    let lastTtsMode = null;
    let lastAudioHealthStatus = 'unconfigured';
    let backendLlmState = null;
    let backendAudioState = null;
    let audioLogs = [];
    let lastSttTestStatus = null; // 'ok' | 'error' | null
    let lastTtsTestStatus = null; // 'ok' | 'error' | null
    let isRecording = false;
    let sttFinalText = '';
    let cancelRecording = false;
    let speechRecognitionActive = false;
    let dictationSeedText = '';

    // Patient selector container (near chat)
    const patientContainer = document.createElement('div');
    patientContainer.className = 'patient-row';
    patientContainer.innerHTML = `
        <label for="patient-select">Paciente:</label>
        <select id="patient-select" class="model-select"></select>
        <label for="interview-mode-select">Modo:</label>
        <select id="interview-mode-select" class="mode-select">
            <option value="free">Libre</option>
            <option value="segue">SEGUE</option>
        </select>
        <button id="reload-patients" class="config-button" type="button">Reload</button>
        <button id="finish-encounter" class="config-button finish-button" type="button">Finalizar</button>
    `;
    patientBar?.appendChild(patientContainer);


    // Get the elements after they're created
    const patientSelect = document.getElementById('patient-select');
    const interviewModeSelect = document.getElementById('interview-mode-select');
    const reloadPatientsButton = document.getElementById('reload-patients');
    const finishEncounterButton = document.getElementById('finish-encounter');
    const modelSelect = null;
    const apiUrlInput = document.getElementById('api-url');
    const saveConfigButton = document.getElementById('save-config');
    const apiStatusIndicator = document.getElementById('api-status');
    const llmUrlOptions = document.getElementById('llm-url-options');
    const segueBody = document.getElementById('segue-body');

    let chatLocked = false;
    let encounterClosed = false;
    let encounterWs = null;
    let lastProviderValue = llmProviderSelect?.value || 'custom';
    let currentInterviewMode = localStorage.getItem(interviewModeKey) || 'free';
    let currentSegueChecklist = [];
    const audioNotImplementedMessage = 'Audio no configurado';

    function setChatLocked(locked) {
        chatLocked = !!locked;
        if (modelSelect) modelSelect.disabled = chatLocked;
        if (llmProviderSelect) llmProviderSelect.disabled = chatLocked;
        if (apiUrlInput) apiUrlInput.disabled = chatLocked;
        if (apiKeyInput) apiKeyInput.disabled = chatLocked;
        if (saveConfigButton) saveConfigButton.disabled = chatLocked;
        if (autoLlmConfigButton) autoLlmConfigButton.disabled = chatLocked;
    }

    function applyProviderPreset(provider) {
        const p = (provider || '').toLowerCase();
        if (!apiUrlInput) return;

        if (p === 'ollama') {
            apiUrlInput.value = 'http://127.0.0.1:11434';
            if (apiKeyInput) apiKeyInput.placeholder = 'API Key (opcional)';
        } else if (p === 'gemini') {
            apiUrlInput.value = 'https://generativelanguage.googleapis.com/v1beta/openai';
            if (apiKeyInput) apiKeyInput.placeholder = 'Gemini API Key';
        } else {
            if (apiKeyInput) apiKeyInput.placeholder = 'API Key';
        }
    }

    function setClinicalText(text) {
        if (!clinicalPanel) return;
        clinicalPanel.textContent = text;
    }

    function setSideTab(tab) {
        const target = tab === 'segue' ? 'segue' : 'clinical';
        if (tabClinical) {
            tabClinical.classList.toggle('active', target === 'clinical');
            tabClinical.setAttribute('aria-selected', String(target === 'clinical'));
        }
        if (tabSegue) {
            tabSegue.classList.toggle('active', target === 'segue');
            tabSegue.setAttribute('aria-selected', String(target === 'segue'));
        }
        if (panelClinical) {
            panelClinical.hidden = target !== 'clinical';
            panelClinical.classList.toggle('active', target === 'clinical');
        }
        if (panelSegue) {
            panelSegue.hidden = target !== 'segue';
            panelSegue.classList.toggle('active', target === 'segue');
        }
    }

    function updateSegueVisibility() {
        const segueEnabled = currentInterviewMode === 'segue';
        if (tabSegue) {
            tabSegue.hidden = !segueEnabled;
        }
        if (panelSegue && !segueEnabled) {
            panelSegue.hidden = true;
            panelSegue.classList.remove('active');
        }
        if (clinicalTabs) {
            clinicalTabs.classList.toggle('segue-hidden', !segueEnabled);
        }
        if (!segueEnabled) {
            setSideTab('clinical');
        }
    }

    function createSegueChecklistState() {
        return segueCriteria.map((criterion) => ({
            id: criterion.id,
            area: criterion.area,
            label: criterion.label,
            done: false,
        }));
    }

    function getSegueStorageKey() {
        const encounterKey = currentEncounterId || patientSelect?.value || 'no-patient';
        return `medsim_segue_manual_${encounterKey}`;
    }

    function saveSegueChecklistState() {
        try {
            localStorage.setItem(getSegueStorageKey(), JSON.stringify(currentSegueChecklist));
        } catch (error) {
            console.warn('Failed to save SEGUE checklist state:', error);
        }
    }

    function loadSegueChecklistState(reset = false) {
        if (reset) {
            currentSegueChecklist = createSegueChecklistState();
            saveSegueChecklistState();
            return;
        }

        try {
            const raw = localStorage.getItem(getSegueStorageKey());
            const stored = raw ? JSON.parse(raw) : [];
            const storedMap = new Map(Array.isArray(stored) ? stored.map((item) => [String(item.id), !!item.done]) : []);
            currentSegueChecklist = segueCriteria.map((criterion) => ({
                id: criterion.id,
                area: criterion.area,
                label: criterion.label,
                done: storedMap.get(criterion.id) || false,
            }));
        } catch (error) {
            console.warn('Failed to load SEGUE checklist state:', error);
            currentSegueChecklist = createSegueChecklistState();
        }
    }

    function completedSegueCount() {
        return currentSegueChecklist.filter((item) => item.done).length;
    }

    function renderSegueChecklist(items, enabled) {
        const groups = new Map();
        for (const item of items) {
            if (!groups.has(item.area)) groups.set(item.area, []);
            groups.get(item.area).push(item);
        }
        return Array.from(groups.entries()).map(([area, areaItems]) => `
            <section class="segue-section">
                <div class="segue-section-title">${escapeHtml(area)}</div>
                <div class="segue-table">
                    <div class="segue-table-head">Item</div>
                    <div class="segue-table-head">Estado</div>
                    ${areaItems.map((item) => `
                        <div class="segue-item-label"><strong>${escapeHtml(item.id)}.</strong> ${escapeHtml(item.label)}</div>
                        <label class="segue-item-check ${item.done ? 'is-done' : ''}">
                            <input
                                type="checkbox"
                                class="segue-checkbox"
                                data-segue-id="${escapeHtml(item.id)}"
                                ${item.done ? 'checked' : ''}
                                ${enabled ? '' : 'disabled'}
                            />
                            <span>${item.done ? 'Listo' : 'Pendiente'}</span>
                        </label>
                    `).join('')}
                </div>
            </section>
        `).join('');
    }

    function attachSegueChecklistEvents(enabled) {
        if (!segueBody || !enabled) return;
        segueBody.querySelectorAll('.segue-checkbox').forEach((checkbox) => {
            checkbox.addEventListener('change', (event) => {
                const target = event.currentTarget;
                const itemId = String(target?.getAttribute('data-segue-id') || '');
                currentSegueChecklist = currentSegueChecklist.map((item) => (
                    item.id === itemId ? { ...item, done: !!target.checked } : item
                ));
                saveSegueChecklistState();
                renderSegueFeedback();
            });
        });
    }

    function setSegueInactive(message = 'Activa el modo SEGUE para usar la checklist manual.') {
        if (seguePanel) seguePanel.className = 'segue-panel segue-panel-inactive';
        if (segueBody) {
            segueBody.innerHTML = `
                <div class="segue-next">${escapeHtml(message)}</div>
                <div class="segue-manual-summary">Items completos: ${completedSegueCount()} / ${currentSegueChecklist.length}</div>
                ${renderSegueChecklist(currentSegueChecklist, false)}
            `;
        }
    }

    function renderSegueFeedback() {
        if (!seguePanel || !segueBody) return;
        if (currentInterviewMode !== 'segue') {
            setSegueInactive();
            return;
        }

        seguePanel.className = 'segue-panel segue-panel-active';
        segueBody.innerHTML = `
            <div class="segue-next">Checklist manual SEGUE. Marca cada punto cuando ya lo hayas cubierto en la conversacion.</div>
            <div class="segue-manual-summary">Items completos: ${completedSegueCount()} / ${currentSegueChecklist.length}</div>
            ${renderSegueChecklist(currentSegueChecklist, true)}
        `;
        attachSegueChecklistEvents(true);
    }

    function renderClinical(patient) {
        if (!clinicalPanel) return;
        clinicalPanel.innerHTML = '';

        if (!patient) {
            setClinicalText('Elegi un paciente para ver sus datos clinicos.');
            return;
        }

        const header = document.createElement('div');
        header.className = 'clinical-header';
        header.textContent = `${patient.name} (${patient.age})${patient.region ? ` - ${patient.region}` : ''}`;
        clinicalPanel.appendChild(header);

        const hint = document.createElement('div');
        hint.className = 'clinical-hint';
        hint.textContent = 'La idea es descubrir sintomas/antecedentes conversando. Abrir secciones marcadas como "spoiler" te adelanta informacion.';
        clinicalPanel.appendChild(hint);

        function addVisibleBlock(title, valueEl) {
            const block = document.createElement('div');
            block.className = 'clinical-visible';

            const t = document.createElement('div');
            t.className = 'clinical-label';
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

        // Visible: admin + triage + institutional record + recent studies (what the doctor "sees" in the system)
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
        if (labs.length || imaging.length) {
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
            addVisibleBlock('Estudios recientes (sistema)', wrap);
        }

        function makeSpoilerSection(title, contentEl) {
            const details = document.createElement('details');
            details.className = 'spoiler';

            const summary = document.createElement('summary');
            summary.className = 'spoiler-summary';
            summary.textContent = title;
            details.appendChild(summary);

            const body = document.createElement('div');
            body.className = 'spoiler-body';
            body.appendChild(contentEl);
            details.appendChild(body);

            summary.addEventListener('click', (e) => {
                if (details.open) return; // allow closing without warning
                e.preventDefault();
                const ok = window.confirm('Esta informacion esta pensada para descubrirla conversando con el paciente.\n\nQueres verla igual?');
                if (ok) details.open = true;
            });

            return details;
        }

        const feels = patient.what_they_feel || '';
        if (feels) {
            const p = document.createElement('div');
            p.className = 'clinical-block';
            const t = document.createElement('div');
            t.className = 'clinical-label';
            t.textContent = 'Lo que siente';
            const v = document.createElement('div');
            v.textContent = feels;
            p.appendChild(t);
            p.appendChild(v);
            clinicalPanel.appendChild(makeSpoilerSection('Lo que siente (spoiler)', p));
        }

        const symptoms = Array.isArray(patient.symptoms_reported) ? patient.symptoms_reported : [];
        if (symptoms.length) {
            const p = document.createElement('div');
            p.className = 'clinical-block';
            const t = document.createElement('div');
            t.className = 'clinical-label';
            t.textContent = 'Sintomas reportados';
            const ul = document.createElement('ul');
            ul.className = 'clinical-list';
            for (const s of symptoms) {
                const li = document.createElement('li');
                li.textContent = s;
                ul.appendChild(li);
            }
            p.appendChild(t);
            p.appendChild(ul);
            clinicalPanel.appendChild(makeSpoilerSection('Sintomas reportados (spoiler)', p));
        }

        const history = patient.known_medical_history && typeof patient.known_medical_history === 'object' ? patient.known_medical_history : null;
        if (history) {
            const p = document.createElement('div');
            p.className = 'clinical-block';
            const t = document.createElement('div');
            t.className = 'clinical-label';
            t.textContent = 'Antecedentes (lo que el paciente sabe)';
            const dl = document.createElement('dl');
            dl.className = 'clinical-dl';
            for (const [k, v] of Object.entries(history)) {
                const dt = document.createElement('dt');
                dt.textContent = k.replace(/_/g, ' ');
                const dd = document.createElement('dd');
                dd.textContent = String(v);
                dl.appendChild(dt);
                dl.appendChild(dd);
            }
            p.appendChild(t);
            p.appendChild(dl);
            clinicalPanel.appendChild(makeSpoilerSection('Antecedentes (lo que el paciente dice) (spoiler)', p));
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
            if (!resp.ok) throw new Error(`patient (${resp.status})`);
            const data = await resp.json();
            const patient = data?.patient || data;
            renderClinical(patient);
        } catch (e) {
            console.error('Failed to load patient details:', e);
            setClinicalText('Error cargando ficha clinica.');
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
            const m = (enc.mode || 'free').trim();
            currentInterviewMode = m;
            localStorage.setItem(interviewModeKey, currentInterviewMode);
            if (interviewModeSelect) interviewModeSelect.value = currentInterviewMode;
            updateSegueVisibility();
            loadSegueChecklistState(true);
            if (currentInterviewMode !== 'segue') setSegueInactive();
            else { renderSegueFeedback(); setSideTab('segue'); }
            if (pid) {
                if (patientSelect) {
                    patientSelect.value = pid;
                    localStorage.setItem(patientIdKey, pid);
                }
                await loadClinical(pid);
            }
            if (patientSelect) patientSelect.disabled = true;
            if (interviewModeSelect) interviewModeSelect.disabled = true;
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
            loadSegueChecklistState(true);
            setSegueInactive();
            return;
        }
        setChatLocked(false);
        try {
            statusDiv.textContent = 'Iniciando consulta...';
            const resp = await fetch('/api/encounters/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
                body: JSON.stringify({ patient_id: patientId, mode: currentInterviewMode }),
            });
            if (!resp.ok) throw new Error(`encounter start (${resp.status})`);
            const data = await resp.json();
            currentEncounterId = data.encounter_id;
            connectEncounterWs(currentEncounterId);
            loadSegueChecklistState(true);
            messagesContainer.innerHTML = '';
            statusDiv.textContent = 'Consulta iniciada';
            renderSegueFeedback();
            setChatLocked(false);
        } catch (e) {
            console.error('Failed to start encounter:', e);
            currentEncounterId = null;
            loadSegueChecklistState(true);
            statusDiv.textContent = 'Error iniciando consulta';
            setSegueInactive('No se pudo iniciar la checklist SEGUE.');
            setChatLocked(false);
        }
    }

    function isMissingEncounterResponse(status, detail) {
        if (status !== 404) return false;
        const text = String(detail || '').toLowerCase();
        return text.includes('encounter not found') || text.includes('not found');
    }

    function isFinishedEncounterResponse(status, detail) {
        if (status !== 409) return false;
        const text = String(detail || '').toLowerCase();
        return text.includes('encounter finished') || text.includes('finished');
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
                renderSegueFeedback();
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

            if (interviewModeSelect) {
                interviewModeSelect.value = currentInterviewMode;
                interviewModeSelect.onchange = async () => {
                    currentInterviewMode = interviewModeSelect.value || 'free';
                    localStorage.setItem(interviewModeKey, currentInterviewMode);
                    if (currentInterviewMode !== 'segue') {
                        setSegueInactive();
                    } else {
                        loadSegueChecklistState();
                        renderSegueFeedback();
                    }
                    updateSegueVisibility();
                    if (currentInterviewMode === 'segue') {
                        setSideTab('segue');
                    }
                    if (patientSelect.value) {
                        await startEncounter(patientSelect.value);
                    }
                };
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
                await loadClinical(initial);
            } else {
                renderClinical(null);
            }

            patientSelect.onchange = () => {
                const chosen = patientSelect.value;
                localStorage.setItem(patientIdKey, chosen);
                startEncounter(chosen);
                loadClinical(chosen);
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

    if (interviewModeSelect) {
        interviewModeSelect.value = currentInterviewMode;
    }
    updateSegueVisibility();
    loadSegueChecklistState();
    if (currentInterviewMode !== 'segue') {
        setSegueInactive();
    } else {
        renderSegueFeedback();
        setSideTab('segue');
    }

    // Load saved API configuration
    const savedApiKey = localStorage.getItem('llm_api_key') || localStorage.getItem('openai_api_key');
    const savedApiUrl = localStorage.getItem('llm_api_url') || localStorage.getItem('openai_api_url');
    if (savedApiKey) apiKeyInput.value = savedApiKey;
    if (savedApiUrl) apiUrlInput.value = savedApiUrl;
    const savedSttApiUrl = localStorage.getItem('stt_api_url');
    const savedSttApiKey = localStorage.getItem('stt_api_key');
    const savedSttModel = localStorage.getItem('stt_model') || localStorage.getItem('gemini_model');
    const savedTtsApiUrl = localStorage.getItem('tts_api_url');
    const savedTtsApiKey = localStorage.getItem('tts_api_key') || localStorage.getItem('elevenlabs_api_key');
    const savedTtsVoiceId = localStorage.getItem('tts_voice_id') || localStorage.getItem('elevenlabs_voice_id');
    const savedTtsModelId = localStorage.getItem('tts_model_id') || localStorage.getItem('elevenlabs_model_id');
    const savedTtsLanguage = localStorage.getItem('tts_language') || 'es-AR';
    const savedTtsSpeed = localStorage.getItem('tts_speed') || '0.92';
    const savedTtsTemperature = localStorage.getItem('tts_temperature') || '0.35';
    if (savedSttApiUrl && sttApiUrlInput) sttApiUrlInput.value = savedSttApiUrl;
    if (savedSttApiKey && sttApiKeyInput) sttApiKeyInput.value = savedSttApiKey;
    if (savedSttModel && sttModelInput) sttModelInput.value = savedSttModel;
    if (savedTtsApiUrl && ttsApiUrlInput) ttsApiUrlInput.value = savedTtsApiUrl;
    if (savedTtsApiKey && ttsApiKeyInput) ttsApiKeyInput.value = savedTtsApiKey;
    if (savedTtsVoiceId && ttsVoiceIdInput) ttsVoiceIdInput.value = savedTtsVoiceId;
    if (savedTtsModelId && ttsModelIdInput) ttsModelIdInput.value = savedTtsModelId;
    if (ttsLanguageInput) ttsLanguageInput.value = savedTtsLanguage;
    if (ttsSpeedInput) ttsSpeedInput.value = savedTtsSpeed;
    if (ttsTemperatureInput) ttsTemperatureInput.value = savedTtsTemperature;

    // Presets: default to Groq STT + Cartesia TTS when fields are empty.
    if (sttApiUrlInput && !sttApiUrlInput.value.trim()) sttApiUrlInput.value = 'https://api.groq.com/openai/v1';
    if (sttModelInput && !sttModelInput.value.trim()) sttModelInput.value = 'whisper-large-v3';
    if (ttsApiUrlInput && !ttsApiUrlInput.value.trim()) ttsApiUrlInput.value = 'https://api.cartesia.ai';
    if (ttsModelIdInput && !ttsModelIdInput.value.trim()) ttsModelIdInput.value = 'sonic';
    if (ttsLanguageInput && !ttsLanguageInput.value.trim()) ttsLanguageInput.value = 'es-AR';
    if (ttsSpeedInput && !ttsSpeedInput.value.trim()) ttsSpeedInput.value = '0.92';
    if (ttsTemperatureInput && !ttsTemperatureInput.value.trim()) ttsTemperatureInput.value = '0.35';

    const inferProviderFromUrl = (url) => {
        const u = String(url || '').toLowerCase();
        if (u.includes('generativelanguage.googleapis.com')) return 'gemini';
        if (u.includes(':11434')) return 'ollama';
        return 'custom';
    };

    if (llmProviderSelect) {
        const inferred = inferProviderFromUrl(savedApiUrl || apiUrlInput.value);
        llmProviderSelect.value = inferred;
        lastProviderValue = inferred;
        if (!savedApiUrl) applyProviderPreset(inferred);

        llmProviderSelect.addEventListener('change', () => {
            if (chatLocked) {
                llmProviderSelect.value = lastProviderValue;
                statusDiv.textContent = 'No podes cambiar el proveedor con una charla en curso';
                return;
            }
            lastProviderValue = llmProviderSelect.value || 'custom';
            applyProviderPreset(lastProviderValue);
        });
    }

    const savedAudioEnabled = localStorage.getItem('audio_enabled') === 'true';
    if (audioToggle) {
        audioToggle.checked = savedAudioEnabled;
    }

    function getAudioConfigValues() {
        return {
            sttApiUrl: (sttApiUrlInput?.value || '').trim(),
            sttApiKey: (sttApiKeyInput?.value || '').trim(),
            sttModel: (sttModelInput?.value || '').trim(),
            ttsApiUrl: (ttsApiUrlInput?.value || '').trim(),
            ttsApiKey: (ttsApiKeyInput?.value || '').trim(),
            ttsVoiceId: (ttsVoiceIdInput?.value || '').trim(),
            ttsLanguage: (ttsLanguageInput?.value || '').trim(),
            ttsSpeed: (ttsSpeedInput?.value || '').trim(),
            ttsTemperature: (ttsTemperatureInput?.value || '').trim(),
            ttsModelId: (ttsModelIdInput?.value || '').trim(),
        };
    }

    function looksLikeUrl(value) {
        const text = String(value || '').trim().toLowerCase();
        return text.startsWith('http://') || text.startsWith('https://');
    }

    function nowTimeLabel() {
        return new Date().toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    function renderAudioLogs() {
        if (!audioLogList) return;
        audioLogList.innerHTML = '';
        if (!audioLogs.length) {
            const empty = document.createElement('div');
            empty.className = 'audio-log-entry';
            empty.innerHTML = '<span class="audio-log-time">--:--:--</span><span class="audio-log-source">INFO</span><span class="audio-log-message">Sin eventos de audio todavia.</span>';
            audioLogList.appendChild(empty);
            return;
        }
        for (const entry of audioLogs) {
            const row = document.createElement('div');
            row.className = `audio-log-entry ${entry.level || 'warn'}`;

            const time = document.createElement('span');
            time.className = 'audio-log-time';
            time.textContent = entry.time;

            const source = document.createElement('span');
            source.className = 'audio-log-source';
            source.textContent = entry.source;

            const message = document.createElement('span');
            message.className = 'audio-log-message';
            message.textContent = entry.message;

            row.appendChild(time);
            row.appendChild(source);
            row.appendChild(message);
            audioLogList.appendChild(row);
        }
    }

    function pushAudioLog(source, message, level = 'warn') {
        audioLogs = [
            {
                time: nowTimeLabel(),
                source: String(source || 'AUDIO').toUpperCase(),
                message: String(message || '').trim() || 'Sin detalle',
                level,
            },
            ...audioLogs,
        ].slice(0, 12);
        renderAudioLogs();
    }

    function summarizeProviderHealth(providerName, payload) {
        if (!payload) return `${providerName}: sin datos`;
        const status = String(payload.status || 'unknown');
        const note = payload.note || payload.error || payload.detail || '';
        const model = payload.model || payload.model_id || '';
        const code = payload.provider_status_code ? ` (HTTP ${payload.provider_status_code})` : '';
        return `${providerName}: ${status}${model ? ` [${model}]` : ''}${code}${note ? ` - ${note}` : ''}`;
    }

    function hasBackendAudioConfig() {
        const sttConfigured = !!backendAudioState?.stt_configured;
        const ttsConfigured = !!backendAudioState?.tts_configured;
        return Boolean(sttConfigured || ttsConfigured);
    }

    function hasAudioConfig() {
        const values = getAudioConfigValues();
        const sttOk = Boolean(values.sttModel && values.sttApiKey && values.sttApiUrl);
        const ttsOk = Boolean(values.ttsVoiceId && values.ttsModelId && values.ttsApiKey && values.ttsApiUrl);
        return sttOk || ttsOk || hasBackendAudioConfig();
    }

    function hasSttConfig() {
        const values = getAudioConfigValues();
        return Boolean(values.sttModel && values.sttApiKey && values.sttApiUrl);
    }

    function hasTtsConfig() {
        const values = getAudioConfigValues();
        return Boolean(values.ttsVoiceId && values.ttsModelId && values.ttsApiKey && values.ttsApiUrl);
    }

    function getAudioIssueMessage(audioHealth = null) {
        const stt = audioHealth?.stt || null;
        const tts = audioHealth?.tts || null;
        const sttIssue = stt?.note || stt?.detail || stt?.error || '';
        const ttsIssue = tts?.note || tts?.detail || tts?.error || '';
        if (sttIssue && ttsIssue) return `STT: ${sttIssue} | TTS: ${ttsIssue}`;
        if (sttIssue) return `STT: ${sttIssue}`;
        if (ttsIssue) return `TTS: ${ttsIssue}`;
        return 'Audio no configurado';
    }

    // Load patients early so chat can be tied to a profile
    loadPatients();

    function applyAudioModeUI() {
        const enabled = !!audioToggle?.checked;
        const configured = hasAudioConfig();
        const sttConfigured = hasSttConfig() || !!backendAudioState?.stt_configured;
        const ttsConfigured = hasTtsConfig() || !!backendAudioState?.tts_configured;
        if (saveSttConfigButton) saveSttConfigButton.disabled = false;
        if (saveTtsConfigButton) saveTtsConfigButton.disabled = false;
        if (testSttButton) testSttButton.disabled = !enabled || !sttConfigured;
        if (testTtsButton) testTtsButton.disabled = !ttsConfigured;
        if (micButton) micButton.disabled = !enabled || !sttConfigured;
        if (micHint) {
            micHint.textContent = !enabled
                ? 'Microfono: audio desactivado'
                : sttConfigured
                    ? 'Microfono: listo'
                    : 'Microfono: configura STT via API';
        }
        if (sttModeDiv) {
            sttModeDiv.classList.remove('backend', 'browser', 'error');
            sttModeDiv.classList.add(sttConfigured ? 'backend' : 'error');
            sttModeDiv.textContent = sttConfigured ? 'STT: configurado' : 'STT: no configurado';
        }
        if (ttsModeDiv) {
            ttsModeDiv.classList.remove('backend', 'browser', 'error');
            ttsModeDiv.classList.add(ttsConfigured ? 'backend' : 'error');
            ttsModeDiv.textContent = ttsConfigured ? 'TTS: configurado' : 'TTS: no configurado';
        }
        if (sttStatusIndicator) {
            sttStatusIndicator.className = 'status-indicator';
            if (lastSttTestStatus === 'ok') sttStatusIndicator.classList.add('active');
            else if (lastSttTestStatus === 'error') sttStatusIndicator.classList.add('error');
        }
        if (ttsStatusIndicator) {
            ttsStatusIndicator.className = 'status-indicator';
            if (lastTtsTestStatus === 'ok') ttsStatusIndicator.classList.add('active');
            else if (lastTtsTestStatus === 'error') ttsStatusIndicator.classList.add('error');
        }
    }

    audioToggle.addEventListener('change', () => {
        localStorage.setItem('audio_enabled', audioToggle.checked ? 'true' : 'false');
        applyAudioModeUI();
        statusDiv.textContent = audioToggle.checked ? 'Audio activado' : 'Audio desactivado';
    });

    [
        sttApiUrlInput,
        sttApiKeyInput,
        sttModelInput,
        ttsApiUrlInput,
        ttsApiKeyInput,
        ttsVoiceIdInput,
        ttsLanguageInput,
        ttsSpeedInput,
        ttsTemperatureInput,
        ttsModelIdInput,
    ].forEach((input) => {
        input?.addEventListener('input', () => {
            lastAudioHealthStatus = 'dirty';
            applyAudioModeUI();
        });
    });

    saveSttConfigButton?.addEventListener('click', async () => {
        const values = getAudioConfigValues();
        try {
            if (looksLikeUrl(values.sttModel)) {
                throw new Error('En STT model tenes que poner un modelo (ej. whisper-1), no una URL');
            }
            const formData = new FormData();
            formData.append('stt_api_url', values.sttApiUrl);
            formData.append('stt_api_key', values.sttApiKey);
            formData.append('stt_model', values.sttModel);
            const response = await fetch('/api/stt_config', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(extractErrorMessage(detail, 'Failed to update audio configuration'));
            }
            localStorage.setItem('stt_api_url', values.sttApiUrl);
            localStorage.setItem('stt_api_key', values.sttApiKey);
            localStorage.setItem('stt_model', values.sttModel);
            backendAudioState = {
                ...(backendAudioState || {}),
                stt_api_url: values.sttApiUrl,
                stt_api_key_configured: Boolean(values.sttApiKey),
                stt_model: values.sttModel,
                stt_configured: Boolean(values.sttModel),
            };
            pushAudioLog('CONFIG', `Guardado STT. model=${values.sttModel || '-'} url=${values.sttApiUrl || '-'}`, 'ok');
            lastSttTestStatus = null;
            statusDiv.textContent = 'Configuracion de STT guardada';
        } catch (error) {
            console.error('Failed to save audio configuration:', error);
            statusDiv.textContent = `Error audio: ${error.message}`;
            if (sttStatusIndicator) sttStatusIndicator.classList.add('error');
            pushAudioLog('CONFIG', error.message, 'error');
        }
        applyAudioModeUI();
    });

    saveTtsConfigButton?.addEventListener('click', async () => {
        const values = getAudioConfigValues();
        try {
            const formData = new FormData();
            formData.append('tts_api_url', values.ttsApiUrl);
            formData.append('tts_api_key', values.ttsApiKey);
            formData.append('tts_voice_id', values.ttsVoiceId);
            formData.append('tts_model_id', values.ttsModelId);
            formData.append('tts_language', values.ttsLanguage);
            formData.append('tts_speed', values.ttsSpeed);
            formData.append('tts_temperature', values.ttsTemperature);
            const response = await fetch('/api/tts_config', { method: 'POST', body: formData });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(extractErrorMessage(detail, 'Failed to update TTS configuration'));
            }
            localStorage.setItem('tts_api_url', values.ttsApiUrl);
            localStorage.setItem('tts_api_key', values.ttsApiKey);
            localStorage.setItem('tts_voice_id', values.ttsVoiceId);
            localStorage.setItem('tts_model_id', values.ttsModelId);
            localStorage.setItem('tts_language', values.ttsLanguage || 'es-AR');
            if (values.ttsSpeed) localStorage.setItem('tts_speed', values.ttsSpeed);
            if (values.ttsTemperature) localStorage.setItem('tts_temperature', values.ttsTemperature);
            backendAudioState = {
                ...(backendAudioState || {}),
                tts_api_url: values.ttsApiUrl,
                tts_api_key_configured: Boolean(values.ttsApiKey),
                tts_voice_id: values.ttsVoiceId,
                tts_model_id: values.ttsModelId,
                tts_language: values.ttsLanguage || 'es-AR',
                tts_configured: Boolean(values.ttsApiKey && values.ttsVoiceId && values.ttsModelId),
            };
            pushAudioLog('CONFIG', `Guardado TTS. model=${values.ttsModelId || '-'} voice=${values.ttsVoiceId || '-'} lang=${values.ttsLanguage || 'es-AR'} speed=${values.ttsSpeed || '-'} temp=${values.ttsTemperature || '-'} url=${values.ttsApiUrl || '-'}`, 'ok');
            lastTtsTestStatus = null;
            statusDiv.textContent = 'Configuracion de TTS guardada';
        } catch (error) {
            statusDiv.textContent = `Error TTS: ${error.message}`;
            if (ttsStatusIndicator) ttsStatusIndicator.classList.add('error');
            pushAudioLog('TTS', error.message, 'error');
        }
        applyAudioModeUI();
    });

    async function autoConfig(target) {
        const formData = new FormData();
        formData.append('target', target);
        if (target === 'llm') {
            const apiKey = (apiKeyInput?.value || '').trim();
            if (apiKey) formData.append('api_key', apiKey);
        }
        const response = await fetch('/api/auto_config', { method: 'POST', body: formData });
        if (!response.ok) {
            throw new Error('Auto config failed');
        }
        return await response.json();
    }

    autoLlmConfigButton.addEventListener('click', async () => {
        try {
            const result = await autoConfig('llm');
            if (result.llm && result.llm.chosen_url) {
                apiUrlInput.value = result.llm.chosen_url;
                localStorage.setItem('llm_api_url', result.llm.chosen_url);
                localStorage.removeItem('openai_api_url');
                const apiKey = (apiKeyInput?.value || '').trim();
                if (apiKey) {
                    localStorage.setItem('llm_api_key', apiKey);
                    localStorage.removeItem('openai_api_key');
                }
            }
            await checkApiHealth();
            await checkAudioHealth();
            await updateModelsList();
        } catch (e) {
            console.error('Auto LLM failed:', e);
            apiStatusIndicator.classList.add('error');
        }
    });

    testSttButton?.addEventListener('click', async () => {
        try {
            if (!audioToggle?.checked) {
                throw new Error('Activa audio bidireccional para probar STT');
            }
            if (!hasSttConfig()) {
                throw new Error('Configura STT (api_url, api_key, model)');
            }
            // Quick connectivity smoke test: send a short silent WAV to STT.
            const sampleRate = 44100;
            const seconds = 0.7;
            const samples = Math.max(1, Math.floor(sampleRate * seconds));
            const silent = new Float32Array(samples);
            const wav = encodeWavBlob([silent], sampleRate);
            const formData = new FormData();
            formData.append('file', wav, 'silence.wav');
            const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(extractErrorMessage(detail, 'STT test failed'));
            }
            const payload = await response.json();
            const text = String(payload?.text || '').trim();
            pushAudioLog('STT', `Test STT OK${text ? `: \"${text}\"` : ''}`, 'ok');
            lastSttTestStatus = 'ok';
        } catch (e) {
            pushAudioLog('STT', `Test STT fallo: ${e.message}`, 'error');
            lastSttTestStatus = 'error';
        } finally {
            applyAudioModeUI();
        }
    });

    // Save API configuration
    saveConfigButton.addEventListener('click', async () => {
        const apiUrl = apiUrlInput.value.trim();
        const apiKey = (apiKeyInput?.value || '').trim();

        try {
            // Update backend configuration
            const formData = new FormData();
            formData.append('api_url', apiUrl);
            if (apiKey) formData.append('api_key', apiKey);
            const response = await fetch('/api/config', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(extractErrorMessage(detail, 'Failed to update configuration'));
            }

            // Save to localStorage only after successful backend update
            if (apiUrl) {
                localStorage.setItem('llm_api_url', apiUrl);
                localStorage.removeItem('openai_api_url');
            } else {
                localStorage.removeItem('llm_api_url');
                localStorage.removeItem('openai_api_url');
            }

            if (apiKey) {
                localStorage.setItem('llm_api_key', apiKey);
                localStorage.removeItem('openai_api_key');
            } else {
                localStorage.removeItem('llm_api_key');
                localStorage.removeItem('openai_api_key');
            }

            backendLlmState = {
                ...(backendLlmState || {}),
                uses_gemini: inferProviderFromUrl(apiUrl) === 'gemini',
                api_key_configured: Boolean(apiKey),
            };
            await checkApiHealth();
            await checkAudioHealth();
            await updateModelsList();
        } catch (error) {
            console.error('Failed to save configuration:', error);
            apiStatusIndicator.classList.add('error');
            statusDiv.textContent = `Error LLM: ${error.message}`;
        }
    });

    // Check API health status
    async function checkApiHealth() {
        try {
            apiStatusIndicator.className = 'status-indicator';
            const response = await fetch('/api/llm_health');
            const data = await response.json();
            console.log('Health check response:', data);

            if (data.status === 'healthy' && data.models_available && data.models_count > 0) {
                apiStatusIndicator.classList.add('active');
                await updateModelsList();
            } else {
                apiStatusIndicator.classList.add('error');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            apiStatusIndicator.classList.add('error');
        } finally {
            applyAudioModeUI();
        }
    }

    function checkAudioHealth() {
        // Eliminado: los checks explicitos no aportan valor vs Save + Test.
        // El estado de STT/TTS se refleja via configuracion local y el ultimo Test.
        applyAudioModeUI();
    }

    // Add function to fetch and populate models
    async function updateModelsList() {
        return;
    }

    async function loadConfigState() {
        try {
            const response = await fetch('/api/config_state');
            if (!response.ok) return;
            const data = await response.json();
            backendLlmState = data?.llm || null;
            backendAudioState = data?.audio || null;
            if (data?.server?.schema_version) {
                pushAudioLog('SERVER', `schema_version=${data.server.schema_version}`, 'ok');
            }
            if (!savedApiUrl && data?.llm?.base_url) {
                apiUrlInput.value = data.llm.base_url;
            }
            if (llmProviderSelect) {
                const inferred = inferProviderFromUrl(savedApiUrl || data?.llm?.base_url || apiUrlInput.value);
                llmProviderSelect.value = inferred;
                lastProviderValue = inferred;
            }
            if (!savedSttApiUrl && data?.audio?.stt_api_url && sttApiUrlInput) sttApiUrlInput.value = data.audio.stt_api_url;
            if (!savedSttApiKey && sttApiKeyInput && data?.audio?.stt_api_key_configured) {
                // Don't pull secrets from backend; only signal configured.
                pushAudioLog('STT', 'API key configurada en backend (no se muestra)', 'warn');
            }
            if (!savedSttModel && data?.audio?.stt_model && sttModelInput) sttModelInput.value = data.audio.stt_model;
            if (!savedTtsApiUrl && data?.audio?.tts_api_url && ttsApiUrlInput) ttsApiUrlInput.value = data.audio.tts_api_url;
            if (!savedTtsApiKey && ttsApiKeyInput && data?.audio?.tts_api_key_configured) {
                pushAudioLog('TTS', 'API key configurada en backend (no se muestra)', 'warn');
            }
            if (!savedTtsVoiceId && data?.audio?.tts_voice_id && ttsVoiceIdInput) ttsVoiceIdInput.value = data.audio.tts_voice_id;
            if (!savedTtsModelId && data?.audio?.tts_model_id && ttsModelIdInput) ttsModelIdInput.value = data.audio.tts_model_id;
            if (!savedTtsLanguage && data?.audio?.tts_language && ttsLanguageInput) ttsLanguageInput.value = data.audio.tts_language;
            if (!savedTtsSpeed && data?.audio?.tts_speed != null && ttsSpeedInput) ttsSpeedInput.value = String(data.audio.tts_speed);
            if (!savedTtsTemperature && data?.audio?.tts_temperature != null && ttsTemperatureInput) ttsTemperatureInput.value = String(data.audio.tts_temperature);
            applyAudioModeUI();
        } catch (e) {
            console.error('Failed to load backend config state:', e);
        }
    }

    async function loadSuggestedUrls() {
        try {
            const response = await fetch('/api/suggested_urls');
            if (!response.ok) return;
            const data = await response.json();

            llmUrlOptions.innerHTML = '';
            (data.llm_base_urls || []).forEach(item => {
                const option = document.createElement('option');
                option.value = item.url;
                option.label = item.label ? `${item.label} (${item.url})` : item.url;
                llmUrlOptions.appendChild(option);
            });
            if (!savedSttModel && data?.audio_defaults?.stt_model && sttModelInput) sttModelInput.value = data.audio_defaults.stt_model;
            if (!savedTtsModelId && data?.audio_defaults?.tts_model_id && ttsModelIdInput) ttsModelIdInput.value = data.audio_defaults.tts_model_id;
            applyAudioModeUI();

        } catch (e) {
            console.error('Failed to load suggested URLs:', e);
        }
    }

    // Initial load
    loadConfigState();
    loadSuggestedUrls();
    checkApiHealth();
    setInterval(checkApiHealth, 30000);

    messagesContainer.innerHTML = '';

    function floatTo16BitPCM(float32Array) {
        const pcm = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i += 1) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return pcm;
    }

    function mergeAudioChunks(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        return merged;
    }

    function encodeWavBlob(chunks, sampleRate) {
        const audioData = mergeAudioChunks(chunks);
        const pcmData = floatTo16BitPCM(audioData);
        const buffer = new ArrayBuffer(44 + pcmData.length * 2);
        const view = new DataView(buffer);
        const writeString = (offset, value) => {
            for (let i = 0; i < value.length; i += 1) {
                view.setUint8(offset + i, value.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcmData.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, pcmData.length * 2, true);

        let offset = 44;
        for (const sample of pcmData) {
            view.setInt16(offset, sample, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

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
                playAudioFromUrl(objectUrl, messageDiv, true);
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

        if (role === 'assistant' && false) {
            const speakBtn = document.createElement('button');
            speakBtn.className = 'speak-button';
            speakBtn.type = 'button';
            speakBtn.title = 'Leer en voz alta';
            speakBtn.innerHTML = `
                <svg class="speak-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 10v4c0 .55.45 1 1 1h3l4 4c.63.63 1.71.18 1.71-.71V5.71c0-.89-1.08-1.34-1.71-.71l-4 4H4c-.55 0-1 .45-1 1z"></path>
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"></path>
                    <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path>
                </svg>
            `.trim();
            speakBtn.addEventListener('click', async () => {
                if (speakBtn.disabled) return;
                speakBtn.disabled = true;
                speakBtn.classList.add('loading');
                speakBtn.setAttribute('aria-busy', 'true');
                try {
                    await speakText(text);
                } finally {
                    speakBtn.disabled = false;
                    speakBtn.classList.remove('loading');
                    speakBtn.removeAttribute('aria-busy');
                }
            });
            rowDiv.appendChild(speakBtn);
        }

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
                    addUserTurn(content, null, m?.tts || null, { message_id: mid });
                } else if (role === 'assistant') {
                    addAssistantTurn(content, null, m?.tts || null, false, { message_id: mid, role: 'assistant' });
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

    function setTtsMode(mode, message) {
        lastTtsMode = mode || null;
        if (!ttsModeDiv) return;
        ttsModeDiv.classList.remove('backend', 'browser', 'error');
        ttsModeDiv.classList.add(mode || 'error');
        ttsModeDiv.textContent = message || 'Audio: Gemini STT + ElevenLabs activos';
    }

    let currentTtsAudio = null;
    let currentTtsMessageElement = null;
    let ttsInFlight = false;
    let lastSpokenText = '';
    let lastSpokenAt = 0;

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
                const statusBadge = messageElement.querySelector('.message-audio-status');
                if (statusBadge) statusBadge.textContent = 'Hablando';
            }
        };
        audio.onended = () => {
            if (revokeOnStop) {
                try { URL.revokeObjectURL(u); } catch {}
            }
            if (messageElement) {
                messageElement.classList.remove('playing');
                const statusBadge = messageElement.querySelector('.message-audio-status');
                if (statusBadge) statusBadge.textContent = 'Audio listo';
            }
            if (currentTtsMessageElement === messageElement) currentTtsMessageElement = null;
            if (currentTtsAudio === audio) currentTtsAudio = null;
        };
        currentTtsAudio = audio;
        audio.play().catch((error) => {
            console.warn('Audio playback failed:', error);
            if (messageElement) {
                messageElement.classList.remove('playing');
                const statusBadge = messageElement.querySelector('.message-audio-status');
                if (statusBadge) statusBadge.textContent = 'Audio con error';
            }
            setTtsMode('error', 'Audio: no se pudo reproducir');
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

        const messageId = metadata?.message_id || messageElement.dataset.messageId || '';
        const role = metadata?.role || messageElement.dataset.role || 'assistant';
        const payload = ttsPayload || {};

        if (payload.audio_url) {
            status.textContent = 'Audio listo';
            button.textContent = 'Repetir';
            button.addEventListener('click', () => {
                playAudioFromUrl(payload.audio_url, messageElement, false);
                setTtsMode('backend', 'Audio: reproduciendo');
            });
        } else if (payload.audio_base64) {
            status.textContent = 'Audio listo';
            button.textContent = 'Repetir';
            button.addEventListener('click', () => {
                playAudioFromBase64(payload.audio_base64, payload.content_type, messageElement);
                setTtsMode('backend', 'Audio: reproduciendo');
            });
        } else {
            // No audio attached to this message, and we intentionally do not generate new audio on demand.
            status.textContent = 'Sin audio';
            button.textContent = 'Sin audio';
            button.disabled = true;
        }

        meta.append(status, button);
        messageElement.appendChild(meta);
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
            if (payload.type === 'encounter_finished') {
                setEncounterClosed('Conversación finalizada');
                return;
            }
            if (payload.type === 'encounter_reopened') {
                setEncounterOpen('Conversación reabierta');
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
        if (ttsPayload?.audio_base64) messageDiv.classList.add('audio-linked');
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

        if (autoplay && ttsPayload?.audio_base64) {
            playAudioFromBase64(ttsPayload.audio_base64, ttsPayload.content_type, messageDiv);
            setTtsMode('backend', 'Audio: reproduciendo');
        }
        return messageDiv;
    }

    async function speakTextViaBackend(text) {
        if (!audioToggle?.checked) {
            setTtsMode('error', 'Audio: desactivado');
            return;
        }
        if (!hasAudioConfig()) {
            setTtsMode('error', 'Audio: usa Gemini en LLM y configura ElevenLabs');
            return;
        }
        if (ttsInFlight) return;
        ttsInFlight = true;
        try {
            const formData = new FormData();
            formData.append('text', text);
            if (patientSelect?.value) formData.append('patient_id', patientSelect.value);
            const response = await fetch('/api/tts', {
                method: 'POST',
                body: formData,
                headers: { 'X-Session-Id': sessionId }
            });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(extractErrorMessage(detail, 'TTS failed'));
            }
            const payload = await response.json();
            playAudioFromBase64(payload.audio_base64, payload.content_type);
            setTtsMode('backend', 'Audio: reproduciendo');
            statusDiv.textContent = 'Reproduciendo audio';
            lastTtsTestStatus = 'ok';
        } catch (error) {
            console.error('TTS error:', error);
            statusDiv.textContent = `Error: ${error.message}`;
            setTtsMode('error', 'Audio: error de sintesis');
            pushAudioLog('TTS', `Backend TTS fallo: ${error.message}`, 'error');
            lastTtsTestStatus = 'error';
        } finally {
            ttsInFlight = false;
            applyAudioModeUI();
        }
    }

    async function cacheTtsPayload(messageId, role, ttsPayload) {
        if (!messageId || !currentEncounterId || !ttsPayload?.audio_base64) return;
        const formData = new FormData();
        formData.append('encounter_id', currentEncounterId);
        formData.append('message_id', messageId);
        formData.append('role', role);
        formData.append('audio_base64', ttsPayload.audio_base64);
        formData.append('content_type', ttsPayload.content_type || 'audio/mpeg');
        const response = await fetch('/api/tts_cache', {
            method: 'POST',
            body: formData,
            headers: { 'X-Session-Id': sessionId }
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(extractErrorMessage(detail, 'Cache TTS failed'));
        }
    }

    async function requestTtsPayload(text, messageId = '', role = 'assistant') {
        const formData = new FormData();
        formData.append('text', text);
        if (patientSelect?.value) formData.append('patient_id', patientSelect.value);
        const response = await fetch('/api/tts', {
            method: 'POST',
            body: formData,
            headers: { 'X-Session-Id': sessionId }
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(extractErrorMessage(detail, 'TTS failed'));
        }
        const payload = await response.json();
        if (messageId) {
            try {
                await cacheTtsPayload(messageId, role, payload);
            } catch (cacheError) {
                console.warn('Failed to cache TTS payload:', cacheError);
            }
        }
        return payload;
    }

    async function speakText(text) {
        if (!text || !String(text).trim()) return;
        const now = Date.now();
        if (lastSpokenText === text && now - lastSpokenAt < 1200) return;
        lastSpokenText = text;
        lastSpokenAt = now;
        await speakTextViaBackend(text);
    }

    if (testTtsButton) {
        testTtsButton.addEventListener('click', async () => {
            const phrase = 'Esto es una prueba de voz del paciente. Me escuchas bien?';
            await speakText(phrase);
        });
    }

    function buildChatFormData(message) {
        const chatFormData = new FormData();
        chatFormData.append('message', message);
        if (audioToggle?.checked) chatFormData.append('include_tts', 'true');
        if (patientSelect?.value) {
            chatFormData.append('patient_id', patientSelect.value);
        }
        if (currentEncounterId) {
            chatFormData.append('encounter_id', currentEncounterId);
        }
        const selectedModel = modelSelect && typeof modelSelect.value === 'string'
            ? modelSelect.value.trim()
            : '';
        if (selectedModel) {
            chatFormData.append('model', selectedModel);
        }
        return chatFormData;
    }

    async function requestChatReply(message) {
        let chatResponse = await fetch('/api/chat', {
            method: 'POST',
            body: buildChatFormData(message),
            headers: { 'X-Session-Id': sessionId }
        });

        if (!chatResponse.ok) {
            const detail = await chatResponse.text().catch(() => '');
            if (currentEncounterId && isFinishedEncounterResponse(chatResponse.status, detail)) {
                setEncounterClosed('Conversación finalizada');
                throw new Error('Conversación finalizada');
            }
            if (currentEncounterId && isMissingEncounterResponse(chatResponse.status, detail)) {
                await ensureActiveEncounter();
                chatResponse = await fetch('/api/chat', {
                    method: 'POST',
                    body: buildChatFormData(message),
                    headers: { 'X-Session-Id': sessionId }
                });
            } else {
                throw new Error(detail || 'Chat failed');
            }
        }

        if (!chatResponse.ok) {
            const detail = await chatResponse.text().catch(() => '');
            if (currentEncounterId && isFinishedEncounterResponse(chatResponse.status, detail)) {
                setEncounterClosed('Conversación finalizada');
                throw new Error('Conversación finalizada');
            }
            throw new Error(detail || 'Chat failed');
        }
        return await chatResponse.json();
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
        const userText = String(payload.user_text || payload.transcript?.text || '').trim();
        if (userText) addMessage(userText, 'user', null, audioBlob);
        const replyText = String(payload.chat?.response || '').trim();
        if (payload.chat?.message_id && payload.tts?.audio_base64) {
            try {
                await cacheTtsPayload(payload.chat.message_id, 'assistant', payload.tts);
            } catch (cacheError) {
                console.warn('Failed to cache TTS payload:', cacheError);
            }
        }
        if (replyText) {
            addAssistantTurn(
                replyText,
                payload.chat?.elapsed_time || null,
                payload.tts,
                true,
                { message_id: payload.chat?.message_id, role: 'assistant' },
            );
        }
        renderSegueFeedback();
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
            let ttsPayload = chatData.tts || null;
            const assistantMessageId = chatData.chat?.message_id;
            const replyText = chatData.chat?.response || chatData.response || '';
            if (assistantMessageId && ttsPayload?.audio_base64) {
                try {
                    await cacheTtsPayload(assistantMessageId, 'assistant', ttsPayload);
                } catch (cacheError) {
                    console.warn('Failed to cache TTS payload:', cacheError);
                }
            }
            addAssistantTurn(
                replyText,
                chatData.chat?.elapsed_time || chatData.elapsed_time,
                ttsPayload,
                !!ttsPayload?.audio_base64,
                { message_id: chatData.chat?.message_id, role: 'assistant' },
            );
            renderSegueFeedback();
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
        if (!audioToggle?.checked) {
            statusDiv.textContent = 'Activa audio para grabar';
            return;
        }
        if (!hasAudioConfig()) {
            statusDiv.textContent = 'Usa Gemini en LLM y configura ElevenLabs';
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


