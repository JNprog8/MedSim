(function () {
  // Elements
  const tableBody = document.getElementById('student-table-body');
  const searchInput = document.getElementById('search-input');
  const paginationInfo = document.getElementById('pagination-info');
  const paginationControls = document.getElementById('pagination-controls');
  const btnNewStudent = document.getElementById('btn-new-student');
  const studentModal = document.getElementById('student-modal');
  const modalTitle = document.getElementById('modal-title');
  const closeModal = document.getElementById('close-modal');
  const cancelModal = document.getElementById('cancel-modal');
  const saveStudent = document.getElementById('save-student');
  const formStatus = document.getElementById('form-status');

  // Form fields
  const studentDni = document.getElementById('student-dni');
  const studentName = document.getElementById('student-name');

  // State
  let allStudents = [];
  let filteredStudents = [];
  let currentPage = 1;
  const itemsPerPage = 4;
  let editingStudent = null;

  // Initialize
  loadStudents();
  setupEventListeners();

  function setupEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    btnNewStudent.addEventListener('click', () => openModal());
    closeModal.addEventListener('click', closeModalFunc);
    cancelModal.addEventListener('click', closeModalFunc);
    saveStudent.addEventListener('click', saveStudentFunc);
    studentModal.addEventListener('click', (e) => {
      if (e.target === studentModal) closeModalFunc();
    });
  }

  async function loadStudents() {
    try {
      const response = await fetch('/api/students');
      const data = await response.json();
      allStudents = data.students || [];
      filteredStudents = [...allStudents];
      renderTable();
      updatePagination();
    } catch (error) {
      console.error('Error loading students:', error);
      tableBody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Error cargando estudiantes</td></tr>';
    }
  }

  function handleSearch() {
    const query = searchInput.value.toLowerCase();
    filteredStudents = allStudents.filter(student =>
      (student.id || '').toLowerCase().includes(query) ||
      (student.name || '').toLowerCase().includes(query)
    );
    currentPage = 1;
    renderTable();
    updatePagination();
  }

  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const studentsToShow = filteredStudents.slice(start, end);

    if (studentsToShow.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-slate-500">No se encontraron estudiantes</td></tr>';
      return;
    }

    tableBody.innerHTML = studentsToShow.map(student => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-3 text-sm text-slate-600">${escapeHtml(student.id || '')}</td>
        <td class="px-6 py-3 text-sm text-slate-900">${escapeHtml(student.name || '')}</td>
        <td class="px-6 py-3 text-right">
          <button class="px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded transition-colors edit-btn mr-2" data-id="${student.id}">Editar</button>
          <button class="px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded transition-colors delete-btn" data-id="${student.id}">Eliminar</button>
        </td>
      </tr>
    `).join('')

    // Add event listeners to buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        editStudent(id);
      });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        deleteStudent(id);
      });
    });
  }

  function updatePagination() {
    const totalItems = filteredStudents.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    paginationInfo.textContent = `Mostrando ${start} a ${end} de ${totalItems} resultados`;

    // Update page buttons
    const pageButtons = paginationControls.querySelectorAll('button[data-page]');
    pageButtons.forEach(btn => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1 && page <= totalPages) {
        btn.style.display = 'flex';
        btn.classList.toggle('bg-primary', page === currentPage);
        btn.classList.toggle('text-white', page === currentPage);
        btn.classList.toggle('text-slate-600', page !== currentPage);
        btn.classList.toggle('dark:text-slate-300', page !== currentPage);
        btn.classList.toggle('hover:bg-slate-50', page !== currentPage);
        btn.classList.toggle('dark:hover:bg-slate-700', page !== currentPage);
      } else {
        btn.style.display = 'none';
      }
    });

    // Update prev/next
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    prevBtn.classList.toggle('opacity-50', currentPage === 1);
    nextBtn.classList.toggle('opacity-50', currentPage === totalPages);

    // Add click handlers
    pageButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page);
        renderTable();
        updatePagination();
      });
    });
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
      }
    };
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
      }
    };
  }

  function openModal(student = null) {
    editingStudent = student;
    if (student) {
      modalTitle.textContent = 'Editar Estudiante';
      populateForm(student);
    } else {
      modalTitle.textContent = 'Nuevo Estudiante';
      clearForm();
    }
    studentModal.classList.remove('hidden');
    formStatus.textContent = '';
  }

  function closeModalFunc() {
    studentModal.classList.add('hidden');
    editingStudent = null;
  }

  function populateForm(student) {
    studentDni.value = student.id || '';
    studentName.value = student.name || '';
  }

  function clearForm() {
    studentDni.value = '';
    studentName.value = '';
  }

  async function saveStudentFunc() {
    const studentData = {
      id: studentDni.value.trim(),
      name: studentName.value.trim()
    };

    if (!studentData.id || !studentData.name) {
      formStatus.textContent = 'DNI y nombre son requeridos';
      return;
    }

    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
      });

      if (response.ok) {
        closeModalFunc();
        loadStudents();
      } else {
        const error = await response.json();
        formStatus.textContent = error.detail || 'Error guardando estudiante';
      }
    } catch (error) {
      console.error('Error saving student:', error);
      formStatus.textContent = 'Error de conexión';
    }
  }

  async function editStudent(id) {
    try {
      const response = await fetch(`/api/students/${id}`);
      const data = await response.json();
      openModal(data);
    } catch (error) {
      console.error('Error loading student:', error);
    }
  }

  async function deleteStudent(id) {
    if (!confirm('¿Estás seguro de eliminar este estudiante?')) return;

    try {
      const response = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (response.ok) {
        loadStudents();
      } else {
        alert('Error eliminando estudiante');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();