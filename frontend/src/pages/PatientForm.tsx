import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import EvaluatorLayout from '../components/EvaluatorLayout'
import { Plus, Trash2, Save, ArrowLeft, X, AlertTriangle, Volume2, Square } from 'lucide-react'

interface Symptom {
  name: string
  severity: number
  duration_days: number
}

// Reusable TagInput component for chip-based list editing
function TagInput({
  label,
  tags,
  onChange,
  placeholder = "Escribe y presiona Enter..."
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState('')

  const handleAdd = () => {
    const val = inputValue.trim()
    if (!val) return
    if (!tags.includes(val)) {
      onChange([...tags, val])
    }
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleRemove = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove))
  }

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50 border border-slate-100 rounded-lg">
        {tags.length === 0 ? (
          <span className="text-xs text-slate-400 italic">No hay elementos agregados</span>
        ) : (
          tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 shadow-xs text-slate-700 rounded-md text-xs font-medium"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="text-slate-400 hover:text-rose-500 rounded-full transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  )
}

// Avatar definitions for visual selector
const AVATAR_OPTIONS = [
  { id: 'male', label: 'Hombre', gender: 'male', imgSrc: '/IMG/avatar_male.png' },
  { id: 'female', label: 'Mujer', gender: 'female', imgSrc: '/IMG/avatar_female.png' }
]

// Catálogo de Voces de Síntesis Clínica
const VOICE_OPTIONS = [
  { 
    id: '0', 
    name: 'Voz femenina', 
    gender: 'female'
  },
  { 
    id: '1', 
    name: 'Voz masculina', 
    gender: 'male'
  },
]


