import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Download, CheckSquare, Play, RefreshCw, AlertCircle, CheckCircle, Volume2 } from 'lucide-react'

interface Message {
  role: string
  content: string
  timestamp: number
  message_id: string
  audio_url?: string | null
}

interface SegueItem {
  id: string
  label: string
  area: string
}

interface SegueSection {
  title: string
  area: string
  items: Array<{ id: string; label: string }>
}

interface EvaluationItem {
  id: string
  value: 'yes' | 'no' | 'nc'
  notes: string
}

interface Evaluation {
  id?: string
  encounter_id: string
  patient_id: string
  student_id: string
  student_name: string
  student_identifier?: string
  evaluator_name: string
  items: EvaluationItem[]
}

export default function EvaluatorEncounter() {
  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounter_id') || ''

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  // Encounter info
  const [patientName, setPatientName] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentIdNum, setStudentIdNum] = useState('')
  const [evaluatorName, setEvaluatorName] = useState('')
  const [finishedAt, setFinishedAt] = useState<number | null>(null)

  // Chat and Evaluation states
  const [messages, setMessages] = useState<Message[]>([])
  const [catalog, setCatalog] = useState<{ sections: SegueSection[]; criteria: SegueItem[] }>({ sections: [], criteria: [] })
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  
  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Debounce reference for auto-save
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null)

  // Fetch all initial data
  useEffect(() => {
    if (!encounterId) {
      setErrorMsg('No se especificó un ID de encuentro.')
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        
        // 1. Fetch catalog
        const catResp = await fetch('/api/evaluations/catalog')
        if (!catResp.ok) throw new Error('Error al cargar catálogo SEGUE')
        const catData = await catResp.json()
        setCatalog(catData)

        // 2. Fetch encounter metadata
        const encResp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}`)
        if (!encResp.ok) throw new Error('Encuentro no encontrado')
        const encData = await encResp.json()
        
        setFinishedAt(encData.finished_at)
        setEvaluatorName(encData.evaluator_name || '')

        // Fetch patient and student names to display
        const [patResp, stuResp] = await Promise.all([
          fetch(`/api/patients/${encodeURIComponent(encData.patient_id)}/`),
          encData.student_id ? fetch(`/api/students/${encodeURIComponent(encData.student_id)}/`) : Promise.resolve(null)
        ])

        if (patResp.ok) {
          const p = await patResp.json()
          setPatientName(`${p.name} (${p.age})`)
        } else {
          setPatientName(encData.patient_id)
        }

        if (stuResp && stuResp.ok) {
          const s = await stuResp.json()
          setStudentName(s.name)
          setStudentIdNum(s.student_identifier || s.id)
        } else {
          setStudentName(encData.student_id || '-')
        }

        // 3. Fetch chat history
        const histResp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/history`)
        if (histResp.ok) {
          const histData = await histResp.json()
          const msgs = Array.isArray(histData.visible_messages) ? histData.visible_messages : []
          setMessages(msgs)
        }

        // 4. Fetch evaluation
        const evalResp = await fetch(`/api/evaluations/?encounter_id=${encodeURIComponent(encounterId)}`)
        if (evalResp.ok) {
          const evalData = await evalResp.json()
          if (evalData.evaluation) {
            setEvaluation(evalData.evaluation)
          } else {
            // Build empty evaluation
            const items = catData.criteria.map((c: SegueItem) => ({
              id: c.id,
              value: 'nc' as const,
              notes: ''
            }))
            setEvaluation({
              encounter_id: encounterId,
              patient_id: encData.patient_id,
              student_id: encData.student_id || '',
              student_name: '', // sync in save
              student_identifier: '',
              evaluator_name: encData.evaluator_name || '',
              items
            })
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error cargando datos del encuentro')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [encounterId])

  // WebSocket Connection
  useEffect(() => {
    if (!encounterId || loading) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${proto}://${window.location.host}/ws/encounters/${encodeURIComponent(encounterId)}`
    
    const connect = () => {
      const socket = new WebSocket(wsUrl)
      wsRef.current = socket

      socket.onmessage = (event) => {
        let payload: any = null
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }

        if (payload.type === 'snapshot') {
          setFinishedAt(payload.finished_at)
          const list = Array.isArray(payload.messages) ? payload.messages : []
          setMessages(list.filter((m: any) => m.role !== 'system'))
          return
        }

        if (payload.type === 'message_added' || (payload.role && payload.content)) {
          const msg = payload.type === 'message_added' ? payload.event : payload
          if (msg.role !== 'system') {
            setMessages(prev => {
              if (prev.some(m => m.message_id === msg.message_id)) return prev
              return [...prev, msg]
            })
          }
          return
        }

        if (payload.type === 'tts_update') {
          const evt = payload.event || {}
          if (evt.message_id && evt.tts) {
            setMessages(prev => 
              prev.map(m => m.message_id === evt.message_id ? { ...m, audio_url: evt.tts.audio_url || evt.tts.audio_base64 } : m)
            )
          }
          return
        }

        if (payload.type === 'encounter_finished') {
          setFinishedAt(payload.event?.finished_at || Date.now() / 1000)
          setStatusMsg('Conversación finalizada.')
          return
        }

        if (payload.type === 'encounter_reopened') {
          setFinishedAt(null)
          setStatusMsg('Conversación reactivada.')
        }
      }

      socket.onclose = () => {
        // Reconnect after 3 seconds
        setTimeout(() => connect(), 3000)
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [encounterId, loading])

  // Save/Upsert evaluation
  // silent=true -> no status messages shown (used by auto-save)
  const handleSaveEvaluation = async (updatedEval: Evaluation, silent = false) => {
    if (!updatedEval) return
    
    // Sync names
    const payload = {
      ...updatedEval,
      student_name: studentName,
      student_identifier: studentIdNum,
      evaluator_name: evaluatorName
    }

    try {
      if (!silent) setStatusMsg('Guardando evaluación...')
      const resp = await fetch('/api/evaluations/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      if (data.evaluation) {
        setEvaluation(data.evaluation)
      }
      if (!silent) {
        setStatusMsg('Evaluación guardada exitosamente.')
        setTimeout(() => setStatusMsg(''), 3000)
      }
    } catch (err: any) {
      setStatusMsg(`Error al guardar: ${err.message || err}`)
    }
  }

  // Handle items checklist values modifications
  const handleUpdateItem = (id: string, field: 'value' | 'notes', val: any) => {
    if (!evaluation) return
    
    const updatedItems = evaluation.items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: val }
      }
      return item
    })
    
    const updatedEval = { ...evaluation, items: updatedItems }
    setEvaluation(updatedEval)
    
    // Debounced silent auto-save: espera 800ms desde el último cambio
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      handleSaveEvaluation(updatedEval, true)
    }, 800)
  }

  const handleFinishEncounter = async () => {
    const ok = window.confirm('¿Confirmas finalizar este encuentro?')
    if (!ok) return

    try {
      setStatusMsg('Finalizando encuentro...')
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      })

      if (!resp.ok) throw new Error(await resp.text())
      const data = await resp.json()
      setFinishedAt(data.finished_at)
      setStatusMsg('Encuentro finalizado.')
    } catch (err: any) {
      setStatusMsg(`Error al finalizar: ${err.message || err}`)
    }
  }

  const handleReopenEncounter = async () => {
    try {
      setStatusMsg('Reabriendo encuentro...')
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/reopen`, {
        method: 'POST'
      })

      if (!resp.ok) throw new Error(await resp.text())
      setFinishedAt(null)
      setStatusMsg('Encuentro reabierto.')
    } catch (err: any) {
      setStatusMsg(`Error al reabrir: ${err.message || err}`)
    }
  }

  // Audio playing helper
  const handlePlayAudio = (messageId: string, src: string) => {
    if (playingAudioId === messageId) {
      // Pause
      audioRef.current?.pause()
      setPlayingAudioId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    let audioUrl = src
    // Check if it's base64 data
    if (src.startsWith('UklGR') || !src.includes('/') && !src.includes('http')) {
      audioUrl = `data:audio/wav;base64,${src}`
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setPlayingAudioId(messageId)
    
    audio.play().catch(err => {
      console.error('Audio play error', err)
      setPlayingAudioId(null)
    })

    audio.onended = () => {
      setPlayingAudioId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <RefreshCw className="w-10 h-10 animate-spin text-cyan-800" />
        <span className="text-sm font-semibold text-slate-500">Cargando encuentro...</span>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white border border-rose-100 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
          <AlertCircle className="w-12 h-12 text-rose-600 mb-4 animate-bounce" />
          <h2 className="font-extrabold text-slate-900 text-xl mb-2">Error de Carga</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">{errorMsg}</p>
          <Link to="/evaluator" className="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>
        </div>
      </div>
    )
  }

  const isFinished = finishedAt !== null

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-10">
      {/* Header Info Panel */}
      <header className="bg-white border-b border-slate-200/60 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              to="/evaluator"
              className="w-10 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-xl">Simulación de {patientName}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-2xs font-extrabold tracking-wide uppercase ${
                  isFinished ? 'bg-amber-50 text-amber-700 border border-amber-200/50' : 'bg-teal-50 text-teal-700 border border-teal-200/50'
                }`}>
                  {isFinished ? 'Finalizada' : 'Activa'}
                </span>
              </div>
              <div className="flex items-center gap-x-4 flex-wrap text-xs text-slate-500 mt-1">
                <span>Estudiante: <strong className="text-slate-700 font-semibold">{studentName} ({studentIdNum})</strong></span>
                <span className="text-slate-300">|</span>
                <span>Evaluador: <strong className="text-slate-700 font-semibold">{evaluatorName}</strong></span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {isFinished ? (
              <button 
                onClick={handleReopenEncounter}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-700 font-bold text-xs transition-colors shadow-sm"
              >
                <Play className="w-4 h-4 text-teal-600 fill-teal-600" />
                <span>Reabrir sesión</span>
              </button>
            ) : (
              <button 
                onClick={handleFinishEncounter}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 border border-transparent bg-rose-600 hover:bg-rose-700 rounded-xl text-white font-bold text-xs transition-colors shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Finalizar sesión</span>
              </button>
            )}

            <a 
              href={`/api/evaluations/${encodeURIComponent(encounterId)}/pdf`}
              download
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-800 to-cyan-900 hover:brightness-105 rounded-xl text-white font-bold text-xs transition-all shadow-md shadow-cyan-950/10"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </a>
          </div>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-cyan-900 text-white text-center text-xs font-semibold py-2 animate-in slide-in-from-top duration-300">
          {statusMsg}
        </div>
      )}

      {/* Main Panel Content (Two Columns) */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full flex-1 min-h-0">
        
        {/* Left Column: Chat Transcript */}
        <section className="bg-slate-100 border border-slate-200/50 rounded-3xl p-4 flex flex-col h-[calc(100vh-170px)] min-h-[400px]">
          <div className="flex items-center gap-2 mb-3.5 px-2 flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-cyan-800" />
            <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Transcripción del encuentro</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Aún no hay mensajes en la conversación.
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === 'user'
                const showAudio = m.audio_url
                return (
                  <div 
                    key={m.message_id || m.timestamp} 
                    className={`flex flex-col max-w-[85%] p-4 rounded-2xl shadow-sm border ${
                      isUser 
                        ? 'bg-slate-50 border-slate-200 ml-auto' 
                        : 'bg-white border-slate-100 mr-auto'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-6 mb-1.5">
                      <span className="text-2xs font-bold text-slate-400 uppercase tracking-wide">
                        {isUser ? 'Estudiante' : 'Paciente'}
                      </span>
                      {showAudio && (
                        <button 
                          onClick={() => handlePlayAudio(m.message_id, m.audio_url!)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                            playingAudioId === m.message_id
                              ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500'
                          }`}
                          title="Reproducir audio de voz"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{m.content}</p>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Right Column: SEGUE checklist evaluation */}
        <section className="bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col h-[calc(100vh-170px)] min-h-[400px]">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <CheckSquare className="w-5 h-5 text-cyan-800" />
            <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Habilidades de Comunicación SEGUE</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1.5 scrollbar-thin">
            {catalog.sections.map((section, sIdx) => {
              return (
                <div key={sIdx} className="space-y-3">
                  <h3 className="font-extrabold text-cyan-900 text-xs uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-2.5">
                    <span className="w-5 h-2 bg-gradient-to-r from-teal-300 to-cyan-600 rounded-full" />
                    <span>{section.title}</span>
                  </h3>
                  
                  <div className="space-y-3.5">
                    {section.items.map((item) => {
                      const evalItem = evaluation?.items.find(i => i.id === item.id)
                      const val = evalItem?.value || 'nc'
                      const note = evalItem?.notes || ''
                      
                      return (
                        <div key={item.id} className="p-3 bg-slate-50/50 border border-slate-200/40 rounded-xl space-y-2">
                          <p className="text-xs font-semibold text-slate-700 leading-normal">{item.label}</p>
                          
                          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                            {/* Score Radio buttons */}
                            <div className="flex items-center gap-4">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                                <input 
                                  type="radio" 
                                  name={`item-${item.id}`} 
                                  checked={val === 'yes'}
                                  onChange={() => handleUpdateItem(item.id, 'value', 'yes')}
                                  className="w-4 h-4 text-cyan-800 focus:ring-0" 
                                />
                                <span>Sí</span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                                <input 
                                  type="radio" 
                                  name={`item-${item.id}`} 
                                  checked={val === 'no'}
                                  onChange={() => handleUpdateItem(item.id, 'value', 'no')}
                                  className="w-4 h-4 text-rose-600 focus:ring-0" 
                                />
                                <span>No</span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                                <input 
                                  type="radio" 
                                  name={`item-${item.id}`} 
                                  checked={val === 'nc'}
                                  onChange={() => handleUpdateItem(item.id, 'value', 'nc')}
                                  className="w-4 h-4 text-slate-500 focus:ring-0" 
                                />
                                <span>N/C</span>
                              </label>
                            </div>
                            
                            {/* Notes textarea – resizable vertically */}
                            <textarea
                              placeholder="Observación o nota..."
                              value={note}
                              rows={1}
                              onChange={(e) => handleUpdateItem(item.id, 'notes', e.target.value)}
                              className="flex-1 min-w-[180px] bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-2xs outline-none focus:border-cyan-500 transition-colors resize-y"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
