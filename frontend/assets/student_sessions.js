(function () {
  const sessionIdKey = 'medsim_session_id';
  const sessionList = document.getElementById('session-list');
  const sessionListStatus = document.getElementById('session-list-status');
  const sessionIdLabel = document.getElementById('session-id-label');
  const btnReload = document.getElementById('btn-reload');
  const searchInput = document.getElementById('search-sessions');
  const pageSizeSelect = document.getElementById('page-size');
  const pagePrevBtn = document.getElementById('page-prev');
  const pageNextBtn = document.getElementById('page-next');
  const pageIndicatorEl = document.getElementById('page-indicator');

  let allEncounters = [];
  let currentPage = 1;
  let mapsCache = { pMap: new Map(), sMap: new Map() };

  function setSessionListStatus(text) {
    if (sessionListStatus) sessionListStatus.textContent = text || '';
  }

  function genSessionId() {
    return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  function getOrDefaultSession() {
    const existing = localStorage.getItem(sessionIdKey);
    return (existing || genSessionId()).trim();
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function adoptAndGo(sessionId, encounterId) {
    const sid = String(sessionId || '').trim();
    const enc = String(encounterId || '').trim();
    if (!enc) throw new Error('No hay encounter activo');

    localStorage.setItem(sessionIdKey, sid);

    await fetch(`/api/encounters/${encodeURIComponent(enc)}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid },
      body: '{}',
    }).catch(() => {});

    window.location.href = `/frontend/student?session_id=${encodeURIComponent(sid)}&encounter_id=${encodeURIComponent(enc)}`;
  }

  async function loadMaps() {
    const [patientsResp, studentsResp] = await Promise.all([
      fetch('/api/patients/').then((r) => r.json()).catch(() => ({})),
      fetch('/api/students/').then((r) => r.json()).catch(() => ({})),
    ]);
    const pMap = new Map();
    const patients = Array.isArray(patientsResp) ? patientsResp : (patientsResp.patients || []);
    for (const p of patients) {
      pMap.set(String(p.id), `${p.name} (${p.age})`);
    }
    const sMap = new Map();
    const students = Array.isArray(studentsResp) ? studentsResp : (studentsResp.students || []);
    for (const s of students) {
      sMap.set(String(s.id), `${s.name}${s.student_identifier ? ` (${s.student_identifier})` : ''}`);
    }
    return { pMap, sMap };
  }

  function renderSessionList() {
    if (!sessionList) return;
    const term = String(searchInput?.value || '').trim().toLowerCase();
    const filtered = allEncounters.filter((encounter) => {
      const student = mapsCache.sMap.get(String(encounter.student_id || '')) || String(encounter.student_id || '-');
      const patient = mapsCache.pMap.get(String(encounter.patient_id || '')) || String(encounter.patient_id || '-');
      const evaluator = String(encounter.evaluator_name || '-');
      const haystack = `${student} ${patient} ${evaluator}`.toLowerCase();
      return !term || haystack.includes(term);
    });
    const pageSize = Math.max(1, parseInt(pageSizeSelect?.value || '10', 10));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    if (pageIndicatorEl) pageIndicatorEl.textContent = `Pagina ${currentPage} de ${totalPages}`;
    if (pagePrevBtn) pagePrevBtn.disabled = currentPage <= 1;
    if (pageNextBtn) pageNextBtn.disabled = currentPage >= totalPages;

    if (!filtered.length) {
      sessionList.innerHTML = '<tr><td colspan="5">No hay sesiones disponibles por ahora.</td></tr>';
      setSessionListStatus('Sin sesiones');
      return;
    }

    sessionList.innerHTML = paged.map((encounter) => {
      const encId = String(encounter.encounter_id || '');
      const student = mapsCache.sMap.get(String(encounter.student_id || '')) || String(encounter.student_id || '-');
      const patient = mapsCache.pMap.get(String(encounter.patient_id || '')) || String(encounter.patient_id || '-');
      const evaluator = String(encounter.evaluator_name || '-');
      const finished = encounter.finished_at != null;
      return `
        <tr data-encounter-id="${escapeHtml(encId)}">
          <td><div class="cell-title">${escapeHtml(student)}</div></td>
          <td><div class="cell-meta">${escapeHtml(patient)}</div></td>
          <td><div class="cell-meta">${escapeHtml(evaluator)}</div></td>
          <td><span class="chip ${finished ? 'finished' : ''}">${finished ? 'Finalizada' : 'Activa'}</span></td>
          <td style="text-align:right;"><button class="btn" data-join-session type="button">Entrar</button></td>
        </tr>
      `;
    }).join('');

    sessionList.querySelectorAll('[data-join-session]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const encounterId = btn.closest('[data-encounter-id]')?.getAttribute('data-encounter-id') || '';
        if (!encounterId) return;
        try {
          setSessionListStatus('Entrando a la sesion...');
          await adoptAndGo(getOrDefaultSession(), encounterId);
        } catch (error) {
          setSessionListStatus(String(error?.message || error));
        }
      });
    });

    setSessionListStatus(`${filtered.length} sesion${filtered.length === 1 ? '' : 'es'} encontradas`);
  }

  async function loadSessionList() {
    if (!sessionList) return;
    setSessionListStatus('Cargando sesiones...');
    sessionList.innerHTML = '<tr><td colspan="5">Cargando sesiones...</td></tr>';

    mapsCache = await loadMaps().catch(() => ({ pMap: new Map(), sMap: new Map() }));
    const resp = await fetch('/api/encounters_public').then((r) => r.json()).catch(() => ({}));
    allEncounters = Array.isArray(resp) ? resp : (Array.isArray(resp.encounters) ? resp.encounters : []);
    renderSessionList();
  }

  if (!localStorage.getItem(sessionIdKey)) {
    localStorage.setItem(sessionIdKey, genSessionId());
  }

  const currentSessionId = getOrDefaultSession();
  if (sessionIdLabel) sessionIdLabel.textContent = currentSessionId;

  btnReload?.addEventListener('click', () => {
    loadSessionList().catch(() => setSessionListStatus('No se pudo actualizar.'));
  });
  searchInput?.addEventListener('input', () => {
    currentPage = 1;
    renderSessionList();
  });
  pageSizeSelect?.addEventListener('change', () => {
    currentPage = 1;
    renderSessionList();
  });
  pagePrevBtn?.addEventListener('click', () => {
    currentPage = Math.max(1, currentPage - 1);
    renderSessionList();
  });
  pageNextBtn?.addEventListener('click', () => {
    currentPage += 1;
    renderSessionList();
  });

  loadSessionList().catch(() => setSessionListStatus('No se pudo cargar la lista.'));
})();