export default function PatientForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const isEditMode = !!id

  const [loading, setLoading] = useState(isEditMode)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [activeTab, setActiveTab] = useState<'identity' | 'case'>('identity')

  // --- Form fields ---
  const [pId, setPId] = useState('')
  const [pFirstName, setPFirstName] = useState('')
  const [pLastName, setPLastName] = useState('')
  const [pAge, setPAge] = useState('')
  const pRegion = 'Viedma, Río Negro, Argentina' // Fixed region

  // Administrative Info
  const [pDob, setPDob] = useState('')
  const [pDni, setPDni] = useState('')
  const [pInsurance, setPInsurance] = useState('')
  const [pSex, setPSex] = useState('')
  const [pOccupation, setPOccupation] = useState('')

  // Clinical Context
  const [pTriage, setPTriage] = useState('')
  const [pChief, setPChief] = useState('')
  const [pFeel, setPFeel] = useState('')
  const [pSpontaneous, setPSpontaneous] = useState('')
  const [pConditional, setPConditional] = useState('')
  const [pSecret, setPSecret] = useState('')
  const [pDisplay, setPDisplay] = useState('')

  // Institutional History (Tag lists)
  const [pDiagnoses, setPDiagnoses] = useState<string[]>([])
  const [pSurgeries, setPSurgeries] = useState<string[]>([])
  const [pAllergies, setPAllergies] = useState<string[]>([])
  const [pMedications, setPMedications] = useState<string[]>([])

  // Recent Studies (Tag lists)
  const [pLabs, setPLabs] = useState<string[]>([])
  const [pImaging, setPImaging] = useState<string[]>([])
  const [pNotes, setPNotes] = useState<string[]>([])

  // Profile Response Selection
  const [pPersonality, setPPersonality] = useState('Neutral')
  const [pLanguageLevel, setPLanguageLevel] = useState('B')
  const [pMemoryLevel, setPMemoryLevel] = useState('Low')
  const [pCognitive, setPCognitive] = useState('Normal')
  const [pSpeakingStyle, setPSpeakingStyle] = useState('rioplatense')

  // True Case
  const [pTrueMain, setPTrueMain] = useState('')
  const [pTrueDiffs, setPTrueDiffs] = useState<string[]>([])
  const [pTruePlan, setPTruePlan] = useState('')
  const [pTrueRx, setPTrueRx] = useState('')

  // --- Dynamic Symptoms tags ---
  const [symptoms, setSymptoms] = useState<Symptom[]>([])

  // Temp form for new symptom
  const [newSymptomName, setNewSymptomName] = useState('')
  const [newSymptomSeverity, setNewSymptomSeverity] = useState<number>(5)
  const [newSymptomDuration, setNewSymptomDuration] = useState<number>(1)

  // --- Visuals fields ---
  const [selectedAvatar, setSelectedAvatar] = useState('male')
  const [selectedVoice, setSelectedVoice] = useState('0')
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playVoiceSample = (voiceId: string) => {
    // Si ya está reproduciendo este mismo audio, lo detenemos (toggle)
    if (audioRef.current && playingVoiceId === voiceId) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlayingVoiceId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    const sampleUrl = `/audio/voices/voice_${voiceId}.wav?v=2`
    const audio = new Audio(sampleUrl)
    audioRef.current = audio
    setPlayingVoiceId(voiceId)

    audio.onended = () => {
      setPlayingVoiceId(null)
    }
    audio.onerror = () => {
      setPlayingVoiceId(null)
    }

    audio.play().catch(err => {
      console.warn("No se pudo reproducir la muestra de voz:", err)
      setPlayingVoiceId(null)
    })
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (isEditMode && id) {
      fetchPatient(id)
    }
  }, [id, isEditMode])

  const fetchPatient = async (patientId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`)
      if (!res.ok) throw new Error('Paciente no encontrado')
      const p = await res.json()

      setPId(p.id)
      setPFirstName(p.name || '')
      setPLastName(p.last_name !== undefined && p.last_name !== null && p.last_name !== '' ? p.last_name : (p.administrative?.full_name ? p.administrative.full_name.replace(p.name || '', '').trim() : ''))
      setPAge(p.age?.toString() || '')

      if (p.avatar) setSelectedAvatar(p.avatar === 'female' || p.avatar?.includes('female') ? 'female' : 'male')
      if (p.voice !== undefined && p.voice !== null && p.voice !== '') setSelectedVoice(String(p.voice))


      setPDob(p.administrative?.date_of_birth || '')
      setPDni(p.administrative?.dni || '')
      setPInsurance(p.administrative?.insurance || '')
      setPSex(p.administrative?.sex || '')
      setPOccupation(p.administrative?.occupation || '')

      setPTriage(p.triage?.reference_short || '')
      setPChief(p.chief_complaint || '')
      setPFeel(p.what_they_feel || '')
      setPSpontaneous(p.spontaneous_info || '')
      setPConditional(p.conditional_info || '')
      setPSecret(p.unknown_real_problem || '')
      setPDisplay(p.doctor_display_real_problem || '')

      setPDiagnoses(p.institutional_history?.diagnoses || [])
      setPSurgeries(p.institutional_history?.surgeries || [])
      setPAllergies(p.institutional_history?.allergies || [])
      setPMedications(p.institutional_history?.medications_current || [])

      setPLabs(p.recent_studies?.labs || [])
      setPImaging(p.recent_studies?.imaging || [])
      setPNotes(p.recent_studies?.notes || [])

      setPPersonality(p.personality || 'Neutral')
      setPLanguageLevel(p.language_level || 'B')
      setPMemoryLevel(p.medical_history_recall || 'Low')
      setPCognitive(p.cognitive_confusion || 'Normal')
      setPSpeakingStyle(p.speaking_style || 'rioplatense')

      setPTrueMain(p.true_case?.diagnostico_principal || '')
      setPTrueDiffs(p.true_case?.diferenciales || [])
      setPTruePlan(p.true_case?.indicaciones_plan || '')
      setPTrueRx(p.true_case?.receta || '')

      if (Array.isArray(p.symptoms_reported)) {
        const parsed = p.symptoms_reported.map((s: any) => {
          if (typeof s === 'string') return { name: s, severity: 5, duration_days: 1 }
          return { name: s.name, severity: s.severity || 5, duration_days: s.duration_days || 1 }
        })
        setSymptoms(parsed)
      } else {
        setSymptoms([])
      }

    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- Unsaved Changes & Navigation Modal State ---
  const [initialSnapshot, setInitialSnapshot] = useState<string>('')
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [targetPath, setTargetPath] = useState<string>('/patients')

  const getFormSnapshot = () => JSON.stringify({
    pFirstName, pLastName, pAge, pDob, pDni, pInsurance, pSex, pOccupation,
    pTriage, pChief, pFeel, pSpontaneous, pConditional, pSecret, pDisplay,
    pDiagnoses, pSurgeries, pAllergies, pMedications, pLabs, pImaging, pNotes,
    pPersonality, pLanguageLevel, pMemoryLevel, pCognitive, pSpeakingStyle,
    pTrueMain, pTrueDiffs, pTruePlan, pTrueRx, symptoms, selectedAvatar, selectedVoice
  })

  // Set initial snapshot once form is initialized
  useEffect(() => {
    if (!isEditMode) {
      setInitialSnapshot(getFormSnapshot())
    }
  }, [isEditMode])

  useEffect(() => {
    if (isEditMode && !loading) {
      setInitialSnapshot(getFormSnapshot())
    }
  }, [loading, isEditMode])

  const isFormDirty = initialSnapshot !== '' && getFormSnapshot() !== initialSnapshot

  // Prevent browser window close / reload with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isFormDirty])

  const handleNavigateAway = (path: string = '/patients') => {
    if (isFormDirty) {
      setTargetPath(path)
      setShowUnsavedModal(true)
    } else {
      navigate(path)
    }
  }

  const handleDiscardChanges = () => {
    setInitialSnapshot('')
    setShowUnsavedModal(false)
    navigate(targetPath)
  }

  const handleAddSymptom = () => {
    const s = newSymptomName.trim()
    if (!s) return
    setSymptoms(prev => [...prev, { name: s, severity: newSymptomSeverity, duration_days: newSymptomDuration }])
    setNewSymptomName('')
    setNewSymptomSeverity(5)
    setNewSymptomDuration(1)
  }

  const handleRemoveSymptom = (index: number) => {
    setSymptoms(prev => prev.filter((_, i) => i !== index))
  }

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!pFirstName || !pAge || !pChief) {
      setFormError('Revisa los campos obligatorios: Nombre, Edad y Motivo de Consulta.')
      return
    }

    setFormSaving(true)

    // Auto generate stable ID if creating a new patient
    const finalId = isEditMode && pId
      ? pId
      : `${pFirstName}_${pLastName}_${Math.floor(1000 + Math.random() * 9000)}`
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_]/g, '')

    const payload = {
      id: finalId,
      first_name: pFirstName,
      last_name: pLastName,
      age: parseInt(pAge) || 0,
      region: pRegion,
      avatar: selectedAvatar,
      voice: selectedVoice,
      date_of_birth: pDob,
      dni: pDni,
      insurance: pInsurance,
      sex: pSex,
      occupation: pOccupation,
      triage_short: pTriage,
      chief_complaint: pChief,
      what_they_feel: pFeel,
      spontaneous_info: pSpontaneous,
      conditional_info: pConditional,
      symptoms: symptoms,
      known_history_text: "",
      diagnoses_text: pDiagnoses.join('\n'),
      surgeries_text: pSurgeries.join('\n'),
      allergies_text: pAllergies.join('\n'),
      medications_text: pMedications.join('\n'),
      labs_text: pLabs.join('\n'),
      imaging_text: pImaging.join('\n'),
      notes_text: pNotes.join('\n'),
      unknown_real_problem: pSecret,
      doctor_display_real_problem: pDisplay,
      true_main: pTrueMain,
      true_differentials_text: pTrueDiffs.join('\n'),
      true_plan: pTruePlan,
      true_rx: pTrueRx,
      personality: pPersonality,
      language_level: pLanguageLevel,
      medical_history_recall: pMemoryLevel,
      cognitive_confusion: pCognitive,
      speaking_style: pSpeakingStyle
    }

    try {
      const res = await fetch('/api/patients/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Error al guardar el paciente')
      }

      navigate(targetPath || '/patients')
    } catch (err: any) {
      setFormError(err.message || 'Error desconocido.')
      setFormSaving(false)
    }
  }

  if (loading) {
    return (
      <EvaluatorLayout activePill="patients">
        <div className="flex justify-center items-center h-64">Cargando paciente...</div>
      </EvaluatorLayout>
    )
  }

  return (
    <EvaluatorLayout activePill="patients" onNavigate={handleNavigateAway}>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => handleNavigateAway('/patients')}
          className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-cyan-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            {isEditMode ? `Editar Paciente: ${pFirstName} ${pLastName}` : 'Nuevo Paciente'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Completa la ficha del clinica y el caso del paciente.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col mb-10">
        <form onSubmit={handleSavePatient} className="flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-4">
              <button
                type="button"
                className={`pb-2 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'identity' ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('identity')}
              >
                Identidad del Paciente
              </button>
              <button
                type="button"
                className={`pb-2 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'case' ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('case')}
              >
                Caso Clínico
              </button>
            </div>
            {formError && (
              <div className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100/50">
                {formError}
              </div>
            )}
          </div>

          <div className="p-6 overflow-y-auto">
            {activeTab === 'identity' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* 1. Identity section */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Identidad del Paciente</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Nombre *</label>
                      <input required type="text" value={pFirstName} onChange={e => setPFirstName(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Apellido</label>
                      <input type="text" value={pLastName} onChange={e => setPLastName(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Edad *</label>
                      <input required type="number" value={pAge} onChange={e => setPAge(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                  </div>
                </div>

                {/* Avatar and Voice */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Visual y Audio</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Avatar Selector */}
                    <div className="lg:col-span-4">
                      <label className="block text-xs font-bold text-slate-600 mb-2">Avatar 3D de la Entrevista</label>
                      <div className="grid grid-cols-2 gap-3">
                        {AVATAR_OPTIONS.map(opt => (
                          <div
                            key={opt.id}
                            onClick={() => {
                              setSelectedAvatar(opt.id)
                            }}
                            className={`cursor-pointer border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${selectedAvatar === opt.id
                              ? 'border-cyan-600 bg-cyan-50/70 shadow-sm ring-2 ring-cyan-500/20'
                              : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50'
                              }`}
                          >
                            <img
                              src={opt.imgSrc}
                              alt={opt.label}
                              className="w-14 h-14 object-contain drop-shadow-sm"
                            />
                            <span className="text-xs font-bold text-slate-800 text-center">{opt.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Voice Selector */}
                    <div className="lg:col-span-8">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-600">Voz de Síntesis</label>
                        <span className="text-[11px] text-cyan-800 font-semibold bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-200/60">
                          {VOICE_OPTIONS.find(v => v.id === selectedVoice || (selectedVoice === 'es-AR-male-1' && v.id === '1') || (selectedVoice === 'es-AR-female-1' && v.id === '0'))?.name || 'Voz seleccionada'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2.5">
                        Haz clic en una voz para seleccionarla y escuchar su muestra: <span className="italic text-slate-500 font-medium">"Hola, ¿cómo estás? Esta es mi voz."</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {VOICE_OPTIONS.map(opt => {
                          const isSelected = selectedVoice === opt.id || 
                            (selectedVoice === 'es-AR-male-1' && opt.id === '1') || 
                            (selectedVoice === 'es-AR-female-1' && opt.id === '0')
                          const isPlaying = playingVoiceId === opt.id

                          return (
                            <div
                              key={opt.id}
                              onClick={() => {
                                setSelectedVoice(opt.id)
                                playVoiceSample(opt.id)
                              }}
                              className={`cursor-pointer border rounded-2xl p-3.5 flex items-center justify-between transition-all relative ${isSelected
                                ? 'border-cyan-600 bg-cyan-50/80 shadow-md ring-2 ring-cyan-500/25'
                                : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50/80'
                                } ${isPlaying ? 'ring-2 ring-teal-500/60' : ''}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedVoice(opt.id)
                                    playVoiceSample(opt.id)
                                  }}
                                  title={isPlaying ? "Pausar muestra" : "Escuchar muestra de audio"}
                                  className={`p-2 rounded-xl transition-all ${isPlaying
                                    ? 'bg-teal-600 text-white animate-pulse'
                                    : isSelected
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-slate-100 text-slate-500 hover:bg-cyan-100 hover:text-cyan-700'
                                    }`}
                                >
                                  {isPlaying ? (
                                    <Square className="w-4 h-4 fill-current" />
                                  ) : (
                                    <Volume2 className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="text-sm font-bold text-slate-800">{opt.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isPlaying && (
                                  <span className="text-[10px] font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full animate-pulse">
                                    Audio
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[11px] shrink-0 font-bold">✓</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adm Info */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Datos Administrativos (Evolución)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Fecha de Nacimiento</label>
                      <input type="text" placeholder="Ej: 1963-08-14" value={pDob} onChange={e => setPDob(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">DNI</label>
                      <input type="text" value={pDni} onChange={e => setPDni(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Obra Social / Seguro</label>
                      <input type="text" value={pInsurance} onChange={e => setPInsurance(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Sexo Registrado</label>
                      <input type="text" value={pSex} onChange={e => setPSex(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ocupación</label>
                      <input type="text" value={pOccupation} onChange={e => setPOccupation(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'case' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* 3. Clinical context */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Contexto Clínico y Triage</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Triage (Motivo corto para el alumno)</label>
                      <input type="text" value={pTriage} onChange={e => setPTriage(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Motivo de Consulta (Real que dirá el paciente) *</label>
                      <textarea required value={pChief} onChange={e => setPChief(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Lo que siente detalladamente (Para el LLM)</label>
                      <textarea value={pFeel} onChange={e => setPFeel(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Información que revela espontáneamente (Ej: al principio de la consulta)</label>
                      <textarea value={pSpontaneous} onChange={e => setPSpontaneous(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm resize-none" placeholder="Lo que el paciente dirá voluntariamente o si se le pregunta de forma general..." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Información que solo revela si se le pregunta directamente</label>
                      <textarea value={pConditional} onChange={e => setPConditional(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm resize-none" placeholder="Datos sensibles o específicos que el paciente guardará hasta que se indague puntualmente..." />
                    </div>
                  </div>

                  {/* Dynamic Structured Symptoms */}
                  <div className="mt-6 flex flex-col gap-2 bg-slate-50/50 p-4 border border-slate-200/50 rounded-2xl">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Síntomas (Formato Estructurado)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Síntoma</label>
                        <input
                          type="text"
                          placeholder="Ej: Fiebre"
                          value={newSymptomName}
                          onChange={(e) => setNewSymptomName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSymptom(); } }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-all text-sm"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Severidad (1-10)</label>
                        <input
                          type="number"
                          min={1} max={10}
                          value={newSymptomSeverity}
                          onChange={(e) => setNewSymptomSeverity(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-all text-sm text-center"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Días</label>
                        <input
                          type="number"
                          min={0}
                          value={newSymptomDuration}
                          onChange={(e) => setNewSymptomDuration(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-all text-sm text-center"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSymptom}
                        className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 active:scale-95 transition-all"
                      >
                        Añadir
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {symptoms.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No hay síntomas.</span>
                      ) : (
                        symptoms.map((symptom, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                            <div>
                              <div className="text-sm font-bold text-slate-800">{symptom.name}</div>
                              <div className="text-xs font-medium text-slate-500">
                                Sev: <span className="text-amber-600 font-bold">{symptom.severity}</span>/10 | {symptom.duration_days} días
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSymptom(idx)}
                              className="text-slate-400 hover:text-red-500 p-1 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Institutional History (Tags) */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Historia Clínica Institucional</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TagInput
                      label="Diagnósticos Previos"
                      tags={pDiagnoses}
                      onChange={setPDiagnoses}
                      placeholder="Ej: Hipertensión Arterial"
                    />
                    <TagInput
                      label="Cirugías"
                      tags={pSurgeries}
                      onChange={setPSurgeries}
                      placeholder="Ej: Apendicectomía"
                    />
                    <TagInput
                      label="Alergias"
                      tags={pAllergies}
                      onChange={setPAllergies}
                      placeholder="Ej: Penicilina"
                    />
                    <TagInput
                      label="Medicación Actual"
                      tags={pMedications}
                      onChange={setPMedications}
                      placeholder="Ej: Losartán 50mg"
                    />
                  </div>
                </div>

                {/* 5. Recent studies (Tags) */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Estudios y Notas del Sistema</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <TagInput
                      label="Laboratorios"
                      tags={pLabs}
                      onChange={setPLabs}
                      placeholder="Ej: Glucemia 108 mg/dL"
                    />
                    <TagInput
                      label="Imágenes"
                      tags={pImaging}
                      onChange={setPImaging}
                      placeholder="Ej: Rx de tórax normal"
                    />
                    <TagInput
                      label="Notas de Enfermería/Previa"
                      tags={pNotes}
                      onChange={setPNotes}
                      placeholder="Ej: Paciente normotenso"
                    />
                  </div>
                </div>

                {/* 6. Response Profile */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Perfil Cognitivo y Comportamiento</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Personalidad</label>
                      <select value={pPersonality} onChange={e => setPPersonality(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm">
                        <option value="Neutral">Neutral</option>
                        <option value="Ansioso">Ansioso</option>
                        <option value="Enojado">Enojado</option>
                        <option value="Deprimido">Deprimido</option>
                        <option value="Colaborador">Colaborador</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Dialecto</label>
                      <select value={pSpeakingStyle} onChange={e => setPSpeakingStyle(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm">
                        <option value="rioplatense">Rioplatense (Porteño)</option>
                        <option value="cordobes">Cordobés</option>
                        <option value="neutro">Neutro (MX/Latam)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Nivel Lenguaje</label>
                      <select value={pLanguageLevel} onChange={e => setPLanguageLevel(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm">
                        <option value="A">Básico (A)</option>
                        <option value="B">Medio (B)</option>
                        <option value="C">Médico (C)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Memoria de HC</label>
                      <select value={pMemoryLevel} onChange={e => setPMemoryLevel(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm">
                        <option value="Low">Baja (Olvida)</option>
                        <option value="High">Alta (Recuerda)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Estado Cognitivo</label>
                      <select value={pCognitive} onChange={e => setPCognitive(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm">
                        <option value="Normal">Lúcido</option>
                        <option value="Confuso">Confuso / Desorientado</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 7. True Case Reveal */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Resolución y Verdad (Oculto al alumno)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Problema Real (Secreto para el LLM)</label>
                      <input type="text" value={pSecret} onChange={e => setPSecret(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Etiqueta mostrada al Evaluador</label>
                      <input type="text" value={pDisplay} onChange={e => setPDisplay(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Diagnóstico Principal (True Case)</label>
                        <input type="text" value={pTrueMain} onChange={e => setPTrueMain(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                      </div>
                      <TagInput
                        label="Diagnósticos Diferenciales"
                        tags={pTrueDiffs}
                        onChange={setPTrueDiffs}
                        placeholder="Ej: Angina inestable"
                      />
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Plan / Indicaciones (True Case)</label>
                        <textarea value={pTruePlan} onChange={e => setPTruePlan(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Receta (True Case)</label>
                        <textarea value={pTrueRx} onChange={e => setPTrueRx(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm resize-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleNavigateAway('/patients')}
              className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold shadow-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formSaving}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white hover:brightness-105 active:scale-98 text-sm font-bold shadow-lg shadow-cyan-950/10 disabled:opacity-50 transition-all"
            >
              {formSaving ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar Paciente</>}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Cambios sin Guardar */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
                  ¿Tienes cambios sin guardar?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Has realizado modificaciones en la ficha del paciente que no se han guardado aún.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              ¿Deseas guardar los cambios antes de salir o prefieres descartarlos?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold shadow-sm transition-colors"
              >
                Seguir Editando
              </button>
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl text-xs transition-colors"
              >
                Descartar Cambios
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setShowUnsavedModal(false)
                  handleSavePatient(e)
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white font-bold text-xs shadow-lg shadow-cyan-950/10 hover:brightness-105 active:scale-98 transition-all"
              >
                Guardar y Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </EvaluatorLayout>
  )
}
