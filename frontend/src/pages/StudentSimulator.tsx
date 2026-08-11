import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send, Mic, RefreshCw, AlertCircle, Volume2, Sparkles, Clipboard, ShieldCheck, HeartPulse, User, X } from 'lucide-react'

interface Message {
  role: string
  content: string
  message_id?: string
  audio_url?: string | null
}

interface PatientView {
  id: string
  name: string
  last_name?: string
  age: number
  region: string
  chief_complaint: string
  what_they_feel: string
  symptoms_reported?: string[]
  administrative?: Record<string, any>
  triage?: Record<string, any>
  institutional_history?: Record<string, any>
  recent_studies?: Record<string, any>
}

// Float PCM conversion utilities from legacy student_audio.js
function floatTo16BitPCM(float32Array: Float32Array) {
  const pcm = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]))
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
  }
  return pcm
}

function mergeAudioChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

function encodeWavBlob(chunks: Float32Array[], sampleRate: number) {
  const audioData = mergeAudioChunks(chunks)
  const pcmData = floatTo16BitPCM(audioData)
  const buffer = new ArrayBuffer(44 + pcmData.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + pcmData.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, pcmData.length * 2, true)

  let offset = 44
  for (const sample of pcmData) {
    view.setInt16(offset, sample, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export default function StudentSimulator() {
  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounter_id') || ''
  const sessionId = searchParams.get('session_id') || localStorage.getItem('medsim_session_id') || ''

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  // Encounter active/finished state
  const [chatLocked, setChatLocked] = useState(false)

  // Simulation Data
  const [messages, setMessages] = useState<Message[]>([])
  const [patient, setPatient] = useState<PatientView | null>(null)

  // Input fields
  const [textInput, setTextInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Audio state
  const [audioConfig, setAudioConfig] = useState<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState('Micrófono listo')

  // Audio playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null)

  // Recorder Refs
  const recordingContextRef = useRef<AudioContext | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const audioChunksRef = useRef<Float32Array[]>([])

  // Speech Recognition Ref (Browser Native STT fallback)
  const recognitionRef = useRef<any>(null)

  // Messages container ref for scrolling
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Fetch initial student view
  const fetchStudentView = async () => {
    try {
      setLoading(true)

      // Load public configurations
      const configResp = await fetch('/api/config_state')
      if (configResp.ok) {
        const cData = await configResp.json()
        setAudioConfig(cData.audio)
      }

      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/student_view`, {
        headers: { 'X-Session-Id': sessionId }
      })
      if (!resp.ok) throw new Error('No se pudo unir a la consulta del estudiante')
      const data = await resp.json()

      setPatient(data.patient)
      setChatLocked(data.finished_at !== null)

      // Fetch history
      const histResp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/history`, {
        headers: { 'X-Session-Id': sessionId }
      })
      if (histResp.ok) {
        const histData = await histResp.json()
        const list = Array.isArray(histData.visible_messages) ? histData.visible_messages : []
        setMessages(list.filter((m: any) => m.role !== 'system'))
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con la consulta')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!encounterId) {
      setErrorMsg('Falta especificar el ID del encuentro.')
      setLoading(false)
      return
    }
    fetchStudentView()
  }, [encounterId])

  // Setup WS connection
  useEffect(() => {
    if (!encounterId || loading) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/ws/encounters/${encodeURIComponent(encounterId)}?session_id=${encodeURIComponent(sessionId)}`

    const connect = () => {
      const socket = new WebSocket(url)
      wsRef.current = socket

      socket.onmessage = (event) => {
        let payload: any = null
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }

        if (payload.type === 'snapshot') {
          setChatLocked(payload.finished_at !== null)
          const list = Array.isArray(payload.messages) ? payload.messages : []
          setMessages(list.filter((m: any) => m.role !== 'system'))
          return
        }

        if (payload.type === 'message_added' || (payload?.role && payload?.content)) {
          const msg = payload.type === 'message_added' ? payload.event : payload
          if (msg && msg.role && msg.role !== 'system') {
            if (msg.role === 'assistant') {
              setIsTyping(false)
            } else {
              setIsTyping(true)
            }
            setMessages(prev => {
              if (prev.some(m => m.message_id === msg.message_id)) return prev

              // Autoplay patient speech if it's the assistant replying
              if (msg.role === 'assistant' && msg.audio_url) {
                setTimeout(() => {
                  handlePlayAudio(msg.message_id, msg.audio_url)
                }, 100)
              }
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
            // Autoplay newly synthesized TTS audio immediately
            handlePlayAudio(evt.message_id, evt.tts.audio_url || evt.tts.audio_base64)
          }
          return
        }

        if (payload.type === 'encounter_finished') {
          setChatLocked(true)
          setStatusMsg('El encuentro ha sido finalizado por el evaluador.')
          return
        }

        if (payload.type === 'encounter_reopened') {
          setChatLocked(false)
          setStatusMsg('El encuentro ha sido reabierto.')
        }
      }

      socket.onclose = () => {
        setTimeout(() => connect(), 3000)
      }
    }

    connect()

    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [encounterId, loading])

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Speech Recognition configuration
  useEffect(() => {
    const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognitionApi) {
      const rec = new SpeechRecognitionApi()
      rec.lang = 'es-AR'
      rec.continuous = true
      rec.interimResults = true

      rec.onresult = () => {
        // Voice is processed on the backend, do not write to text input to keep it clean.
      }

      recognitionRef.current = rec
    }
  }, [])

  // Audio Playback handler
  const handlePlayAudio = (messageId: string | undefined, src: string | null | undefined) => {
    if (!messageId || !src) return

    if (playingAudioId === messageId) {
      audioRef.current?.pause()
      setPlayingAudioId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    let audioUrl = src
    if (src.startsWith('UklGR') || !src.includes('/') && !src.includes('http')) {
      audioUrl = `data:audio/wav;base64,${src}`
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setPlayingAudioId(messageId)
    audio.play().catch(() => setPlayingAudioId(null))

    audio.onended = () => {
      setPlayingAudioId(null)
    }
  }

  // Text message submission
  const handleSendText = async () => {
    const text = textInput.trim()
    if (!text || chatLocked) return

    setTextInput('')
    setIsTyping(true)

    try {
      const formData = new FormData()
      formData.append('message', text)
      formData.append('encounter_id', encounterId)
      formData.append('patient_id', patient?.id || '')

      const ttsConfigured = audioConfig?.tts_api_key_configured || audioConfig?.tts_configured
      if (ttsConfigured) {
        formData.append('include_tts', 'true')
      }

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
        body: formData
      })

      if (!resp.ok) throw new Error('Error al enviar mensaje')
      const data = await resp.json()
      if (data.assistant_message) {
        setIsTyping(false)
        setMessages(prev => {
          let updated = prev
          if (data.assistant_message && !updated.some(m => m.message_id === data.assistant_message.message_id)) {
            updated = [...updated, data.assistant_message]
          }
          return updated
        })
      }
    } catch (err: any) {
      setIsTyping(false)
      setStatusMsg(`Error al enviar mensaje: ${err.message}`)
    }
  }

  // Audio recording toggling
  const handleToggleRecord = async () => {
    if (isRecording) {
      // STOP recording
      setIsRecording(false)
      setRecordingStatus('Procesando audio...')

      if (recordingProcessorRef.current) {
        recordingProcessorRef.current.disconnect()
        recordingProcessorRef.current = null
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => track.stop())
        recordingStreamRef.current = null
      }

      // Stop speech recognition dictation and clear text input field
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setTextInput('')

      const sampleRate = recordingContextRef.current?.sampleRate || 44100
      const audioBlob = encodeWavBlob(audioChunksRef.current, sampleRate)

      // Upload recording blob to /api/audio_turn
      setIsTyping(true)
      try {
        const formData = new FormData()
        formData.append('file', audioBlob, 'recording.wav')
        formData.append('encounter_id', encounterId)
        formData.append('patient_id', patient?.id || '')

        const resp = await fetch('/api/audio_turn', {
          method: 'POST',
          headers: { 'X-Session-Id': sessionId },
          body: formData
        })

        if (!resp.ok) throw new Error('Error al enviar audio al servidor')
        const data = await resp.json()
        setRecordingStatus('Micrófono listo')

        if (data.assistant_message) {
          setIsTyping(false)
          setMessages(prev => {
            let updated = [...prev]
            if (data.user_text && !updated.some(m => m.content === data.user_text && m.role === 'user')) {
              updated.push({ role: 'user', content: data.user_text })
            }
            if (data.assistant_message && !updated.some(m => m.message_id === data.assistant_message.message_id)) {
              updated.push(data.assistant_message)
              if (data.assistant_message.audio_url || data.assistant_audio?.audio_url) {
                const url = data.assistant_message.audio_url || data.assistant_audio?.audio_url
                setTimeout(() => {
                  handlePlayAudio(data.assistant_message.message_id, url)
                }, 100)
              }
            }
            return updated
          })
        }
      } catch (err: any) {
        setIsTyping(false)
        setRecordingStatus('Error al enviar audio')
        setStatusMsg(`Audio error: ${err.message}`)
      }
    } else {
      // START recording
      if (chatLocked) return

      try {
        audioChunksRef.current = []
        setRecordingStatus('Grabando...')
        setIsRecording(true)

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        recordingStreamRef.current = stream

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AudioCtx()
        recordingContextRef.current = ctx

        const source = ctx.createMediaStreamSource(stream)
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        recordingProcessorRef.current = processor

        processor.onaudioprocess = (e) => {
          const channelData = e.inputBuffer.getChannelData(0)
          audioChunksRef.current.push(new Float32Array(channelData))
        }

        source.connect(processor)
        processor.connect(ctx.destination)

        // Web Speech API browser dictation fallback in background
        if (recognitionRef.current) {
          recognitionRef.current.start()
        }
      } catch (err) {
        console.error('Mic recording error', err)
        setIsRecording(false)
        setRecordingStatus('Error de acceso al micrófono')
      }
    }
  }

  // Close session modal reveal logic
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [finishSaving, setFinishSaving] = useState(false)
  const [finalDiagnosis, setFinalDiagnosis] = useState('')
  const [diffDiagnosis, setDiffDiagnosis] = useState('')
  const [planInstructions, setPlanInstructions] = useState('')
  const [rxPrescription, setRxPrescription] = useState('')

  // Results view model
  const [trueCaseResult, setTrueCaseResult] = useState<any>(null)

  const handleFinishSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFinishError('')

    if (!finalDiagnosis.trim()) {
      setFinishError('Ingresa tu hipótesis de diagnóstico principal')
      return
    }

    setFinishSaving(true)
    try {
      const resp = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({
          success: true,
          final_diagnosis: finalDiagnosis.trim(),
          differential: diffDiagnosis.trim(),
          plan: planInstructions.trim(),
          prescription: rxPrescription.trim()
        })
      })

      if (!resp.ok) throw new Error('Error al enviar conclusiones')
      const data = await resp.json()
      setTrueCaseResult(data)
      setChatLocked(true)
      localStorage.setItem('medsim_finished_encounter_' + encounterId, 'true')
    } catch (err: any) {
      setFinishError(err.message || 'Error al procesar conclusiones')
    } finally {
      setFinishSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <RefreshCw className="w-10 h-10 animate-spin text-cyan-800" />
        <span className="text-sm font-semibold text-slate-500">Iniciando simulador...</span>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white border border-rose-100 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
          <AlertCircle className="w-12 h-12 text-rose-600 mb-4 animate-bounce" />
          <h2 className="font-extrabold text-slate-900 text-xl mb-2">Simulación no disponible</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">{errorMsg}</p>
          <Link to="/student_join" className="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Portal</span>
          </Link>
        </div>
      </div>
    )
  }

  const sttConfigured = audioConfig?.stt_api_key_configured || audioConfig?.stt_configured

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/60 py-3.5 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/index"
              className="w-9 h-9 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors shadow-sm"
              aria-label="Salir"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-extrabold text-cyan-900 text-lg leading-none">Consultorio Virtual</h1>
              <p className="text-2xs text-slate-500 font-medium mt-1 uppercase tracking-wide">Paciente: {patient?.name} {patient?.last_name || ''} ({patient?.age} años)</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (trueCaseResult) {
                setIsFinishModalOpen(true)
              } else {
                setFinalDiagnosis('')
                setDiffDiagnosis('')
                setPlanInstructions('')
                setRxPrescription('')
                setFinishError('')
                setIsFinishModalOpen(true)
              }
            }}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:brightness-105 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-950/10 transition-all active:scale-98"
          >
            {trueCaseResult ? 'Ver Resultados' : 'Finalizar Consulta'}
          </button>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-cyan-900 text-white text-center text-xs font-semibold py-2">
          {statusMsg}
        </div>
      )}

      {/* Main Grid: Chat Left, Medical record right */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 min-h-0">

        {/* Left Section: Chat (col span 7) */}
        <section className="lg:col-span-7 flex flex-col h-[calc(100vh-170px)] min-h-[400px]">
          <div className="flex-1 bg-white border border-slate-200/60 rounded-3xl p-4 flex flex-col min-h-0 shadow-sm">

            {/* Messages box */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3">
                  <Sparkles className="w-8 h-8 text-cyan-800 animate-pulse" />
                  <p className="text-slate-700 font-bold text-sm">Inicia la conversación</p>
                  <p className="text-slate-400 text-xs max-w-xs">Saluda al paciente y pregúntale cuál es el motivo de su visita hoy.</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isUser = m.role === 'user'
                  return (
                    <div
                      key={m.message_id || idx}
                      className={`flex flex-col max-w-[85%] p-4 rounded-2xl shadow-sm border ${isUser
                        ? 'bg-slate-50 border-slate-200 ml-auto'
                        : 'bg-cyan-50/20 border-cyan-100 mr-auto'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-6 mb-1.5">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wide">
                          {isUser ? 'Tú (Médico)' : 'Paciente'}
                        </span>
                        {m.audio_url && (
                          <button
                            onClick={() => handlePlayAudio(m.message_id, m.audio_url)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${playingAudioId === m.message_id
                              ? 'bg-cyan-100 border-cyan-300 text-cyan-800 animate-pulse'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
                              }`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{m.content}</p>
                    </div>
                  )
                })
              )}

              {/* Typing indicator */}
              {isTyping && (
                <div className="bg-white border border-slate-100 mr-auto flex flex-col max-w-[80%] p-4 rounded-2xl shadow-sm animate-pulse">
                  <span className="text-2xs font-bold text-slate-400 uppercase tracking-wide mb-1">Paciente</span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>El paciente está pensando...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={chatLocked}
                  placeholder={chatLocked ? 'Consulta finalizada' : 'Escribe tu pregunta al paciente y presiona Enter...'}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendText(); }}
                  className="flex-1 px-4 py-3 bg-slate-100 border-b border-transparent rounded-2xl outline-none focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm disabled:opacity-60"
                />
                <button
                  onClick={handleSendText}
                  disabled={chatLocked || !textInput.trim()}
                  className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-cyan-800 to-cyan-900 text-white rounded-2xl shadow-md hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Audio controls */}
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/40">
                <button
                  type="button"
                  disabled={chatLocked || !sttConfigured}
                  onClick={handleToggleRecord}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${isRecording
                    ? 'bg-rose-100 border border-rose-200 text-rose-600 animate-pulse'
                    : 'bg-white border border-slate-200 text-cyan-800 hover:bg-slate-50 disabled:opacity-50 shadow-sm'
                    }`}
                  title="Hablar por micrófono"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{recordingStatus}</span>
                  <span className="text-3xs text-slate-400">
                    {!sttConfigured ? 'Audio STT no disponible' : isRecording ? 'Presiona de nuevo para enviar la grabación' : 'Mantén pulsado o presiona para dictar tu voz'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Right Section: Medical records file (col span 5) */}
        <section className="lg:col-span-5 h-[calc(100vh-170px)] min-h-[400px] overflow-y-auto bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-6 scrollbar-thin">
          <div className="flex items-center gap-2 pb-3.5 border-b border-slate-100 flex-shrink-0">
            <Clipboard className="w-5 h-5 text-cyan-800" />
            <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Ficha Clínica del Paciente</h2>
          </div>

          {!patient ? (
            <div className="text-center text-slate-400 italic text-xs py-8">
              No hay datos clínicos cargados.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Card Summary */}
              <div className="p-4 bg-gradient-to-tr from-sky-50 to-teal-50/50 rounded-2xl border border-sky-100/60 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-cyan-800 shadow-sm flex-shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-cyan-900 text-base leading-none">{patient.name} {patient.last_name || ''}</h3>
                  <span className="text-xs text-slate-500 font-semibold block mt-1.5">
                    Edad: {patient.age} años | Origen: {patient.region}
                  </span>
                </div>
              </div>

              {/* Identity metadata */}
              {patient.administrative && (
                <div className="space-y-2">
                  <h4 className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Datos de Identificación</span>
                  </h4>
                  <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-3 text-xs space-y-2">
                    {patient.administrative.dni && (
                      <div className="flex justify-between"><span className="text-slate-500">DNI/Legajo</span><span className="font-bold text-slate-800">{patient.administrative.dni}</span></div>
                    )}
                    {patient.administrative.date_of_birth && (
                      <div className="flex justify-between"><span className="text-slate-500">Fecha Nacimiento</span><span className="font-bold text-slate-800">{patient.administrative.date_of_birth}</span></div>
                    )}
                    {patient.administrative.insurance && (
                      <div className="flex justify-between"><span className="text-slate-500">Obra Social / Prepaga</span><span className="font-bold text-slate-800">{patient.administrative.insurance}</span></div>
                    )}
                    {patient.administrative.sex && (
                      <div className="flex justify-between"><span className="text-slate-500">Sexo</span><span className="font-bold text-slate-800">{patient.administrative.sex}</span></div>
                    )}
                    {patient.administrative.occupation && (
                      <div className="flex justify-between"><span className="text-slate-500">Ocupación</span><span className="font-bold text-slate-800">{patient.administrative.occupation}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Triage */}
              {patient.triage?.reference_short && (
                <div className="space-y-2">
                  <h4 className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Motivo de consulta (Triage)</h4>
                  <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-3 text-xs text-slate-800 font-semibold leading-relaxed">
                    {patient.triage.reference_short}
                  </div>
                </div>
              )}

              {/* Clinical History List */}
              {patient.institutional_history && (
                <div className="space-y-2.5">
                  <h4 className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Historia Clínica Institucional</span>
                  </h4>
                  <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-3.5 space-y-4">
                    {/* Allergies */}
                    {Array.isArray(patient.institutional_history.allergies) && patient.institutional_history.allergies.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-2xs font-extrabold text-red-700 uppercase tracking-wider">Alergias</span>
                        <ul className="list-disc pl-4 text-xs font-semibold text-red-800 space-y-1">
                          {patient.institutional_history.allergies.map((a: string, i: number) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Diagnoses */}
                    {Array.isArray(patient.institutional_history.diagnoses) && patient.institutional_history.diagnoses.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Diagnósticos previos</span>
                        <ul className="list-disc pl-4 text-xs font-semibold text-slate-800 space-y-1">
                          {patient.institutional_history.diagnoses.map((d: string, i: number) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Surgeries */}
                    {Array.isArray(patient.institutional_history.surgeries) && patient.institutional_history.surgeries.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Cirugías previas</span>
                        <ul className="list-disc pl-4 text-xs font-semibold text-slate-800 space-y-1">
                          {patient.institutional_history.surgeries.map((s: string, i: number) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Medications */}
                    {Array.isArray(patient.institutional_history.medications_current) && patient.institutional_history.medications_current.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Medicación habitual</span>
                        <ul className="list-disc pl-4 text-xs font-semibold text-slate-800 space-y-1">
                          {patient.institutional_history.medications_current.map((m: string, i: number) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent studies */}
              {patient.recent_studies && (
                <div className="space-y-2.5">
                  <h4 className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Estudios clínicos recientes</h4>
                  <div className="bg-slate-50 border border-slate-200/40 rounded-xl p-3.5 space-y-4">
                    {/* Labs */}
                    {Array.isArray(patient.recent_studies.labs) && patient.recent_studies.labs.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Laboratorios</span>
                        <ul className="list-disc pl-4 text-xs font-semibold text-slate-800 space-y-1">
                          {patient.recent_studies.labs.map((l: string, i: number) => <li key={i}>{l}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Imaging */}
                    {Array.isArray(patient.recent_studies.imaging) && patient.recent_studies.imaging.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Imágenes / ECG</span>
                        <ul className="list-disc pl-4 text-xs font-semibold text-slate-800 space-y-1">
                          {patient.recent_studies.imaging.map((img: string, i: number) => <li key={i}>{img}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Notes */}
                    {Array.isArray(patient.recent_studies.notes) && patient.recent_studies.notes.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-wider">Notas adicionales</span>
                        <ul className="list-disc pl-4 text-xs font-semibold text-slate-800 space-y-1">
                          {patient.recent_studies.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </section>

      </div>

      {/* Finish Session Modal (Diagnoses submission and true case reveal) */}
      {isFinishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFinishModalOpen(false)} />

          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {trueCaseResult ? 'Resultado Verdadero del Caso' : 'Finalizar Consulta Médica'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {trueCaseResult ? 'Comparación de hipótesis clínicas.' : 'Escribe tu diagnóstico antes de revelar el caso.'}
                </p>
              </div>
              <button
                onClick={() => setIsFinishModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {finishError && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-600 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{finishError}</span>
                </div>
              )}

              {trueCaseResult ? (
                /* Results / True case details view */
                <div className="space-y-4">
                  <div className="p-4 bg-slate-100 border border-slate-200/50 rounded-2xl space-y-3.5">
                    <div>
                      <span className="text-2xs font-extrabold text-cyan-900 uppercase tracking-wider">Diagnóstico Principal Verdadero</span>
                      <p className="text-sm font-semibold text-slate-900 mt-1">{trueCaseResult.true_case?.diagnostico_principal || trueCaseResult.true_diagnosis}</p>
                    </div>

                    {Array.isArray(trueCaseResult.true_case?.diferenciales) && trueCaseResult.true_case.diferenciales.length > 0 && (
                      <div>
                        <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Diagnósticos Diferenciales</span>
                        <p className="text-xs font-semibold text-slate-700 mt-1">{trueCaseResult.true_case.diferenciales.join(', ')}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Indicaciones / Plan Clínico</span>
                      <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">
                        {trueCaseResult.true_case?.indicaciones_plan || trueCaseResult.true_details}
                      </p>
                    </div>

                    {trueCaseResult.true_case?.receta && (
                      <div>
                        <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Receta médica sugerida</span>
                        <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">{trueCaseResult.true_case.receta}</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-cyan-50/30 border border-cyan-150 rounded-2xl space-y-3">
                    <h4 className="text-xs font-extrabold text-cyan-900 uppercase tracking-wider">Tus conclusiones enviadas</h4>
                    <div className="text-xs space-y-2">
                      <div><span className="text-slate-400 block">Tu hipótesis principal</span><strong className="text-slate-800">{trueCaseResult.student_submission?.final_diagnosis || '-'}</strong></div>
                      <div><span className="text-slate-400 block">Diferenciales</span><strong className="text-slate-700">{trueCaseResult.student_submission?.differential || '-'}</strong></div>
                      <div><span className="text-slate-400 block">Tu Plan e indicaciones</span><p className="text-slate-700 mt-1 whitespace-pre-wrap">{trueCaseResult.student_submission?.plan || '-'}</p></div>
                      {trueCaseResult.student_submission?.prescription && (
                        <div><span className="text-slate-400 block">Receta</span><p className="text-slate-700 mt-1">{trueCaseResult.student_submission.prescription}</p></div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Conclusions entry form */
                <form onSubmit={handleFinishSubmit} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hipótesis Diagnóstica Principal</label>
                    <input
                      type="text"
                      placeholder="Ej: Neumonía, Infarto Agudo de Miocardio, etc."
                      value={finalDiagnosis}
                      onChange={(e) => setFinalDiagnosis(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-100 border-b border-transparent rounded-xl outline-none focus:bg-white focus:border-cyan-500 transition-all text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Diagnósticos Diferenciales (separados por comas)</label>
                    <input
                      type="text"
                      placeholder="Ej: Embolia pulmonar, Insuficiencia cardíaca, Angina estable"
                      value={diffDiagnosis}
                      onChange={(e) => setDiffDiagnosis(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-100 border-b border-transparent rounded-xl outline-none focus:bg-white focus:border-cyan-500 transition-all text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Indicaciones clínicas / Plan terapéutico</label>
                    <textarea
                      rows={3}
                      placeholder="¿Qué estudios adicionales indicas? ¿Cuál es el tratamiento a seguir?"
                      value={planInstructions}
                      onChange={(e) => setPlanInstructions(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-100 border-b border-transparent rounded-xl outline-none focus:bg-white focus:border-cyan-500 transition-all text-sm resize-y"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Receta médica (opcional)</label>
                    <textarea
                      rows={2}
                      placeholder="Medicaciones prescritas, dosis, frecuencia..."
                      value={rxPrescription}
                      onChange={(e) => setRxPrescription(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-100 border-b border-transparent rounded-xl outline-none focus:bg-white focus:border-cyan-500 transition-all text-sm resize-y"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsFinishModalOpen(false)}
                      className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold shadow-sm transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={finishSaving}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white hover:brightness-105 active:scale-98 text-sm font-bold shadow-lg shadow-cyan-950/10 disabled:opacity-50 transition-all"
                    >
                      {finishSaving ? 'Revelando...' : 'Finalizar y Revelar Caso'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {trueCaseResult && (
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFinishModalOpen(false)}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white hover:brightness-105 text-sm font-bold shadow-md shadow-cyan-950/10 transition-all"
                >
                  Cerrar Resultados
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
