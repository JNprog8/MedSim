(function () {
  const rowsEl = document.getElementById('patient-rows');
  const listStatusEl = document.getElementById('list-status');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalPatient = document.getElementById('modal-patient');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnNew = document.getElementById('btn-new');
  const btnSave = document.getElementById('btn-save');
  const btnDelete = document.getElementById('btn-delete');
  const searchInput = document.getElementById('search-patients');
  const visibleCountEl = document.getElementById('stats-visible-count');
  const totalCountEl = document.getElementById('stats-total-count');
  const pageSizeSelect = document.getElementById('page-size');
  const pagePrevBtn = document.getElementById('page-prev');
  const pageNextBtn = document.getElementById('page-next');
  const pageIndicatorEl = document.getElementById('page-indicator');
  const formStatus = document.getElementById('form-status');
  const pFirst = document.getElementById('p-first');
  const pLast = document.getElementById('p-last');
  const pAge = document.getElementById('p-age');
  const pRegion = document.getElementById('p-region');
  const pDob = document.getElementById('p-dob');
  const pDni = document.getElementById('p-dni');
  const pInsurance = document.getElementById('p-insurance');
  const pSex = document.getElementById('p-sex');
  const pOccupation = document.getElementById('p-occupation');
  const pId = document.getElementById('p-id');
  const pTriage = document.getElementById('p-triage');
  const pChief = document.getElementById('p-chief');
  const pFeel = document.getElementById('p-feel');
  const pSymptoms = document.getElementById('p-symptoms');
  const pKnownHistory = document.getElementById('p-known-history');
  const pDiagnoses = document.getElementById('p-diagnoses');
  const pSurgeries = document.getElementById('p-surgeries');
  const pAllergies = document.getElementById('p-allergies');
  const pMedications = document.getElementById('p-medications');
  const pLabs = document.getElementById('p-labs');
  const pImaging = document.getElementById('p-imaging');
  const pNotes = document.getElementById('p-notes');
  const pSecret = document.getElementById('p-secret');
  const pDisplay = document.getElementById('p-display');
  const pTrueMain = document.getElementById('p-true-main');
  const pTrueDiffs = document.getElementById('p-true-diffs');
  const pTruePlan = document.getElementById('p-true-plan');
  const pTrueRx = document.getElementById('p-true-rx');
  const pResponseStyle = document.getElementById('p-response-style');
  const pPersonality = document.getElementById('p-personality');
  const pLanguageLevel = document.getElementById('p-language-level');
  const pMemoryLevel = document.getElementById('p-memory-level');
  const pCognitive = document.getElementById('p-cognitive');
  const pSpeakingStyle = document.getElementById('p-speaking-style');

  let activePatientId = '';
  let allPatients = [];
  let currentPage = 1;

  function setListStatus(text) { if (listStatusEl) listStatusEl.textContent = text || ''; }
  function setFormStatus(text) { if (formStatus) formStatus.textContent = text || ''; }

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

  function clearForm() {
    activePatientId = '';
    pId.value = '';
    pFirst.value = '';
    pLast.value = '';
    pAge.value = '';
    pRegion.value = 'AMBA';
    pDob.value = '';
    pDni.value = '';
    pInsurance.value = '';
    pSex.value = '';
    pOccupation.value = '';
    pChief.value = '';
    pTriage.value = '';
    pFeel.value = '';
    pSymptoms.value = '';
    pKnownHistory.value = '';
    pDiagnoses.value = '';
    pSurgeries.value = '';
    pAllergies.value = '';
    pMedications.value = '';
    pLabs.value = '';
    pImaging.value = '';
    pNotes.value = '';
    pSecret.value = '';
    pDisplay.value = '';
    pTrueMain.value = '';
    pTrueDiffs.value = '';
    pTruePlan.value = '';
    pTrueRx.value = '';
    if (pResponseStyle) pResponseStyle.value = 'Calmado';
    if (pPersonality) pPersonality.value = 'Neutral';
    if (pLanguageLevel) pLanguageLevel.value = 'B';
    if (pMemoryLevel) pMemoryLevel.value = 'Low';
    if (pCognitive) pCognitive.value = 'Normal';
    if (pSpeakingStyle) pSpeakingStyle.value = 'rioplatense';
    setFormStatus('');
  }

  function fillForm(profile) {
    const patient = profile || {};
    activePatientId = String(patient.id || '').trim();
    const full = (patient?.administrative?.full_name || '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    pFirst.value = parts[0] || patient.name || '';
    pLast.value = parts.slice(1).join(' ');
    pAge.value = String(patient.age ?? '');
    pRegion.value = patient.region || 'AMBA';
    pDob.value = patient?.administrative?.date_of_birth || '';
    pDni.value = patient?.administrative?.dni || '';
    pInsurance.value = patient?.administrative?.insurance || '';
    pSex.value = patient?.administrative?.sex || '';
    pOccupation.value = patient?.administrative?.occupation || '';
    pId.value = patient.id || '';
    pTriage.value = patient?.triage?.reference_short || '';
    pChief.value = patient.chief_complaint || '';
    pFeel.value = patient.what_they_feel || '';
    pSymptoms.value = Array.isArray(patient.symptoms_reported) ? patient.symptoms_reported.join('\n') : '';
    pKnownHistory.value = Object.entries(patient.known_medical_history || {}).map(([key, value]) => `${key}: ${value}`).join('\n');
    pDiagnoses.value = Array.isArray(patient?.institutional_history?.diagnoses) ? patient.institutional_history.diagnoses.join('\n') : '';
    pSurgeries.value = Array.isArray(patient?.institutional_history?.surgeries) ? patient.institutional_history.surgeries.join('\n') : '';
    pAllergies.value = Array.isArray(patient?.institutional_history?.allergies) ? patient.institutional_history.allergies.join('\n') : '';
    pMedications.value = Array.isArray(patient?.institutional_history?.medications_current) ? patient.institutional_history.medications_current.join('\n') : '';
    pLabs.value = Array.isArray(patient?.recent_studies?.labs) ? patient.recent_studies.labs.join('\n') : '';
    pImaging.value = Array.isArray(patient?.recent_studies?.imaging) ? patient.recent_studies.imaging.join('\n') : '';
    pNotes.value = Array.isArray(patient?.recent_studies?.notes) ? patient.recent_studies.notes.join('\n') : '';
    pSecret.value = patient.unknown_real_problem || '';
    pDisplay.value = patient.doctor_display_real_problem || '';
    pTrueMain.value = patient?.true_case?.diagnostico_principal || '';
    pTrueDiffs.value = Array.isArray(patient?.true_case?.diferenciales) ? patient.true_case.diferenciales.join('\n') : '';
    pTruePlan.value = patient?.true_case?.indicaciones_plan || '';
    pTrueRx.value = patient?.true_case?.receta || '';
    if (pResponseStyle) pResponseStyle.value = patient.behavior_profile || patient.response_style || 'Calmado';
    if (pPersonality) pPersonality.value = patient.personality || 'Neutral';
    if (pLanguageLevel) pLanguageLevel.value = patient.language_level || 'B';
    if (pMemoryLevel) pMemoryLevel.value = patient.medical_history_recall || 'Low';
    if (pCognitive) pCognitive.value = patient.cognitive_confusion || 'Normal';
    if (pSpeakingStyle) pSpeakingStyle.value = patient.speaking_style || 'rioplatense';
  }

  async function loadPatient(id) {
    const pid = String(id || '').trim();
    if (!pid) return;
    setFormStatus('Cargando paciente...');
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
      .map((item) => item.trim())
      .filter(Boolean);
    const diagnoses = String(pDiagnoses.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const surgeries = String(pSurgeries.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const allergies = String(pAllergies.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const medications = String(pMedications.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const labs = String(pLabs.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const imaging = String(pImaging.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const notes = String(pNotes.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const differentials = String(pTrueDiffs.value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const knownHistory = {};
    String(pKnownHistory.value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) knownHistory[key] = value;
    });

    const responseProfile = pResponseStyle?.value || 'Calmado';
    const trueMain = (pTrueMain.value || '').trim();
    const truePlan = (pTruePlan.value || '').trim();
    const trueRx = (pTrueRx.value || '').trim();
    const triageShort = (pTriage.value || '').trim() || (pChief.value || '').slice(0, 70);

    return {
      id,
      name: first,
      age,
      region: (pRegion.value || 'AMBA').trim() || 'AMBA',
      administrative: {
        full_name: fullName || first,
        date_of_birth: (pDob.value || '').trim() || null,
        dni: (pDni.value || '').trim() || null,
        insurance: (pInsurance.value || '').trim() || null,
        sex: (pSex.value || '').trim() || null,
        occupation: (pOccupation.value || '').trim() || null,
      },
      triage: { reference_short: triageShort || null },
      institutional_history: { diagnoses, surgeries, allergies, medications_current: medications },
      recent_studies: { labs, imaging, notes },
      chief_complaint: (pChief.value || '').trim() || 'Hola, doc. Vine a la guardia.',
      what_they_feel: (pFeel.value || '').trim() || 'Me siento mal.',
      symptoms_reported: symptoms,
      known_medical_history: knownHistory,
      unknown_real_problem: (pSecret.value || '(Completar)').trim() || '(Completar)',
      doctor_display_real_problem: (pDisplay.value || '(Completar)').trim() || '(Completar)',
      true_case: trueMain || truePlan || differentials.length || trueRx ? {
        diagnostico_principal: trueMain || '(Completar)',
        diferenciales: differentials,
        indicaciones_plan: truePlan || '(Completar)',
        receta: trueRx || null,
      } : null,
      personality: pPersonality?.value || 'Neutral',
      language_level: pLanguageLevel?.value || 'B',
      medical_history_recall: pMemoryLevel?.value || 'Low',
      cognitive_confusion: pCognitive?.value || 'Normal',
      speaking_style: pSpeakingStyle?.value || 'rioplatense',
      behavior_profile: responseProfile,
      response_style: responseProfile,
    };
  }

  function renderRows() {
    const term = String(searchInput?.value || '').trim().toLowerCase();
    const filtered = allPatients.filter((patient) => {
      const haystack = `${patient.id || ''} ${patient.name || ''} ${patient.region || ''} ${patient.chief_complaint || patient.triage_reference || ''}`.toLowerCase();
      return !term || haystack.includes(term);
    });
    const pageSize = Math.max(1, parseInt(pageSizeSelect?.value || '10', 10));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    if (visibleCountEl) visibleCountEl.textContent = String(paged.length);
    if (totalCountEl) totalCountEl.textContent = String(allPatients.length);
    if (pageIndicatorEl) pageIndicatorEl.textContent = `Pagina ${currentPage} de ${totalPages}`;
    if (pagePrevBtn) pagePrevBtn.disabled = currentPage <= 1;
    if (pageNextBtn) pageNextBtn.disabled = currentPage >= totalPages;

    if (!filtered.length) {
      rowsEl.innerHTML = `<tr><td colspan="4" class="eval-small">${term ? 'No hay pacientes que coincidan con la búsqueda.' : 'No hay pacientes cargados.'}</td></tr>`;
      return;
    }

    rowsEl.innerHTML = paged.map((patient) => {
      const pid = String(patient.id || '');
      const title = `${String(patient.name || '')} (${String(patient.age ?? '')})`;
      const chief = String(patient.chief_complaint || patient.triage_reference || '').trim();
      return `
        <tr data-pid="${escapeHtml(pid)}">
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(patient.region || '')}</td>
          <td>${escapeHtml(chief).slice(0, 140)}</td>
          <td>
            <div class="row-actions">
              <button class="btn" data-edit type="button">Editar</button>
              <button class="btn danger" data-del type="button">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    rowsEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.closest('tr')?.getAttribute('data-pid') || '';
        if (!pid) return;
        try {
          clearForm();
          openModal();
          await loadPatient(pid);
        } catch (error) {
          setFormStatus(String(error?.message || error));
        }
      });
    });

    rowsEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.closest('tr')?.getAttribute('data-pid') || '';
        if (!pid) return;
        const ok = window.confirm(`Eliminar paciente?\nID: ${pid}`);
        if (!ok) return;
        try {
          setListStatus('Eliminando paciente...');
          const resp = await fetch(`/api/patients/${encodeURIComponent(pid)}`, { method: 'DELETE' });
          if (!resp.ok) throw new Error(await resp.text());
          await loadTable();
        } catch (error) {
          setListStatus(String(error?.message || error));
        }
      });
    });
  }

  async function loadTable() {
    setListStatus('Cargando pacientes...');
    rowsEl.innerHTML = '<tr><td colspan="4" class="eval-small">Cargando pacientes...</td></tr>';
    const resp = await fetch('/api/patients');
    const data = await resp.json().catch(() => ({}));
    allPatients = data.patients || [];
    renderRows();
    setListStatus(`${allPatients.length} paciente${allPatients.length === 1 ? '' : 's'} cargados`);
  }

  document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  modalOverlay?.addEventListener('click', closeModal);
  searchInput?.addEventListener('input', () => { currentPage = 1; renderRows(); });
  pageSizeSelect?.addEventListener('change', () => { currentPage = 1; renderRows(); });
  pagePrevBtn?.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderRows(); });
  pageNextBtn?.addEventListener('click', () => { currentPage += 1; renderRows(); });
  btnRefresh?.addEventListener('click', () => loadTable().catch(() => setListStatus('Error cargando pacientes.')));
  btnNew?.addEventListener('click', () => { clearForm(); openModal(); });

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
    } catch (error) {
      setFormStatus(String(error?.message || error));
    }
  });

  btnDelete?.addEventListener('click', async () => {
    const pid = String(pId.value || activePatientId || '').trim();
    if (!pid) return;
    const ok = window.confirm(`Eliminar paciente?\nID: ${pid}`);
    if (!ok) return;
    try {
      setFormStatus('Eliminando paciente...');
      const resp = await fetch(`/api/patients/${encodeURIComponent(pid)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(await resp.text());
      closeModal();
      await loadTable();
    } catch (error) {
      setFormStatus(String(error?.message || error));
    }
  });

  loadTable().catch(() => setListStatus('Error cargando pacientes.'));
})();
