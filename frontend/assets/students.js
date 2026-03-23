(function () {
  const rowsEl = document.getElementById('student-rows');
  const listStatusEl = document.getElementById('list-status');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalStudent = document.getElementById('modal-student');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnNew = document.getElementById('btn-new');
  const btnSave = document.getElementById('btn-save');
  const btnDelete = document.getElementById('btn-delete');
  const searchInput = document.getElementById('search-students');
  const visibleCountEl = document.getElementById('stats-visible-count');
  const totalCountEl = document.getElementById('stats-total-count');
  const pageSizeSelect = document.getElementById('page-size');
  const pagePrevBtn = document.getElementById('page-prev');
  const pageNextBtn = document.getElementById('page-next');
  const pageIndicatorEl = document.getElementById('page-indicator');
  const formStatus = document.getElementById('form-status');
  const sId = document.getElementById('s-id');
  const sName = document.getElementById('s-name');

  let activeStudentId = '';
  let allStudents = [];
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
    modalStudent.style.display = 'block';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    modalStudent.style.display = 'none';
  }

  function clearForm() {
    activeStudentId = '';
    sId.value = '';
    sName.value = '';
    setFormStatus('');
  }

  async function loadStudent(id) {
    const sid = String(id || '').trim();
    if (!sid) return;
    setFormStatus('Cargando alumno...');
    const resp = await fetch(`/api/students/${encodeURIComponent(sid)}/`);
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json().catch(() => ({}));
    const student = data.student || data;
    activeStudentId = String(student.id || '').trim();
    sId.value = student.id || '';
    sName.value = student.name || '';
    setFormStatus('');
  }

  function renderRows() {
    const term = String(searchInput?.value || '').trim().toLowerCase();
    const filtered = allStudents.filter((student) => {
      const haystack = `${student.id || ''} ${student.name || ''}`.toLowerCase();
      return !term || haystack.includes(term);
    });
    const pageSize = Math.max(1, parseInt(pageSizeSelect?.value || '10', 10));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    if (visibleCountEl) visibleCountEl.textContent = String(paged.length);
    if (totalCountEl) totalCountEl.textContent = String(allStudents.length);
    if (pageIndicatorEl) pageIndicatorEl.textContent = `Pagina ${currentPage} de ${totalPages}`;
    if (pagePrevBtn) pagePrevBtn.disabled = currentPage <= 1;
    if (pageNextBtn) pageNextBtn.disabled = currentPage >= totalPages;

    if (!filtered.length) {
      rowsEl.innerHTML = `<tr><td colspan="3" class="eval-small">${term ? 'No hay alumnos que coincidan con la búsqueda.' : 'No hay alumnos cargados.'}</td></tr>`;
      return;
    }

    rowsEl.innerHTML = paged.map((student) => {
      const sid = String(student.id || '');
      const name = String(student.name || '');
      return `
        <tr data-sid="${escapeHtml(sid)}">
          <td class="mono">${escapeHtml(sid)}</td>
          <td>${escapeHtml(name)}</td>
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
        const sid = btn.closest('tr')?.getAttribute('data-sid') || '';
        if (!sid) return;
        try {
          clearForm();
          openModal();
          await loadStudent(sid);
        } catch (error) {
          setFormStatus(String(error?.message || error));
        }
      });
    });

    rowsEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sid = btn.closest('tr')?.getAttribute('data-sid') || '';
        if (!sid) return;
        const ok = window.confirm(`Eliminar alumno?\nDNI: ${sid}`);
        if (!ok) return;
        try {
          setListStatus('Eliminando alumno...');
          const resp = await fetch(`/api/students/${encodeURIComponent(sid)}/`, { method: 'DELETE' });
          if (!resp.ok) throw new Error(await resp.text());
          await loadTable();
        } catch (error) {
          setListStatus(String(error?.message || error));
        }
      });
    });
  }

  async function loadTable() {
    setListStatus('Cargando alumnos...');
    rowsEl.innerHTML = '<tr><td colspan="3" class="eval-small">Cargando alumnos...</td></tr>';
    const resp = await fetch('/api/students/');
    const data = await resp.json().catch(() => ({}));
    allStudents = Array.isArray(data) ? data : (data.students || []);
    renderRows();
    setListStatus(`${allStudents.length} alumno${allStudents.length === 1 ? '' : 's'} cargados`);
  }

  function buildPayload() {
    const id = (sId.value || '').trim();
    const name = (sName.value || '').trim();
    if (!id || !name) throw new Error('Completa DNI y nombre');
    return { id, name, student_identifier: id, metadata: {} };
  }

  document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  modalOverlay?.addEventListener('click', closeModal);
  searchInput?.addEventListener('input', () => { currentPage = 1; renderRows(); });
  pageSizeSelect?.addEventListener('change', () => { currentPage = 1; renderRows(); });
  pagePrevBtn?.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderRows(); });
  pageNextBtn?.addEventListener('click', () => { currentPage += 1; renderRows(); });
  btnRefresh?.addEventListener('click', () => loadTable().catch(() => setListStatus('Error cargando alumnos.')));
  btnNew?.addEventListener('click', () => { clearForm(); openModal(); });

  btnSave?.addEventListener('click', async () => {
    setFormStatus('');
    try {
      const payload = buildPayload();
      const resp = await fetch('/api/students/', {
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
    const id = String(sId.value || activeStudentId || '').trim();
    if (!id) return;
    const ok = window.confirm(`Eliminar alumno?\nDNI: ${id}`);
    if (!ok) return;
    try {
      setFormStatus('Eliminando alumno...');
      const resp = await fetch(`/api/students/${encodeURIComponent(id)}/`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(await resp.text());
      closeModal();
      await loadTable();
    } catch (error) {
      setFormStatus(String(error?.message || error));
    }
  });

  loadTable().catch(() => setListStatus('Error cargando alumnos.'));
})();
