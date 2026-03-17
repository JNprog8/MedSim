(function () {
  const sessionIdKey = 'medsim_session_id';

  const tableStatusEl = document.getElementById('table-status');
  const rowsEl = document.getElementById('conv-rows');

  const btnReload = document.getElementById('btn-reload');

  function setTableStatus(t) { if (tableStatusEl) tableStatusEl.textContent = t || ''; }

  function genSessionId() {
    return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  function getOrDefaultSession() {
    const existing = localStorage.getItem(sessionIdKey);
    return (existing || genSessionId()).trim();
  }

  async function adoptAndGo(sessionId, encounterId) {
    const sid = String(sessionId || '').trim();
    const enc = String(encounterId || '').trim();
    if (!enc) throw new Error('Completa encounter_id');

    // Store session_id so the student page uses the same one.
    localStorage.setItem(sessionIdKey, sid);

    // Adopt/link the encounter into this session, so /api/encounters/{id} works.
    await fetch(`/api/encounters/${encodeURIComponent(enc)}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid },
      body: '{}',
    }).catch(() => {});

    window.location.href = `/frontend/student?session_id=${encodeURIComponent(sid)}&encounter_id=${encodeURIComponent(enc)}`;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function shortId(value) {
    const s = String(value || '').trim();
    if (s.length <= 16) return s;
    return `${s.slice(0, 8)}...${s.slice(-6)}`;
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

  async function loadTable() {
    setTableStatus('Cargando conversaciones...');
    rowsEl.innerHTML = '<tr><td colspan="6" class="eval-small">Cargando...</td></tr>';
    const maps = await loadMaps().catch(() => ({ pMap: new Map(), sMap: new Map() }));
    const resp = await fetch('/api/encounters_public').then((r) => r.json()).catch(() => ({}));
    const encounters = resp.encounters || [];

    if (!encounters.length) {
      rowsEl.innerHTML = '<tr><td colspan="6" class="eval-small">No hay conversaciones guardadas.</td></tr>';
      setTableStatus('');
      return;
    }

    rowsEl.innerHTML = encounters.map((e) => {
      const encId = String(e.encounter_id || '');
      const student = maps.sMap.get(String(e.student_id || '')) || String(e.student_id || '-');
      const patient = maps.pMap.get(String(e.patient_id || '')) || String(e.patient_id || '-');
      const prof = String(e.evaluator_name || '-');
      const finished = e.finished_at != null;
      const chip = finished ? '<span class="chip warn">Finalizada</span>' : '<span class="chip ok">Activa</span>';
      return `
        <tr data-enc="${escapeHtml(encId)}">
          <td>${escapeHtml(student)}</td>
          <td>${escapeHtml(patient)}</td>
          <td>${escapeHtml(prof)}</td>
          <td>${chip}</td>
          <td class="mono">${escapeHtml(shortId(encId))}</td>
          <td style="text-align:right;">
            <button class="eval-btn" data-join-row type="button">Entrar</button>
            <button class="eval-btn" data-delete-row type="button" style="margin-left:8px; border-color: rgba(180,35,24,0.35); color:#b42318;">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');

    rowsEl.querySelectorAll('[data-join-row]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const encId = tr?.getAttribute('data-enc') || '';
        if (!encId) return;
        const sid = getOrDefaultSession();
        try {
          setTableStatus('Uniendo...');
          await adoptAndGo(sid, encId);
        } catch (e) {
          setTableStatus(String(e?.message || e));
        }
      });
    });

    rowsEl.querySelectorAll('[data-delete-row]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const encId = tr?.getAttribute('data-enc') || '';
        if (!encId) return;
        const ok = window.confirm(`Eliminar conversación?\nencounter_id: ${encId}\n\nEsto borra también audios y la evaluación (si existe).`);
        if (!ok) return;
        try {
          setTableStatus('Eliminando...');
          const resp = await fetch(`/api/evaluations/${encodeURIComponent(encId)}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': getOrDefaultSession() },
          });
          if (!resp.ok) throw new Error(await resp.text());
          await loadTable();
          setTableStatus('');
        } catch (e) {
          setTableStatus(String(e?.message || e));
        }
      });
    });

    setTableStatus('');
  }

  btnReload?.addEventListener('click', () => loadTable().catch(() => setTableStatus('Error cargando.')));

  // Boot
  if (!localStorage.getItem(sessionIdKey)) {
    localStorage.setItem(sessionIdKey, genSessionId());
  }
  loadTable().catch(() => setTableStatus('Error cargando conversaciones.'));
})();
