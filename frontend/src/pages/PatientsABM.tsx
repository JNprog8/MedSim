import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import EvaluatorLayout from '../components/EvaluatorLayout'
import { Plus, Search, RefreshCw, Edit2, Trash2, AlertCircle } from 'lucide-react'

interface Patient {
  id: string
  name: string
  age: number
  region: string
  avatar?: string
  voice?: string
  chief_complaint: string
  unknown_real_problem?: string
}

export default function PatientsABM() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [_statusMsg, setStatusMsg] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchPatients = async () => {
    setLoading(true)
    setStatusMsg('')
    try {
      const res = await fetch('/api/patients/')
      if (!res.ok) throw new Error('Error de red al obtener pacientes')
      const data = await res.json()
      setPatients(data)
    } catch (err: any) {
      setStatusMsg(err.message || 'Error al obtener pacientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [])

  const handleDeletePatient = async (id: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el paciente ${id}?`)) return
    
    try {
      const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar paciente')
      fetchPatients()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleOpenNewModal = () => {
    navigate('/patients/new')
  }

  const handleOpenEditModal = (p: Patient) => {
    navigate(`/patients/edit/${p.id}`)
  }

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredPatients.length / pageSize)
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <EvaluatorLayout activePill="patients">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Pacientes</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Gestión de casos clínicos y avatares del simulador.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPatients}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:text-cyan-600 transition-colors shadow-sm text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 transition-all shadow-sm shadow-cyan-600/20 active:scale-95 text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            Nuevo Paciente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden mb-6 flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por ID o Nombre..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mostrar:</span>
            <select 
              value={pageSize} 
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 transition-colors"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 sticky top-0 backdrop-blur-sm z-10">
              <tr>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Nombre (Edad)</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider hidden md:table-cell">Región</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider hidden lg:table-cell">Motivo (Breve)</th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 bg-slate-50/30">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
                        <span className="text-sm font-bold text-slate-600">Cargando pacientes...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-bold text-slate-600">No se encontraron pacientes.</span>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-100/50">
                        {p.id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                          <span className="text-xs font-bold">{p.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{p.name}</div>
                          <div className="text-xs font-medium text-slate-500">{p.age} años</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">
                        {p.region}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="max-w-xs truncate text-slate-600 font-medium" title={p.chief_complaint}>
                        {p.chief_complaint}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePatient(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

        {/* Footer / Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="text-xs font-bold text-slate-500">
            Mostrando {Math.min((currentPage - 1) * pageSize + 1, filteredPatients.length)} a {Math.min(currentPage * pageSize, filteredPatients.length)} de {filteredPatients.length} pacientes
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Anterior
            </button>
            <div className="flex items-center px-3 font-bold text-sm text-slate-600">
              {currentPage} / {Math.max(1, totalPages)}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </EvaluatorLayout>
  )
}
