import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, LogIn, Search, Clock, CheckCircle } from 'lucide-react'

interface StudentPortalProps {
  view: 'join' | 'sessions'
}

interface Encounter {
  encounter_id: string
  patient_id: string
  student_id: string
  evaluator_name: string
  patient_name?: string
  patient_label?: string
  student_name?: string
  student_identifier?: string
  student_label?: string
  finished?: boolean
  status_label?: string
  finished_at: number | null
}

const sessionIdKey = 'medsim_session_id'

export default function StudentPortal({ view: initialView }: StudentPortalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'join' | 'sessions'>(initialView)
  
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [statusMsg, setStatusMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Polling ref
  const pollIntervalRef = useRef<any>(null)

  // Generate / Get Session ID
  useEffect(() => {
    let existing = localStorage.getItem(sessionIdKey)
    if (!existing) {
      existing = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      localStorage.setItem(sessionIdKey, existing)
    }
    setSessionId(existing)
  }, [])

  // Load public encounters
  const fetchEncounters = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const resp = await fetch('/api/encounters_public')
      if (!resp.ok) throw new Error('Error al obtener la lista de encuentros')
      const data = await resp.json()
      const list = Array.isArray(data) ? data : (data.encounters || [])
      setEncounters(list)
      if (!silent) {
        setStatusMsg(`${list.length} sesión${list.length === 1 ? '' : 'es'} cargadas`)
      }
    } catch (err: any) {
      if (!silent) setStatusMsg('Error cargando sesiones.')
      console.error(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Adopt session helper
  const handleAdoptAndGo = async (encId: string) => {
    setStatusMsg('Entrando a la sesión...')
    try {
      const currentSession = localStorage.getItem(sessionIdKey) || sessionId
      await fetch(`/api/encounters/${encodeURIComponent(encId)}/link`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Id': currentSession
        },
        body: '{}'
      })
      navigate(`/student?session_id=${encodeURIComponent(currentSession)}&encounter_id=${encodeURIComponent(encId)}`)
    } catch (err: any) {
      setStatusMsg(`Error al unirse: ${err.message || err}`)
    }
  }

  // Active encounter detector for the auto-join view
  const detectAndAutoJoin = async () => {
    try {
      const resp = await fetch('/api/encounters_public')
      const data = await resp.json()
      const list = Array.isArray(data) ? data : (data.encounters || [])
      const active = list.find((enc: Encounter) => {
        if (!enc || enc.finished_at !== null) return false
        return true
      })

      if (active) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        setStatusMsg('Sesión activa detectada. Entrando automáticamente...')
        await handleAdoptAndGo(active.encounter_id)
      }
    } catch (err) {
      console.error('Error in auto-join poll', err)
    }
  }

  // Manage Tab changes and polling
  useEffect(() => {
    fetchEncounters()

    if (activeTab === 'join') {
      // Start polling for active encounter every 4 seconds
      detectAndAutoJoin()
      pollIntervalRef.current = setInterval(() => {
        detectAndAutoJoin()
      }, 4000)
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [activeTab])

  // Filter & Paginate sessions
  const filteredEncounters = encounters.filter(enc => {
    const student = enc.student_label || enc.student_id || ''
    const patient = enc.patient_label || enc.patient_id || ''
    const evaluator = enc.evaluator_name || ''
    const hay = `${student} ${patient} ${evaluator}`.toLowerCase()
    return hay.includes(searchTerm.toLowerCase())
  })

  const totalPages = Math.max(1, Math.ceil(filteredEncounters.length / pageSize))
  const startIdx = (currentPage - 1) * pageSize
  const pagedEncounters = filteredEncounters.slice(startIdx, startIdx + pageSize)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 py-4 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              to="/index" 
              className="w-10 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-extrabold text-cyan-900 text-2xl md:text-3xl tracking-tight leading-none">
                MedSim
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">Portal del Estudiante</p>
            </div>
          </div>
          
          <div className="hidden sm:flex flex-col items-end text-2xs text-slate-400 font-mono">
            <span>Session ID</span>
            <span className="font-semibold text-slate-500">{sessionId}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-10">
        
        {/* Toggle navigation tabs */}
        <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mb-8">
          <button 
            onClick={() => setActiveTab('join')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm transition-all ${
              activeTab === 'join' 
                ? 'bg-white text-cyan-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Esperar Sesión</span>
          </button>
          <button 
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm transition-all ${
              activeTab === 'sessions' 
                ? 'bg-white text-cyan-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>Historial de Sesiones</span>
          </button>
        </div>

        {statusMsg && (
          <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 mb-6 text-cyan-800 text-xs font-semibold text-center">
            {statusMsg}
          </div>
        )}

        {/* Render Tab Contents */}
        {activeTab === 'join' ? (
          /* Tab 1: Wait / Join Session */
          <section className="bg-white border border-slate-200/60 rounded-3xl p-8 md:p-12 shadow-sm text-center flex flex-col items-center max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-cyan-50 flex items-center justify-center mb-6 relative">
              <span className="absolute inset-0 rounded-full bg-cyan-100 animate-ping opacity-60" />
              <Clock className="w-10 h-10 text-cyan-800 animate-pulse relative z-10" />
            </div>
            <h2 className="font-extrabold text-slate-900 text-2xl mb-3">Esperando sesión de simulación</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6 max-w-sm">
              Por favor, aguarda a que el evaluador/a inicie la sesión desde su panel de control. El simulador se cargará automáticamente al detectar tu encuentro.
            </p>
            <div className="flex items-center gap-2 text-xs text-cyan-900 bg-cyan-50/50 px-4 py-2.5 rounded-full font-bold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Buscando simulación activa...</span>
            </div>
          </section>
        ) : (
          /* Tab 2: Sessions list table */
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
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
              <button 
                onClick={() => fetchEncounters()}
                disabled={loading}
                className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 self-end sm:self-auto"
                title="Refrescar lista"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Estudiante</th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Paciente</th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Evaluador/a</th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Estado</th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedEncounters.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                          {loading ? 'Cargando sesiones...' : 'No hay sesiones disponibles por ahora.'}
                        </td>
                      </tr>
                    ) : (
                      pagedEncounters.map((enc) => {
                        const finished = enc.finished ?? (enc.finished_at !== null)
                        return (
                          <tr key={enc.encounter_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800">{enc.student_label || enc.student_id || '-'}</td>
                            <td className="px-6 py-4 font-semibold text-slate-600">{enc.patient_label || enc.patient_id || '-'}</td>
                            <td className="px-6 py-4 text-slate-500">{enc.evaluator_name || '-'}</td>
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
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleAdoptAndGo(enc.encounter_id)}
                                className="inline-flex items-center gap-1 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-700 font-extrabold text-xs transition-colors shadow-sm"
                              >
                                <LogIn className="w-3.5 h-3.5 text-cyan-800" />
                                <span>Entrar</span>
                              </button>
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
                  <span>Mostrando <strong>{pagedEncounters.length}</strong> de <strong>{filteredEncounters.length}</strong> sesiones</span>
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
          </section>
        )}
      </main>
    </div>
  )
}
