(function () {
  const sessionIdKey = 'medsim_unreal_session_id';
  const tableStatusEl = document.getElementById('table-status');

  let pollTimer = null;
  let joining = false;

  function setTableStatus(text) {
    if (tableStatusEl) tableStatusEl.textContent = text || '';
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
    if (!enc) throw new Error('No hay encounter activo');

    localStorage.setItem(sessionIdKey, sid);

    await fetch(`/api/encounters/${encodeURIComponent(enc)}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid },
      body: '{}',
    }).catch(() => {});

    window.location.href = `/frontend/unreal?session_id=${encodeURIComponent(sid)}&encounter_id=${encodeURIComponent(enc)}`;
  }

  async function loadActiveEncounter() {
    if (joining) return;

    const resp = await fetch('/api/encounters_public').then((r) => r.json()).catch(() => ({}));
    const encounters = Array.isArray(resp) ? resp : (Array.isArray(resp.encounters) ? resp.encounters : []);
    const active = encounters.find((encounter) => encounter && encounter.finished_at == null);

    if (!active) {
      setTableStatus('');
      return;
    }

    joining = true;
    try {
      setTableStatus('Encounter detectado. Entrando automaticamente...');
      await adoptAndGo(getOrDefaultSession(), active.encounter_id);
    } catch (error) {
      joining = false;
      setTableStatus(String(error?.message || error));
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      loadActiveEncounter().catch(() => setTableStatus(''));
    }, 4000);
  }

  if (!localStorage.getItem(sessionIdKey)) {
    localStorage.setItem(sessionIdKey, genSessionId());
  }

  loadActiveEncounter().catch(() => setTableStatus(''));
  startPolling();
})();
