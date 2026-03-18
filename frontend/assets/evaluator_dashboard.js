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
      const maps = await loadMaps().catch(() => ({ pMap: new Map(), sMap: new Map() }));
      const resp = await fetch('/api/encounters_public');
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const encounters = data.encounters || [];

      if (!encounters.length) {
        savedEncountersEl.innerHTML = '<tr><td colspan="6" class="eval-small">No hay conversaciones guardadas.</td></tr>';
        if (savedStatusEl) savedStatusEl.textContent = '';
        return;
      }

      savedEncountersEl.innerHTML = encounters.map((e) => {
        const encId = String(e.encounter_id || '');
        const student = maps.sMap.get(String(e.student_id || '')) || String(e.student_id || '-');
        const patient = maps.pMap.get(String(e.patient_id || '')) || String(e.patient_id || '-');
        const prof = String(e.evaluator_name || '-');
        const finished = e.finished_at != null;
        const chip = finished ? '<span class="chip warn">Finalizada</span>' : '<span class="chip ok">Activa</span>';

        return `
          <tr data-encounter-id="${escapeHtml(encId)}">
            <td>${escapeHtml(student)}</td>
            <td>${escapeHtml(patient)}</td>
            <td>${escapeHtml(prof)}</td>
            <td>${chip}</td>
            <td class="mono">${escapeHtml(_shortId(encId))}</td>
            <td style="text-align:right;">
              <button class="eval-btn" data-open type="button">Abrir</button>
              <button class="eval-btn danger" data-delete type="button" style="margin-left:8px;">Eliminar</button>
            </td>
          </tr>
        `;
      }).join('');

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

      if (savedStatusEl) savedStatusEl.textContent = '';
    } catch (e) {
      if (savedStatusEl) savedStatusEl.textContent = String(e?.message || e);
      savedEncountersEl.innerHTML = '<tr><td colspan="6" class="eval-small">No se pudieron cargar las conversaciones.</td></tr>';
    }
  }

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
