(function () {
  const rowsEl = document.getElementById('student-rows');
  const listStatusEl = document.getElementById('list-status');

  const modalOverlay = document.getElementById('modal-overlay');
  const modalStudent = document.getElementById('modal-student');

  const btnRefresh = document.getElementById('btn-refresh');
  const btnNew = document.getElementById('btn-new');
  const btnSave = document.getElementById('btn-save');
  const btnDelete = document.getElementById('btn-delete');

  const formStatus = document.getElementById('form-status');
  const sId = document.getElementById('s-id');
  const sName = document.getElementById('s-name');

  let activeStudentId = '';

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
    modalStudent.style.display = 'block';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    modalStudent.style.display = 'none';
  }

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  modalOverlay.addEventListener('click', closeModal);

  function clearForm() {
    activeStudentId = '';
    sId.value = '';
    sName.value = '';
    setFormStatus('');
  }

  async function loadStudent(id) {
    const sid = String(id || '').trim();
    if (!sid) return;
    setFormStatus('Cargando...');
    const resp = await fetch(`/api/students/${encodeURIComponent(sid)}`);
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json().catch(() => ({}));
    const s = data.student || data;
    activeStudentId = String(s.id || '').trim();
    sId.value = s.id || '';
    sName.value = s.name || '';
    setFormStatus('');
  }

  async function loadTable() {
    setListStatus('Cargando...');
    rowsEl.innerHTML = '<tr><td colspan="3" class="eval-small">Cargando...</td></tr>';
    const resp = await fetch('/api/students');
    const data = await resp.json().catch(() => ({}));
    const students = data.students || [];
    if (!students.length) {
      rowsEl.innerHTML = '<tr><td colspan="3" class="eval-small">No hay alumnos cargados.</td></tr>';
      setListStatus('');
      return;
    }
    rowsEl.innerHTML = students.map((s) => {
      const sid = String(s.id || '');
      const name = String(s.name || '');
      return `
        <tr data-sid="${escapeHtml(sid)}">
          <td class="mono">${escapeHtml(sid)}</td>
          <td>${escapeHtml(name)}</td>
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
        const sid = tr?.getAttribute('data-sid') || '';
        if (!sid) return;
        try {
          clearForm();
          openModal();
          await loadStudent(sid);
        } catch (e) {
          setFormStatus(String(e?.message || e));
        }
      });
    });

    rowsEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const sid = tr?.getAttribute('data-sid') || '';
        if (!sid) return;
        const ok = window.confirm(`Eliminar alumno?\nDNI: ${sid}`);
        if (!ok) return;
        try {
          setListStatus('Eliminando...');
          const resp2 = await fetch(`/api/students/${encodeURIComponent(sid)}`, { method: 'DELETE' });
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

  function buildPayload() {
    const id = (sId.value || '').trim();
    const name = (sName.value || '').trim();
    if (!id || !name) throw new Error('Completa DNI y nombre');
    return { id, name, student_identifier: id, metadata: {} };
  }

  btnRefresh?.addEventListener('click', () => loadTable().catch(() => setListStatus('Error cargando.')));
  btnNew?.addEventListener('click', () => { clearForm(); openModal(); });

  btnSave?.addEventListener('click', async () => {
    setFormStatus('');
    try {
      const payload = buildPayload();
      const resp = await fetch('/api/students', {
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
    const id = String(sId.value || activeStudentId || '').trim();
    if (!id) return;
    const ok = window.confirm(`Eliminar alumno?\nDNI: ${id}`);
    if (!ok) return;
    try {
      setFormStatus('Eliminando...');
      const resp = await fetch(`/api/students/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(await resp.text());
      closeModal();
      await loadTable();
      setFormStatus('');
    } catch (e) {
      setFormStatus(String(e?.message || e));
    }
  });

  // Boot
  loadTable().catch(() => setListStatus('Error cargando alumnos.'));
})();

