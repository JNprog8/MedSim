(function () {
  const rowsEl = document.getElementById('patient-rows');
  const listStatusEl = document.getElementById('list-status');

  const modalOverlay = document.getElementById('modal-overlay');
  const modalPatient = document.getElementById('modal-patient');

  const btnRefresh = document.getElementById('btn-refresh');
  const btnNew = document.getElementById('btn-new');
  const btnSave = document.getElementById('btn-save');
  const btnDelete = document.getElementById('btn-delete');

  const formStatus = document.getElementById('form-status');

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

  const pResponseStyle = document.getElementById('p-response-style');
  const pPersonality = document.getElementById('p-personality');
  const pLanguageLevel = document.getElementById('p-language-level');
  const pMemoryLevel = document.getElementById('p-memory-level');
  const pCognitive = document.getElementById('p-cognitive');
  const pSpeakingStyle = document.getElementById('p-speaking-style');

  let activePatientId = '';

  function setListStatus(t) { if (listStatusEl) listStatusEl.textContent = t || ''; }
  function setFormStatus(t) { if (formStatus) formStatus.textContent = t || ''; }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function openModal() {
    modalOverlay.style.display = 'block';
    modalPatient.style.display = 'block';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    modalPatient.style.display = 'none';
  }

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  modalOverlay.addEventListener('click', closeModal);

  function clearForm() {
    activePatientId = '';
    pId.value = '';
    pFirst.value = '';
    pLast.value = '';
    pAge.value = '';
    pRegion.value = 'AMBA';
    pChief.value = '';
    pFeel.value = '';
    pSymptoms.value = '';
    pSecret.value = '';
    pDisplay.value = '';
    if (pResponseStyle) pResponseStyle.value = 'Calmado';
    if (pPersonality) pPersonality.value = 'Neutral';
    if (pLanguageLevel) pLanguageLevel.value = 'B';
    if (pMemoryLevel) pMemoryLevel.value = 'Low';
    if (pCognitive) pCognitive.value = 'Normal';
    if (pSpeakingStyle) pSpeakingStyle.value = 'rioplatense';
    setFormStatus('');
  }

  function fillForm(profile) {
    const p = profile || {};
    activePatientId = String(p.id || '').trim();

    const full = (p?.administrative?.full_name || '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    pFirst.value = parts[0] || p.name || '';
    pLast.value = parts.slice(1).join(' ');
    pAge.value = String(p.age ?? '');
    pRegion.value = p.region || 'AMBA';
    pId.value = p.id || '';
    pChief.value = p.chief_complaint || '';
    pFeel.value = p.what_they_feel || '';
    pSymptoms.value = Array.isArray(p.symptoms_reported) ? p.symptoms_reported.join('\n') : '';
    pSecret.value = p.unknown_real_problem || '';
    pDisplay.value = p.doctor_display_real_problem || '';

    if (pResponseStyle) pResponseStyle.value = p.behavior_profile || p.response_style || 'Calmado';
    if (pPersonality) pPersonality.value = p.personality || 'Neutral';
    if (pLanguageLevel) pLanguageLevel.value = p.language_level || 'B';
    if (pMemoryLevel) pMemoryLevel.value = p.medical_history_recall || 'Low';
    if (pCognitive) pCognitive.value = p.cognitive_confusion || 'Normal';
    if (pSpeakingStyle) pSpeakingStyle.value = p.speaking_style || 'rioplatense';
  }

  async function loadPatient(id) {
    const pid = String(id || '').trim();
    if (!pid) return;
    setFormStatus('Cargando...');
    const resp = await fetch(`/api/patients/${encodeURIComponent(pid)}`);
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json().catch(() => ({}));
    fillForm(data.patient || data);
    setFormStatus('');
  }

  function buildPayload() {
    const first = (pFirst.value || '').trim();
    const last = (pLast.value || '').trim();
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    const id = (pId.value || '').trim();
    const age = parseInt(String(pAge.value || '').trim(), 10);
    if (!id) throw new Error('ID requerido');
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

    return {
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
      response_style: responseProfile,
    };
  }

  async function loadTable() {
    setListStatus('Cargando...');
    rowsEl.innerHTML = '<tr><td colspan="5" class="eval-small">Cargando...</td></tr>';
    const resp = await fetch('/api/patients');
    const data = await resp.json().catch(() => ({}));
    const patients = data.patients || [];
    if (!patients.length) {
      rowsEl.innerHTML = '<tr><td colspan="5" class="eval-small">No hay pacientes cargados.</td></tr>';
      setListStatus('');
      return;
    }
    rowsEl.innerHTML = patients.map((p) => {
      const pid = String(p.id || '');
      const title = `${String(p.name || '')} (${String(p.age ?? '')})`;
      const chief = String(p.chief_complaint || p.triage_reference || '').trim();
      return `
        <tr data-pid="${escapeHtml(pid)}">
          <td class="mono">${escapeHtml(pid)}</td>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(p.region || '')}</td>
          <td>${escapeHtml(chief).slice(0, 140)}</td>
          <td style="text-align:right;">
            <button class="eval-btn" data-edit type="button">Editar</button>
            <button class="eval-btn" data-del type="button" style="margin-left:8px; border-color: rgba(180,35,24,0.35); color:#b42318;">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');

    rowsEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const pid = tr?.getAttribute('data-pid') || '';
        if (!pid) return;
        try {
          clearForm();
          openModal();
          await loadPatient(pid);
        } catch (e) {
          setFormStatus(String(e?.message || e));
        }
      });
    });

    rowsEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const pid = tr?.getAttribute('data-pid') || '';
        if (!pid) return;
        const ok = window.confirm(`Eliminar paciente?\nID: ${pid}`);
        if (!ok) return;
        try {
          setListStatus('Eliminando...');
          const resp2 = await fetch(`/api/patients/${encodeURIComponent(pid)}`, { method: 'DELETE' });
          if (!resp2.ok) throw new Error(await resp2.text());
          await loadTable();
          setListStatus('');
        } catch (e) {
          setListStatus(String(e?.message || e));
        }
      });
    });

    setListStatus('');
  }

  btnRefresh?.addEventListener('click', () => loadTable().catch(() => setListStatus('Error cargando.')));
  btnNew?.addEventListener('click', () => {
    clearForm();
    openModal();
  });

  btnSave?.addEventListener('click', async () => {
    setFormStatus('');
    try {
      const payload = buildPayload();
      const resp = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(await resp.text());
      closeModal();
      await loadTable();
    } catch (e) {
      setFormStatus(String(e?.message || e));
    }
  });

  btnDelete?.addEventListener('click', async () => {
    const pid = String(pId.value || activePatientId || '').trim();
    if (!pid) return;
    const ok = window.confirm(`Eliminar paciente?\nID: ${pid}`);
    if (!ok) return;
    try {
      setFormStatus('Eliminando...');
      const resp = await fetch(`/api/patients/${encodeURIComponent(pid)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(await resp.text());
      closeModal();
      await loadTable();
      setFormStatus('');
    } catch (e) {
      setFormStatus(String(e?.message || e));
    }
  });

  // Boot
  loadTable().catch(() => setListStatus('Error cargando pacientes.'));
})();

