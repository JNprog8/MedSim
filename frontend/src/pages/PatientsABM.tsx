import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import EvaluatorLayout from '../components/EvaluatorLayout'
import { Plus, Search, RefreshCw, Edit2, Trash2, AlertCircle } from 'lucide-react'

interface Patient {
  id: string
  name: string
  last_name?: string
  age: number
  region?: string
  avatar?: string
  voice?: string
  chief_complaint?: string
  doctor_display_real_problem?: string
  unknown_real_problem?: string
  true_case?: {
    diagnostico_principal?: string
  }
  administrative?: {
    full_name?: string
  }
}

export default function PatientsABM() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [_statusMsg, setStatusMsg] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

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

  const filteredPatients = patients.filter(p => {
    const fullName = `${p.name} ${p.last_name || ''}`.toLowerCase()
    const search = searchTerm.toLowerCase()
    const diag = (p.true_case?.diagnostico_principal || p.doctor_display_real_problem || p.unknown_real_problem || '').toLowerCase()
    return fullName.includes(search) || p.id.toLowerCase().includes(search) || diag.includes(search)
  })

  const totalPages = Math.ceil(filteredPatients.length / pageSize)
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <EvaluatorLayout activePill="patients">
      {/* Top Search and Action tools */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="search" 
            placeholder="Buscar por Nombre o Diagnóstico..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchPatients}
            disabled={loading}
            className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleOpenNewModal}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-800 to-cyan-900 text-white font-bold py-3 px-5 rounded-2xl shadow-lg shadow-cyan-950/10 hover:brightness-105 active:scale-98 transition-all text-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo paciente</span>
          </button>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Nombre</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Edad</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Diagnóstico Principal</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
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
                paginatedPatients.map((p) => {
                  const fullName = (p.last_name && p.last_name.trim()) ? `${p.name} ${p.last_name}` : (p.administrative?.full_name || p.name)
                  const diag = p.true_case?.diagnostico_principal || p.doctor_display_real_problem || p.unknown_real_problem || '-'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200/60 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold">{fullName.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-bold text-slate-800">{fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {p.age} años
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/50 max-w-md truncate" title={diag}>
                          {diag}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEditModal(p)}
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeletePatient(p.id)}
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
