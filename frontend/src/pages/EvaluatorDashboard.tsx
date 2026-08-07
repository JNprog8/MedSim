import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import EvaluatorLayout from '../components/EvaluatorLayout'
import { Plus, Search, RefreshCw, Eye, Trash2, X, AlertCircle, Play } from 'lucide-react'

interface Encounter {
  encounter_id: string
  patient_id: string
  student_id: string
  evaluator_name: string
  started_at: number
  finished_at: number | null
  patient_name?: string
  patient_label?: string
  student_name?: string
  student_identifier?: string
  student_label?: string
  finished?: boolean
  status_label?: string
}

interface Patient {
  id: string
  name: string
  age: number
}

interface Student {
  id: string
  name: string
  student_identifier?: string
}

export default function EvaluatorDashboard() {
  const navigate = useNavigate()
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [students, setStudents] = useState<Student[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal Start Session State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  
  // New session inputs
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [evaluatorName, setEvaluatorName] = useState('')

  const fetchEncounters = async () => {
    setLoading(true)
    setStatusMsg('Cargando conversaciones...')
    try {
      const resp = await fetch('/api/encounters_public')
      if (!resp.ok) throw new Error('Error al obtener la lista de encuentros')
      const data = await resp.json()
      const list = Array.isArray(data) ? data : (data.encounters || [])
      setEncounters(list)
      setStatusMsg(`${list.length} conversación${list.length === 1 ? '' : 'es'} disponibles`)
    } catch (err: any) {
      setStatusMsg('Error cargando conversaciones.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchFormOptions = async () => {
    try {
      const [patientsResp, studentsResp] = await Promise.all([
        fetch('/api/patients/'),
        fetch('/api/students/')
      ])
      
      if (patientsResp.ok) {
        const data = await patientsResp.json()
        const list = Array.isArray(data) ? data : (data.patients || [])
        setPatients(list)
        if (list.length > 0) setSelectedPatientId(list[0].id)
      }
      
      if (studentsResp.ok) {
        const data = await studentsResp.json()
        const list = Array.isArray(data) ? data : (data.students || [])
        setStudents(list)
        if (list.length > 0) setSelectedStudentId(list[0].id)
      }
    } catch (err) {
      console.error('Error loading form options', err)
    }
  }

  useEffect(() => {
    fetchEncounters()
    fetchFormOptions()
  }, [])

  const handleOpenNewSessionModal = () => {
    setFormError('')
    setIsModalOpen(true)
  }

  const handleDeleteEncounter = async (encounter: Encounter) => {
    const ok = window.confirm(
      `¿Eliminar conversación?\nEncuentro: ${encounter.encounter_id}\nEstudiante: ${encounter.student_label}\n\nEsto borra también audios y la evaluación vinculada.`
    )
    if (!ok) return

    setStatusMsg('Eliminando conversación...')
    try {
      // Calls DELETE /api/evaluations/{encounter_id}/ which cleans up everything in backend
      const resp = await fetch(`/api/evaluations/${encodeURIComponent(encounter.encounter_id)}`, {
        method: 'DELETE'
      })
      if (!resp.ok) throw new Error(await resp.text())
      await fetchEncounters()
    } catch (err: any) {
      setStatusMsg(`Error al eliminar: ${err.message || err}`)
    }
  }

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!selectedPatientId) {
      setFormError('Selecciona un paciente')
      return
    }
    if (!selectedStudentId) {
      setFormError('Selecciona un alumno')
      return
    }
    if (!evaluatorName.trim()) {
      setFormError('Completa el nombre del evaluador/a')
      return
    }

    setFormSaving(true)
    try {
      const resp = await fetch('/api/encounters/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          student_id: selectedStudentId,
          evaluator_name: evaluatorName.trim()
        })
      })

      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      
      setIsModalOpen(false)
      // Redirect to Evaluator Encounter Details
      navigate(`/evaluator_encounter?encounter_id=${encodeURIComponent(data.encounter_id)}`)
    } catch (err: any) {
      setFormError(err.message || 'Error al iniciar la simulación')
    } finally {
      setFormSaving(false)
    }
  }

  const handleOpenEncounter = async (encounter: Encounter) => {
    try {
      // Triggers optional X-Session-Id linking endpoint
      await fetch(`/api/encounters/${encodeURIComponent(encounter.encounter_id)}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
    } catch {}
    navigate(`/evaluator_encounter?encounter_id=${encodeURIComponent(encounter.encounter_id)}`)
  }

  const shortId = (val: string) => {
    if (val.length <= 16) return val
    return `${val.slice(0, 8)}...${val.slice(-6)}`
  }

  // Filtering
  const filteredEncounters = encounters.filter(enc => {
    const student = enc.student_label || enc.student_id || ''
    const patient = enc.patient_label || enc.patient_id || ''
    const evaluator = enc.evaluator_name || ''
    const searchString = `${student} ${patient} ${evaluator} ${enc.encounter_id}`.toLowerCase()
    return searchString.includes(searchTerm.toLowerCase())
  })

  const totalPages = Math.max(1, Math.ceil(filteredEncounters.length / pageSize))
  const startIdx = (currentPage - 1) * pageSize
  const pagedEncounters = filteredEncounters.slice(startIdx, startIdx + pageSize)

  return (
    <EvaluatorLayout activePill="encounters">
      {/* Search and action tools */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="search" 
            placeholder="Buscar por alumno, paciente, evaluador..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchEncounters}
            disabled={loading}
            className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleOpenNewSessionModal}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-800 to-cyan-900 text-white font-bold py-3 px-5 rounded-2xl shadow-lg shadow-cyan-900/10 hover:brightness-105 active:scale-98 transition-all text-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva simulación</span>
          </button>
        </div>
      </div>

      {/* Conversations Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        {statusMsg && (
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-2.5 text-xs font-semibold text-slate-500">
            {statusMsg}
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Estudiante</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Paciente</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Evaluador/a</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Estado</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">ID Encuentro</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedEncounters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    {searchTerm ? 'No hay conversaciones que coincidan con la búsqueda.' : 'No hay conversaciones guardadas.'}
                  </td>
                </tr>
              ) : (
                pagedEncounters.map((enc) => {
                  const finished = enc.finished ?? (enc.finished_at !== null)
                  return (
                    <tr key={enc.encounter_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{enc.student_label || enc.student_id || '-'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{enc.patient_label || enc.patient_id || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{enc.evaluator_name || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          finished 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/50' 
                            : 'bg-teal-50 text-teal-700 border border-teal-200/50'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${finished ? 'bg-amber-600' : 'bg-teal-600'}`} />
                          <span>{finished ? 'Finalizada' : 'Activa'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{shortId(enc.encounter_id)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEncounter(enc)}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-cyan-800 transition-colors"
                            title="Ver encuentro"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteEncounter(enc)}
                            className="p-2 border border-rose-100 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Mostrando <strong>{pagedEncounters.length}</strong> de <strong>{filteredEncounters.length}</strong> conversaciones</span>
            <span className="text-slate-300">|</span>
            <label htmlFor="page-size">Ver</label>
            <select 
              id="page-size" 
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600 font-bold"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500 font-medium">Página {currentPage} de {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal Start Simulation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Nueva simulación clínica</h3>
                <p className="text-xs text-slate-500 mt-1">Configura los participantes del encuentro.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleStartSession}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-600 text-xs font-medium flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
                
                {/* Patient Select */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="patient-select-opt" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Paciente (Caso clínico)
                  </label>
                  <select 
                    id="patient-select-opt"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-100 border-b border-transparent rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm text-slate-700"
                  >
                    {patients.length === 0 ? (
                      <option value="">Cargando pacientes...</option>
                    ) : (
                      patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.age})</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Student Select */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="student-select-opt" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Estudiante asignado
                  </label>
                  <select 
                    id="student-select-opt"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-100 border-b border-transparent rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm text-slate-700"
                  >
                    {students.length === 0 ? (
                      <option value="">Cargando estudiantes...</option>
                    ) : (
                      students.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.student_identifier ? `(${s.student_identifier})` : ''}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Evaluator Name */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="eval-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nombre del Evaluador/a
                  </label>
                  <input 
                    id="eval-name"
                    type="text"
                    value={evaluatorName}
                    onChange={(e) => setEvaluatorName(e.target.value)}
                    placeholder="Ej: Dr. García"
                    className="w-full px-4 py-3 bg-slate-100 border-b border-transparent rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
                  />
                </div>
              </div>
              
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold shadow-sm transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={formSaving || patients.length === 0 || students.length === 0}
                  className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white hover:brightness-105 active:scale-98 text-sm font-bold shadow-lg shadow-cyan-950/10 disabled:opacity-50 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{formSaving ? 'Iniciando...' : 'Iniciar Simulación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </EvaluatorLayout>
  )
}
