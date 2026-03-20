(function () {
  // Elements
  const tableBody = document.getElementById('patient-table-body');
  const searchInput = document.getElementById('search-input');
  const paginationStart = document.getElementById('pagination-start');
  const paginationEnd = document.getElementById('pagination-end');
  const paginationTotal = document.getElementById('pagination-total');
  const paginationControls = document.getElementById('pagination-controls');
  const btnNewPatient = document.getElementById('btn-new-patient');
  const patientModal = document.getElementById('patient-modal');
  const modalTitle = document.getElementById('modal-title');
  const closeModal = document.getElementById('close-modal');
  const cancelModal = document.getElementById('cancel-modal');
  const savePatient = document.getElementById('save-patient');
  const formStatus = document.getElementById('form-status');

  // Form fields
  const patientId = document.getElementById('patient-id');
  const patientFirst = document.getElementById('patient-first');
  const patientLast = document.getElementById('patient-last');
  const patientAge = document.getElementById('patient-age');
  const patientRegion = document.getElementById('patient-region');
  const patientChief = document.getElementById('patient-chief');
  const patientFeel = document.getElementById('patient-feel');
  const patientSymptoms = document.getElementById('patient-symptoms');
  const patientSecret = document.getElementById('patient-secret');
  const patientDisplay = document.getElementById('patient-display');
  const patientResponseStyle = document.getElementById('patient-response-style');
  const patientPersonality = document.getElementById('patient-personality');
  const patientLanguageLevel = document.getElementById('patient-language-level');
  const patientMemoryLevel = document.getElementById('patient-memory-level');
  const patientCognitive = document.getElementById('patient-cognitive');
  const patientSpeakingStyle = document.getElementById('patient-speaking-style');

  // State
  let allPatients = [];
  let filteredPatients = [];
  let currentPage = 1;
  const itemsPerPage = 5;
  let editingPatient = null;

  // Initialize
  loadPatients();
  setupEventListeners();

  function setupEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    btnNewPatient.addEventListener('click', () => openModal());
    closeModal.addEventListener('click', closeModalFunc);
    cancelModal.addEventListener('click', closeModalFunc);
    savePatient.addEventListener('click', savePatientFunc);
    patientModal.addEventListener('click', (e) => {
      if (e.target === patientModal) closeModalFunc();
    });
  }

  async function loadPatients() {
    try {
      const response = await fetch('/api/patients');
      const data = await response.json();
      allPatients = data.patients || [];
      filteredPatients = [...allPatients];
      renderTable();
      updatePagination();
    } catch (error) {
      console.error('Error loading patients:', error);
      tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Error cargando pacientes</td></tr>';
    }
  }

  function handleSearch() {
    const query = searchInput.value.toLowerCase();
    filteredPatients = allPatients.filter(patient =>
      (patient.id || '').toLowerCase().includes(query) ||
      (patient.first_name || '').toLowerCase().includes(query) ||
      (patient.last_name || '').toLowerCase().includes(query) ||
      (patient.region || '').toLowerCase().includes(query)
    );
    currentPage = 1;
    renderTable();
    updatePagination();
  }

  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const patientsToShow = filteredPatients.slice(start, end);

    if (patientsToShow.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-slate-500">No se encontraron pacientes</td></tr>';
      return;
    }

    tableBody.innerHTML = patientsToShow.map(patient => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-4 text-sm text-slate-900">${escapeHtml(patient.name || patient.first_name || '')} <span class="text-slate-500">(${patient.age || 0})</span></td>
        <td class="px-6 py-4 text-sm text-slate-600">${escapeHtml(patient.region || '')}</td>
        <td class="px-6 py-4 text-sm text-slate-600">${escapeHtml(patient.chief_complaint || 'Sin especificar')}</td>
        <td class="px-6 py-4 text-right">
          <button class="px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded transition-colors edit-btn mr-2" data-id="${patient.id || ''}">Editar</button>
          <button class="px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded transition-colors delete-btn" data-id="${patient.id || ''}">Eliminar</button>
        </td>
      </tr>
    `).join('');

    // Add event listeners to buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        editPatient(id);
      });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        deletePatient(id);
      });
    });
  }

  function updatePagination() {
    const totalItems = filteredPatients.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    // Update pagination info
    if (paginationStart) paginationStart.textContent = start;
    if (paginationEnd) paginationEnd.textContent = end;
    if (paginationTotal) paginationTotal.textContent = totalItems;

    // Update page buttons
    const pageButtons = paginationControls.querySelectorAll('button[data-page]');
    pageButtons.forEach(btn => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1 && page <= totalPages) {
        btn.style.display = 'flex';
        btn.classList.toggle('bg-primary', page === currentPage);
        btn.classList.toggle('text-white', page === currentPage);
        btn.classList.toggle('text-slate-600', page !== currentPage);
        btn.classList.toggle('hover:bg-slate-50', page !== currentPage);
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

  function openModal(patient = null) {
    editingPatient = patient;
    if (patient) {
      modalTitle.textContent = 'Editar Paciente';
      populateForm(patient);
    } else {
      modalTitle.textContent = 'Nuevo Paciente';
      clearForm();
    }
    patientModal.classList.remove('hidden');
    formStatus.textContent = '';
  }

  function closeModalFunc() {
    patientModal.classList.add('hidden');
    editingPatient = null;
  }

  function populateForm(patient) {
    patientId.value = patient.id || '';
    patientFirst.value = patient.first_name || '';
    patientLast.value = patient.last_name || '';
    patientAge.value = patient.age || '';
    patientRegion.value = patient.region || '';
    patientChief.value = patient.chief_complaint || '';
    patientFeel.value = patient.feel || '';
    patientSymptoms.value = patient.symptoms ? patient.symptoms.join('\n') : '';
    patientSecret.value = patient.secret || '';
    patientDisplay.value = patient.display || '';
    patientResponseStyle.value = patient.response_style || 'Calmado';
    patientPersonality.value = patient.personality || 'Neutral';
    patientLanguageLevel.value = patient.language_level || 'A';
    patientMemoryLevel.value = patient.memory_level || 'Low';
    patientCognitive.value = patient.cognitive || 'Normal';
    patientSpeakingStyle.value = patient.speaking_style || 'rioplatense';
  }

  function clearForm() {
    patientId.value = '';
    patientFirst.value = '';
    patientLast.value = '';
    patientAge.value = '';
    patientRegion.value = '';
    patientChief.value = '';
    patientFeel.value = '';
    patientSymptoms.value = '';
    patientSecret.value = '';
    patientDisplay.value = '';
    patientResponseStyle.value = 'Calmado';
    patientPersonality.value = 'Neutral';
    patientLanguageLevel.value = 'A';
    patientMemoryLevel.value = 'Low';
    patientCognitive.value = 'Normal';
    patientSpeakingStyle.value = 'rioplatense';
  }

  async function savePatientFunc() {
    const patientData = {
      id: patientId.value.trim(),
      first_name: patientFirst.value.trim(),
      last_name: patientLast.value.trim(),
      age: parseInt(patientAge.value) || 0,
      region: patientRegion.value.trim(),
      chief_complaint: patientChief.value.trim(),
      feel: patientFeel.value.trim(),
      symptoms: patientSymptoms.value.split('\n').map(s => s.trim()).filter(s => s),
      secret: patientSecret.value.trim(),
      display: patientDisplay.value.trim(),
      response_style: patientResponseStyle.value,
      personality: patientPersonality.value,
      language_level: patientLanguageLevel.value,
      memory_level: patientMemoryLevel.value,
      cognitive: patientCognitive.value,
      speaking_style: patientSpeakingStyle.value
    };

    if (!patientData.id || !patientData.first_name || !patientData.last_name) {
      formStatus.textContent = 'ID, nombre y apellido son requeridos';
      return;
    }

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData)
      });

      if (response.ok) {
        closeModalFunc();
        loadPatients();
      } else {
        const error = await response.json();
        formStatus.textContent = error.detail || 'Error guardando paciente';
      }
    } catch (error) {
      console.error('Error saving patient:', error);
      formStatus.textContent = 'Error de conexión';
    }
  }

  async function editPatient(id) {
    try {
      const response = await fetch(`/api/patients/${id}`);
      const data = await response.json();
      openModal(data);
    } catch (error) {
      console.error('Error loading patient:', error);
    }
  }

  async function deletePatient(id) {
    if (!confirm('¿Estás seguro de eliminar este paciente?')) return;

    try {
      const response = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
      if (response.ok) {
        loadPatients();
      } else {
        alert('Error eliminando paciente');
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
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

