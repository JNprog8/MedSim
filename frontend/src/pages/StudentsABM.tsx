import { useState, useEffect } from 'react'
import EvaluatorLayout from '../components/EvaluatorLayout'
import { Plus, Search, RefreshCw, Edit2, Trash2, X, AlertCircle } from 'lucide-react'

interface Student {
  id: string
  name: string
  student_identifier?: string
  metadata?: Record<string, any>
}

export default function StudentsABM() {
  const [students, setStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  
  // Form fields
  const [studentId, setStudentId] = useState('') // DNI
  const [studentName, setStudentName] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  const fetchStudents = async () => {
    setLoading(true)
    setStatusMsg('Cargando alumnos...')
    try {
      const resp = await fetch('/api/students/')
      if (!resp.ok) throw new Error('Error al obtener la lista de estudiantes')
      const data = await resp.json()
      const list = Array.isArray(data) ? data : (data.students || [])
      setStudents(list)
      setStatusMsg(`${list.length} alumno${list.length === 1 ? '' : 's'} cargados`)
    } catch (err: any) {
      setStatusMsg('Error cargando alumnos.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const handleOpenNewModal = () => {
    setIsEditMode(false)
    setStudentId('')
    setStudentName('')
    setFormError('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (student: Student) => {
    setIsEditMode(true)
    setStudentId(student.id)
    setStudentName(student.name)
    setFormError('')
    setIsModalOpen(true)
  }

  const handleDeleteStudent = async (student: Student) => {
    const ok = window.confirm(`¿Eliminar alumno?\nDNI: ${student.id}\nNombre: ${student.name}`)
    if (!ok) return
    
    setStatusMsg('Eliminando alumno...')
    try {
      const resp = await fetch(`/api/students/${encodeURIComponent(student.id)}/`, {
        method: 'DELETE'
      })
      if (!resp.ok) throw new Error(await resp.text())
      await fetchStudents()
    } catch (err: any) {
      setStatusMsg(`Error al eliminar: ${err.message || err}`)
    }
  }

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    
    const id = studentId.trim()
    const name = studentName.trim()
    
    if (!id || !name) {
      setFormError('Completa DNI/Legajo y Nombre completo')
      return
    }
    
    setFormSaving(true)
    try {
      const payload = {
        id,
        name,
        student_identifier: id,
        metadata: {}
      }
      
      const resp = await fetch('/api/students/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!resp.ok) throw new Error(await resp.text())
      
      setIsModalOpen(false)
      await fetchStudents()
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el estudiante')
    } finally {
      setFormSaving(false)
    }
  }

  // Filtering & Pagination
  const filteredStudents = students.filter(student => {
    const hay = `${student.id} ${student.name}`.toLowerCase()
    return hay.includes(searchTerm.toLowerCase())
  })

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize))
  const startIdx = (currentPage - 1) * pageSize
  const pagedStudents = filteredStudents.slice(startIdx, startIdx + pageSize)

  return (
    <EvaluatorLayout activePill="students">
      {/* Top Search and Action tools */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="search" 
            placeholder="Buscar por DNI o nombre..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchStudents}
            disabled={loading}
            className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleOpenNewModal}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-800 to-cyan-900 text-white font-bold py-3 px-5 rounded-2xl shadow-lg shadow-cyan-900/10 hover:brightness-105 active:scale-98 transition-all text-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo estudiante</span>
          </button>
        </div>
      </div>

      {/* Main Table Panel */}
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
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">DNI / Legajo</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Nombre y Apellido</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                    {searchTerm ? 'No hay alumnos que coincidan con la búsqueda.' : 'No hay alumnos cargados.'}
                  </td>
                </tr>
              ) : (
                pagedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-600">{student.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{student.name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(student)}
                          className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStudent(student)}
                          className="p-2 border border-rose-100 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Mostrando <strong>{pagedStudents.length}</strong> de <strong>{filteredStudents.length}</strong> alumnos</span>
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

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          
          {/* Dialog Content */}
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {isEditMode ? 'Editar Estudiante' : 'Nuevo Estudiante'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Completa los datos del alumno.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveStudent}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-600 text-xs font-medium flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
                  <label htmlFor="student-id" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    DNI / Legajo (ID)
                  </label>
                  <input 
                    id="student-id"
                    type="text"
                    disabled={isEditMode}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Ej: 38234567"
                    className="w-full px-4 py-3 bg-slate-100 border-b border-transparent rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm disabled:opacity-60"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="student-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nombre completo
                  </label>
                  <input 
                    id="student-name"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
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
                  disabled={formSaving}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white hover:brightness-105 active:scale-98 text-sm font-bold shadow-lg shadow-cyan-950/10 disabled:opacity-50 transition-all"
                >
                  {formSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </EvaluatorLayout>
  )
}
