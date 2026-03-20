(function () {
  const sessionIdKey = 'medsim_session_id';
  const sessionId = (() => {
    const existing = localStorage.getItem(sessionIdKey);
    if (existing) return existing;
    const created = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(sessionIdKey, created);
    return created;
  })();

  const savedStatusEl = document.getElementById('saved-status');
  const savedEncountersEl = document.getElementById('saved-encounters');
  const btnNewSession = document.getElementById('btn-new-session');
  const btnRefreshList = document.getElementById('btn-refresh-list');
  const btnStart = document.getElementById('btn-start');
  const patientSelect = document.getElementById('patient-select');
  const studentSelect = document.getElementById('student-select');
  const evaluatorNameInput = document.getElementById('evaluator-name');
  const searchInput = document.getElementById('search-encounters');
  const visibleCountEl = document.getElementById('stats-visible-count');
  const totalCountEl = document.getElementById('stats-total-count');
  const tableSummaryEl = document.getElementById('table-summary');
  const pageSizeSelect = document.getElementById('page-size');
  const pagePrevBtn = document.getElementById('page-prev');
  const pageNextBtn = document.getElementById('page-next');
  const pageIndicatorEl = document.getElementById('page-indicator');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalSession = document.getElementById('modal-session');

  let allEncounters = [];
  let mapsCache = { pMap: new Map(), sMap: new Map() };
  let currentPage = 1;

  function headersJson() {
    return { 'Content-Type': 'application/json', 'X-Session-Id': sessionId };
  }

  function setStatus(text) {
    if (savedStatusEl) savedStatusEl.textContent = text || '';
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function openModal(el) {
    if (!el) return;
    modalOverlay.style.display = 'block';
    el.style.display = 'block';
  }

  function closeModals() {
    modalOverlay.style.display = 'none';
    if (modalSession) modalSession.style.display = 'none';
  }

  function shortId(value) {
    const text = String(value || '').trim();
    if (text.length <= 16) return text;
    return `${text.slice(0, 8)}...${text.slice(-6)}`;
  }

  function buildEncounterView(encounter) {
    const encId = String(encounter.encounter_id || '');
    const student = mapsCache.sMap.get(String(encounter.student_id || '')) || String(encounter.student_id || '-');
    const patient = mapsCache.pMap.get(String(encounter.patient_id || '')) || String(encounter.patient_id || '-');
    const evaluator = String(encounter.evaluator_name || '-');
    const finished = encounter.finished_at != null;

    return {
      encounter,
      encId,
      student,
      patient,
      evaluator,
      finished,
      statusLabel: finished ? 'Finalizada' : 'Activa',
      searchValue: `${student} ${patient} ${evaluator} ${encId}`.toLowerCase(),
    };
  }

  function renderRows() {
    if (!savedEncountersEl) return;
    const term = String(searchInput?.value || '').trim().toLowerCase();
    const rows = allEncounters
      .map(buildEncounterView)
      .filter((row) => !term || row.searchValue.includes(term));
    const pageSize = Math.max(1, parseInt(pageSizeSelect?.value || '10', 10));
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pagedRows = rows.slice(start, start + pageSize);

    if (visibleCountEl) visibleCountEl.textContent = String(pagedRows.length);
    if (totalCountEl) totalCountEl.textContent = String(allEncounters.length);
    if (tableSummaryEl) {
      tableSummaryEl.textContent = term ? `Filtro activo: ${rows.length} resultado${rows.length === 1 ? '' : 's'}` : 'Listado completo';
    }
    if (pageIndicatorEl) pageIndicatorEl.textContent = `Pagina ${currentPage} de ${totalPages}`;
    if (pagePrevBtn) pagePrevBtn.disabled = currentPage <= 1;
    if (pageNextBtn) pageNextBtn.disabled = currentPage >= totalPages;

    if (!rows.length) {
      const msg = term ? 'No hay conversaciones que coincidan con la búsqueda.' : 'No hay conversaciones guardadas.';
      savedEncountersEl.innerHTML = `<tr><td colspan="6" class="eval-small">${escapeHtml(msg)}</td></tr>`;
      return;
    }

    savedEncountersEl.innerHTML = pagedRows.map((row) => `
      <tr data-encounter-id="${escapeHtml(row.encId)}">
        <td>${escapeHtml(row.student)}</td>
        <td>${escapeHtml(row.patient)}</td>
        <td>${escapeHtml(row.evaluator)}</td>
        <td>
          <span class="chip ${row.finished ? 'warn' : 'ok'}">
            <span class="chip-dot"></span>
            ${escapeHtml(row.statusLabel)}
          </span>
        </td>
        <td class="mono">${escapeHtml(shortId(row.encId))}</td>
        <td>
          <div class="row-actions">
            <button class="btn icon-btn" data-open type="button" title="Abrir">
              <span class="material-symbols-outlined">open_in_new</span>
            </button>
            <button class="btn danger icon-btn" data-delete type="button" title="Eliminar">
              <span class="material-symbols-outlined">delete_outline</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    savedEncountersEl.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const encId = btn.closest('tr')?.getAttribute('data-encounter-id') || '';
        if (!encId) return;
        try {
          setStatus('Abriendo conversación...');
          await fetch(`/api/encounters/${encodeURIComponent(encId)}/link`, { method: 'POST', headers: headersJson(), body: '{}' }).catch(() => {});
          window.location.href = `/frontend/evaluator_encounter?encounter_id=${encodeURIComponent(encId)}`;
        } catch (error) {
          setStatus(String(error?.message || error));
        }
      });
    });

    savedEncountersEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const encId = btn.closest('tr')?.getAttribute('data-encounter-id') || '';
        if (!encId) return;
        const ok = window.confirm(`Eliminar conversación?\nencounter_id: ${encId}\n\nEsto borra también audios y la evaluación vinculada.`);
        if (!ok) return;
        try {
          setStatus('Eliminando conversación...');
          const resp = await fetch(`/api/evaluations/${encodeURIComponent(encId)}`, { method: 'DELETE', headers: { 'X-Session-Id': sessionId } });
          if (!resp.ok) throw new Error(await resp.text());
          await loadSavedEncounters();
          setStatus('');
        } catch (error) {
          setStatus(String(error?.message || error));
        }
      });
    });
  }

  async function loadPatients() {
    const resp = await fetch('/api/patients', { headers: { 'X-Session-Id': sessionId } });
    const data = await resp.json();
    const patients = data.patients || [];
    patientSelect.innerHTML = '';
    for (const patient of patients) {
      const opt = document.createElement('option');
      opt.value = patient.id;
      opt.textContent = `${patient.name} (${patient.age})`;
      patientSelect.appendChild(opt);
    }
  }

  async function loadStudents() {
    const resp = await fetch('/api/students', { headers: { 'X-Session-Id': sessionId } });
    const data = await resp.json();
    const students = data.students || [];
    studentSelect.innerHTML = '';
    for (const student of students) {
      const opt = document.createElement('option');
      opt.value = student.id;
      opt.textContent = `${student.name}${student.student_identifier ? ` (${student.student_identifier})` : ''}`;
      studentSelect.appendChild(opt);
    }
  }

  async function loadMaps() {
    const [patientsResp, studentsResp] = await Promise.all([
      fetch('/api/patients').then((r) => r.json()).catch(() => ({})),
      fetch('/api/students').then((r) => r.json()).catch(() => ({})),
    ]);

    const pMap = new Map();
    for (const patient of (patientsResp.patients || [])) {
      pMap.set(String(patient.id), `${patient.name} (${patient.age})`);
    }

    const sMap = new Map();
    for (const student of (studentsResp.students || [])) {
      sMap.set(String(student.id), `${student.name}${student.student_identifier ? ` (${student.student_identifier})` : ''}`);
    }

    mapsCache = { pMap, sMap };
  }

  async function loadSavedEncounters() {
    if (!savedEncountersEl) return;
    try {
      setStatus('Cargando conversaciones...');
      await loadMaps();
      const resp = await fetch('/api/encounters_public');
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      allEncounters = data.encounters || [];
      renderRows();
      setStatus(`${allEncounters.length} conversación${allEncounters.length === 1 ? '' : 'es'} disponibles`);
    } catch (error) {
      setStatus(String(error?.message || error));
      savedEncountersEl.innerHTML = '<tr><td colspan="6" class="eval-small">No se pudieron cargar las conversaciones.</td></tr>';
    }
  }

  document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeModals));
  modalOverlay?.addEventListener('click', closeModals);
  btnNewSession?.addEventListener('click', () => openModal(modalSession));
  btnRefreshList?.addEventListener('click', () => loadSavedEncounters());
  searchInput?.addEventListener('input', () => { currentPage = 1; renderRows(); });
  pageSizeSelect?.addEventListener('change', () => { currentPage = 1; renderRows(); });
  pagePrevBtn?.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderRows(); });
  pageNextBtn?.addEventListener('click', () => { currentPage += 1; renderRows(); });

  btnStart?.addEventListener('click', async () => {
    try {
      setStatus('Iniciando sesión...');
      const patientId = patientSelect?.value || '';
      const studentId = studentSelect?.value || '';
      const evalName = (evaluatorNameInput?.value || '').trim();
      if (!patientId) throw new Error('Selecciona paciente');
      if (!studentId) throw new Error('Selecciona alumno');
      if (!evalName) throw new Error('Completa evaluador/a');

      const resp = await fetch('/api/encounters/start', {
        method: 'POST',
        headers: headersJson(),
        body: JSON.stringify({ patient_id: patientId, student_id: studentId, evaluator_name: evalName }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      closeModals();
      window.location.href = `/frontend/evaluator_encounter?encounter_id=${encodeURIComponent(data.encounter_id)}`;
    } catch (error) {
      setStatus(String(error?.message || error));
    }
  });

  Promise.all([loadPatients(), loadStudents()])
    .then(() => loadSavedEncounters())
    .catch(() => loadSavedEncounters());
})();
