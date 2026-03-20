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
  const btnStart = document.getElementById('btn-start');

  const patientSelect = document.getElementById('patient-select');
  const studentSelect = document.getElementById('student-select');
  const evaluatorNameInput = document.getElementById('evaluator-name');

  const modalOverlay = document.getElementById('modal-overlay');
  const modalSession = document.getElementById('modal-session');

  // Pagination variables
  let currentPage = 1;
  const itemsPerPage = 10;
  let allEncounters = [];
  let filteredEncounters = [];
  let mapsCache = null;

  function headersJson() {
    return { 'Content-Type': 'application/json', 'X-Session-Id': sessionId };
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

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  modalOverlay.addEventListener('click', closeModals);

  btnNewSession?.addEventListener('click', () => openModal(modalSession));

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
  }

  async function loadMaps() {
    const [patientsResp, studentsResp] = await Promise.all([
      fetch('/api/patients').then((r) => r.json()).catch(() => ({})),
      fetch('/api/students').then((r) => r.json()).catch(() => ({})),
    ]);

    const pMap = new Map();
    for (const p of (patientsResp.patients || [])) {
      pMap.set(String(p.id), `${p.name} (${p.age})`);
    }

    const sMap = new Map();
    for (const s of (studentsResp.students || [])) {
      const label = `${s.name}${s.student_identifier ? ` (${s.student_identifier})` : ''}`;
      sMap.set(String(s.id), label);
    }

    return { pMap, sMap };
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
      mapsCache = await loadMaps().catch(() => ({ pMap: new Map(), sMap: new Map() }));
      const resp = await fetch('/api/encounters_public');
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      allEncounters = data.encounters || [];
      filteredEncounters = [...allEncounters];
      currentPage = 1;
      renderTable();
      renderPagination();
      if (savedStatusEl) savedStatusEl.textContent = '';
    } catch (e) {
      if (savedStatusEl) savedStatusEl.textContent = String(e?.message || e);
      savedEncountersEl.innerHTML = '<tr><td colspan="6" class="eval-small">No se pudieron cargar las conversaciones.</td></tr>';
    }
  }

  function renderTable() {
    if (!filteredEncounters.length) {
      savedEncountersEl.innerHTML = '<tr><td colspan="6" class="eval-small">No hay conversaciones guardadas.</td></tr>';
      return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageEncounters = filteredEncounters.slice(start, end);

    savedEncountersEl.innerHTML = pageEncounters.map((e) => {
      const encId = String(e.encounter_id || '');
      const student = mapsCache.sMap.get(String(e.student_id || '')) || String(e.student_id || '-');
      const patient = mapsCache.pMap.get(String(e.patient_id || '')) || String(e.patient_id || '-');
      const prof = String(e.evaluator_name || '-');
      const finished = e.finished_at != null;
      const chip = finished ? '<span class="chip warn">Finalizada</span>' : '<span class="chip ok">Activa</span>';

      return `
        <tr data-encounter-id="${escapeHtml(encId)}" class="hover:bg-slate-custom-50/50 dark:hover:bg-slate-custom-800/30 transition-colors">
          <td class="px-6 py-4">${escapeHtml(student)}</td>
          <td class="px-6 py-4">${escapeHtml(patient)}</td>
          <td class="px-6 py-4">${escapeHtml(prof)}</td>
          <td class="px-6 py-4">${chip}</td>
          <td class="px-6 py-4 mono">${escapeHtml(_shortId(encId))}</td>
          <td class="px-6 py-4 text-right">
            <div class="inline-flex items-center gap-2">
              <button class="inline-flex items-center justify-center gap-2 px-3 py-1 text-sm font-semibold rounded-md border border-slate-custom-200 text-primary hover:bg-primary/10" data-open type="button">Abrir</button>
              <button class="inline-flex items-center justify-center gap-2 px-3 py-1 text-sm font-semibold rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" data-delete type="button">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Add event listeners for buttons
    savedEncountersEl.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const encId = tr?.getAttribute('data-encounter-id') || '';
        if (!encId) return;
        try {
          if (savedStatusEl) savedStatusEl.textContent = 'Abriendo...';
          await fetch(`/api/encounters/${encodeURIComponent(encId)}/link`, { method: 'POST', headers: headersJson(), body: '{}' }).catch(() => {});
          window.location.href = `/frontend/evaluator_encounter?encounter_id=${encodeURIComponent(encId)}`;
        } catch (e) {
          if (savedStatusEl) savedStatusEl.textContent = String(e?.message || e);
        }
      });
    });

    savedEncountersEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const encId = tr?.getAttribute('data-encounter-id') || '';
        if (!encId) return;
        const ok = window.confirm(`Eliminar conversación?\nencounter_id: ${encId}\n\nEsto borra también audios y la evaluación (si existe).`);
        if (!ok) return;
        try {
          if (savedStatusEl) savedStatusEl.textContent = 'Eliminando...';
          const del = await fetch(`/api/evaluations/${encodeURIComponent(encId)}`, { method: 'DELETE', headers: { 'X-Session-Id': sessionId } });
          if (!del.ok) throw new Error(await del.text());
          await loadSavedEncounters();
          if (savedStatusEl) savedStatusEl.textContent = '';
        } catch (e) {
          if (savedStatusEl) savedStatusEl.textContent = String(e?.message || e);
        }
      });
    });
  }

  function renderPagination() {
    const totalItems = filteredEncounters.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Update the showing text
    const showingEl = document.querySelector('.px-6.py-4.border-t .text-xs.text-slate-custom-500');
    if (showingEl) {
      showingEl.innerHTML = `Mostrando <span class="font-bold">${startItem}-${endItem}</span> de <span class="font-bold">${totalItems}</span> sesiones`;
    }

    // Generate pagination buttons
    const paginationContainer = document.querySelector('.px-6.py-4.border-t .flex.items-center.gap-1');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'p-1 rounded hover:bg-slate-custom-200 dark:hover:bg-slate-custom-700 disabled:opacity-30';
    prevBtn.disabled = currentPage === 1;
    prevBtn.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_left</span>';
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        renderPagination();
      }
    });
    paginationContainer.appendChild(prevBtn);

    // Page buttons
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      const firstBtn = document.createElement('button');
      firstBtn.className = 'px-3 py-1 text-xs font-medium hover:bg-slate-custom-200 dark:hover:bg-slate-custom-700 rounded';
      firstBtn.textContent = '1';
      firstBtn.addEventListener('click', () => {
        currentPage = 1;
        renderTable();
        renderPagination();
      });
      paginationContainer.appendChild(firstBtn);

      if (startPage > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'text-xs px-1 text-slate-custom-400';
        ellipsis.textContent = '...';
        paginationContainer.appendChild(ellipsis);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `px-3 py-1 text-xs font-medium rounded ${i === currentPage ? 'bg-primary text-white' : 'hover:bg-slate-custom-200 dark:hover:bg-slate-custom-700'}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => {
        currentPage = i;
        renderTable();
        renderPagination();
      });
      paginationContainer.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'text-xs px-1 text-slate-custom-400';
        ellipsis.textContent = '...';
        paginationContainer.appendChild(ellipsis);
      }

      const lastBtn = document.createElement('button');
      lastBtn.className = 'px-3 py-1 text-xs font-medium hover:bg-slate-custom-200 dark:hover:bg-slate-custom-700 rounded';
      lastBtn.textContent = totalPages;
      lastBtn.addEventListener('click', () => {
        currentPage = totalPages;
        renderTable();
        renderPagination();
      });
      paginationContainer.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'p-1 rounded hover:bg-slate-custom-200 dark:hover:bg-slate-custom-700 disabled:opacity-30';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_right</span>';
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        renderPagination();
      }
    });
    paginationContainer.appendChild(nextBtn);
  }

  const searchInput = document.getElementById('search-input');

  function applySearchFilter() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    if (!query) {
      filteredEncounters = [...allEncounters];
    } else {
      filteredEncounters = allEncounters.filter(e => {
        const student = (mapsCache.sMap.get(String(e.student_id || '')) || String(e.student_id || '')).toLowerCase();
        const patient = (mapsCache.pMap.get(String(e.patient_id || '')) || String(e.patient_id || '')).toLowerCase();
        const prof = String(e.evaluator_name || '').toLowerCase();
        const encId = String(e.encounter_id || '').toLowerCase();
        return student.includes(query) || patient.includes(query) || prof.includes(query) || encId.includes(query);
      });
    }
    currentPage = 1;
    renderTable();
    renderPagination();
  }

  searchInput?.addEventListener('input', applySearchFilter);

  btnStart?.addEventListener('click', async () => {
    try {
      if (savedStatusEl) savedStatusEl.textContent = 'Iniciando...';
      const patientId = patientSelect?.value || '';
      const studentId = studentSelect?.value || '';
      const evalName = (evaluatorNameInput?.value || '').trim();
      if (!patientId) throw new Error('Selecciona paciente');
      if (!studentId) throw new Error('Selecciona alumno');
      if (!evalName) throw new Error('Completa evaluador/a');

      const resp = await fetch('/api/encounters/start', {
        method: 'POST',
        headers: headersJson(),
        body: JSON.stringify({ patient_id: patientId, mode: 'segue', student_id: studentId, evaluator_name: evalName }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const encounterId = data.encounter_id;

      closeModals();
      window.location.href = `/frontend/evaluator_encounter?encounter_id=${encodeURIComponent(encounterId)}`;
    } catch (e) {
      if (savedStatusEl) savedStatusEl.textContent = String(e?.message || e);
    }
  });

  Promise.all([loadPatients(), loadStudents()])
    .then(() => loadSavedEncounters())
    .catch(() => loadSavedEncounters());
})();
