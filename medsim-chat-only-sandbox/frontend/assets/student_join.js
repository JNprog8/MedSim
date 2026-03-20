(function () {
  const sessionIdKey = 'medsim_session_id';

  const waitCard = document.getElementById('wait-card');
  const browseCard = document.getElementById('browse-card');
  const waitStatusEl = document.getElementById('wait-status');
  const waitMetaEl = document.getElementById('wait-meta');
  const btnShowBrowse = document.getElementById('btn-show-browse');
  const btnBackWait = document.getElementById('btn-back-wait');
  const sessionIdEl = document.getElementById('session-id');

  const tableStatusEl = document.getElementById('table-status');
  const rowsEl = document.getElementById('conv-rows');

  const btnReload = document.getElementById('btn-reload');

  function setTableStatus(t) { if (tableStatusEl) tableStatusEl.textContent = t || ''; }
  function setWaitStatus(t) { if (waitStatusEl) waitStatusEl.textContent = t || ''; }
  function setWaitMeta(t) { if (waitMetaEl) waitMetaEl.textContent = t || ''; }

  function showBrowse() {
    waitCard?.classList.add('hidden');
    browseCard?.classList.remove('hidden');
  }

  function showWait() {
    browseCard?.classList.add('hidden');
    waitCard?.classList.remove('hidden');
  }

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

  function formatTime(ts = Date.now()) {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  }

  async function fetchEncountersPublic() {
    return await fetch('/api/encounters_public').then((r) => r.json()).catch(() => ({}));
  }

  async function pollForActiveEncounter() {
    const resp = await fetchEncountersPublic();
    const encounters = resp.encounters || [];
    const active = encounters.filter((e) => e && e.finished_at == null);

    if (!active.length) {
      setWaitStatus('Esperando conversación activa...');
      setWaitMeta(`Último chequeo: ${formatTime()}`);
      return { status: 'none' };
    }

    if (active.length > 1) {
      setWaitStatus(`Hay ${active.length} conversaciones activas. Elegí una en la lista.`);
      setWaitMeta(`Último chequeo: ${formatTime()}`);
      return { status: 'many', active };
    }

    const enc = active[0];
    const encId = String(enc.encounter_id || '').trim();
    if (!encId) return { status: 'none' };

    setWaitStatus('Conversación encontrada. Uniéndote...');
    setWaitMeta(`encounter_id: ${shortId(encId)}`);
    return { status: 'one', encounter_id: encId, encounter: enc };
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
    rowsEl.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-on-surface-variant">Cargando...</td></tr>';
    const maps = await loadMaps().catch(() => ({ pMap: new Map(), sMap: new Map() }));
    const resp = await fetchEncountersPublic();
    const encounters = resp.encounters || [];

    if (!encounters.length) {
      rowsEl.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-on-surface-variant">No hay conversaciones guardadas.</td></tr>';
      setTableStatus('');
      return;
    }

    rowsEl.innerHTML = encounters.map((e) => {
      const encId = String(e.encounter_id || '');
      const student = maps.sMap.get(String(e.student_id || '')) || String(e.student_id || '-');
      const patient = maps.pMap.get(String(e.patient_id || '')) || String(e.patient_id || '-');
      const prof = String(e.evaluator_name || '-');
      const finished = e.finished_at != null;
      const chip = finished
        ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-error-container text-on-error-container">Finalizada</span>'
        : '<span class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-secondary-container text-on-secondary-container">Activa</span>';
      return `
        <tr data-enc="${escapeHtml(encId)}">
          <td class="px-4 py-3">${escapeHtml(student)}</td>
          <td class="px-4 py-3">${escapeHtml(patient)}</td>
          <td class="px-4 py-3">${escapeHtml(prof)}</td>
          <td class="px-4 py-3">${chip}</td>
          <td class="px-4 py-3 font-mono text-[12px] text-on-surface-variant">${escapeHtml(shortId(encId))}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button class="px-4 py-2 rounded-xl bg-secondary-container text-on-secondary-container font-headline font-bold hover:opacity-90 transition-opacity" data-join-row type="button">Entrar</button>
            <button class="px-4 py-2 rounded-xl bg-error-container text-on-error-container font-headline font-bold hover:opacity-90 transition-opacity ml-2" data-delete-row type="button">Eliminar</button>
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
  if (sessionIdEl) sessionIdEl.textContent = getOrDefaultSession();

  const urlParams = new URLSearchParams(window.location.search);
  const encounterFromUrl = (urlParams.get('encounter_id') || '').trim();
  const browseDefault = (urlParams.get('browse') || '').trim() === '1';

  let waitingEnabled = true;

  btnShowBrowse?.addEventListener('click', (e) => {
    e?.preventDefault?.();
    waitingEnabled = false;
    showBrowse();
    loadTable().catch(() => setTableStatus('Error cargando conversaciones.'));
  });

  btnBackWait?.addEventListener('click', (e) => {
    e?.preventDefault?.();
    waitingEnabled = true;
    setTableStatus('');
    showWait();
  });

  if (browseDefault) {
    showBrowse();
    loadTable().catch(() => setTableStatus('Error cargando conversaciones.'));
    return;
  }

  if (encounterFromUrl) {
    const sid = getOrDefaultSession();
    adoptAndGo(sid, encounterFromUrl).catch((e) => {
      setWaitStatus(String(e?.message || e || 'No se pudo unir.'));
    });
    return;
  }

  // Waiting room: poll until exactly one active encounter is available.
  let isJoining = false;
  let pollTimer = null;

  async function tick() {
    if (!waitingEnabled) return;
    if (isJoining) return;
    const sid = getOrDefaultSession();
    try {
      const res = await pollForActiveEncounter();
      if (res.status === 'many') {
        waitingEnabled = false;
        showBrowse();
        await loadTable().catch(() => setTableStatus('Error cargando conversaciones.'));
        return;
      }
      if (res.status === 'one' && res.encounter_id) {
        isJoining = true;
        await adoptAndGo(sid, res.encounter_id);
      }
    } catch (e) {
      setWaitStatus('Error esperando conversación. Reintentando...');
      setWaitMeta(String(e?.message || ''));
    }
  }

  showWait();
  tick();
  pollTimer = setInterval(() => { tick(); }, 2000);
})();
