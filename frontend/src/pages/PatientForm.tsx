import { useState, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import EvaluatorLayout from '../components/EvaluatorLayout'
import { Plus, Trash2, Save, ArrowLeft, X, AlertTriangle, Volume2, Square } from 'lucide-react'

interface Symptom {
  name: string
  severity: number
  duration_days: number
}

type ConditionalAnswer = { question: string; answer: string }

const CONDITIONAL_SEPARATOR = '\n\n'

const parseConditionalAnswers = (value: string): ConditionalAnswer[] => {
  if (!value.trim()) return []

  const structured = value
    .split(/\n\s*\n/)
    .map(block => {
      const question = block.match(/^Pregunta:\s*(.+)$/im)?.[1]?.trim()
      const answer = block.match(/^Respuesta:\s*([\s\S]*)$/im)?.[1]?.trim()
      return question && answer ? { question, answer } : null
    })
    .filter((entry): entry is ConditionalAnswer => entry !== null)

  if (structured.length) return structured

  // Conserva los casos creados antes de este editor: una línea por pregunta/respuesta.
  return value
    .split('\n')
    .map(line => {
      const [question, ...answer] = line.replace(/^si preguntan\s*/i, '').split(':')
      return question.trim() && answer.join(':').trim()
        ? { question: question.trim(), answer: answer.join(':').trim() }
        : null
    })
    .filter((entry): entry is ConditionalAnswer => entry !== null)
}

const serializeConditionalAnswers = (entries: ConditionalAnswer[]) => entries
  .filter(entry => entry.question.trim() && entry.answer.trim())
  .map(entry => `Pregunta: ${entry.question.trim()}\nRespuesta: ${entry.answer.trim()}`)
  .join(CONDITIONAL_SEPARATOR)

function AutoResizeTextarea({ className = '', rows = 2, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const resize = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 360)}px`
  }

  useLayoutEffect(() => {
    resize()
  }, [props.value])

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={rows}
      onInput={event => {
        resize()
        props.onInput?.(event)
      }}
      className={`w-full min-h-[76px] max-h-[360px] overflow-y-auto resize-none ${className}`}
    />
  )
}

function ConditionalAnswersEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const entries = parseConditionalAnswers(value)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const updateEntries = (nextEntries: ConditionalAnswer[]) => onChange(serializeConditionalAnswers(nextEntries))

  const addEntry = () => {
    if (!question.trim() || !answer.trim()) return
    updateEntries([...entries, { question, answer }])
    setQuestion('')
    setAnswer('')
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
      <p className="text-xs text-slate-600">Reservá estos datos para una pregunta concreta.</p>
      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry, index) => (
            <details key={`${entry.question}-${index}`} className="group rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 text-xs text-slate-700">
                <span className="font-bold text-cyan-800 shrink-0">Si pregunta:</span>
                <span className="truncate font-medium">{entry.question}</span>
                <span className="ml-auto text-slate-400 group-open:hidden">Editar</span>
              </summary>
              <div className="border-t border-slate-100 p-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Pregunta</label>
                  <AutoResizeTextarea value={entry.question} onChange={event => updateEntries(entries.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item))} className="min-h-[44px] px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Respuesta</label>
                  <AutoResizeTextarea value={entry.answer} onChange={event => updateEntries(entries.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item))} className="min-h-[44px] px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <button type="button" onClick={() => updateEntries(entries.filter((_, itemIndex) => itemIndex !== index))} className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                </button>
              </div>
            </details>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Pregunta del estudiante</label>
          <input value={question} onChange={event => setQuestion(event.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Ej: ¿Tuviste vómitos?" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Respuesta del paciente</label>
          <input value={answer} onChange={event => setAnswer(event.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Ej: No, no tuve vómitos." />
        </div>
        <button type="button" onClick={addEntry} disabled={!question.trim() || !answer.trim()} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
    </div>
  )
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

const BIRTH_SEX_OPTIONS = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' }
] as const
type BirthSexId = typeof BIRTH_SEX_OPTIONS[number]['id'] | ''
type SelfReferenceId = 'masculino' | 'femenino' | 'neutral' | ''

const FORM_STEPS = [
  { id: 'identity', label: '1. Situación inicial', helper: 'Quién consulta y por qué' },
  { id: 'person', label: '2. La persona', helper: 'Qué piensa y qué necesita' },
  { id: 'interview', label: '3. La entrevista', helper: 'Qué cuenta y cuándo' },
  { id: 'advanced', label: '4. Detalles del caso', helper: 'Historia y resolución' },
] as const
type FormStep = typeof FORM_STEPS[number]['id']

// Normaliza valores libres heredados ("Masculino", "M", "male", ...) al enum.
const normalizeLegacySex = (raw: unknown): SelfReferenceId => {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return ''
  if (['masculino', 'masculine', 'm', 'male', 'hombre', 'varon', 'varón', 'h'].includes(v)) return 'masculino'
  if (['femenino', 'femenina', 'f', 'female', 'mujer'].includes(v)) return 'femenino'
  return 'neutral'
}

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
  const [invalidField, setInvalidField] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FormStep>('identity')

  useEffect(() => {
    if (!invalidField) return
    const field = document.getElementById(invalidField)
    if (!field) return
    field.focus({ preventScroll: true })
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeTab, invalidField])

  const requiredFieldClass = (id: string) => invalidField === id ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50' : ''
  const clearRequiredError = (id: string) => {
    if (invalidField === id) {
      setInvalidField(null)
      setFormError('')
    }
  }

  // --- Form fields ---
  const [pId, setPId] = useState('')
  const [pFirstName, setPFirstName] = useState('')
  const [pLastName, setPLastName] = useState('')
  const [pAge, setPAge] = useState('')
  const pRegion = 'Bariloche, Río Negro, Argentina' // Fixed region

  // Administrative Info
  const [pDob, setPDob] = useState('')
  const [pDni, setPDni] = useState('')
  const [pInsurance, setPInsurance] = useState('')
  const [pBirthSex, setPBirthSex] = useState<BirthSexId>('')
  const [pSelfReference, setPSelfReference] = useState<SelfReferenceId>('')
  const [pLegacySex, setPLegacySex] = useState('')
  const [pOccupation, setPOccupation] = useState('')

  // Clinical Context
  const [pTriage, setPTriage] = useState('')
  const [pChief, setPChief] = useState('')
  const [pFeel, setPFeel] = useState('')
  const [pSpontaneous, setPSpontaneous] = useState('')
  const [pOpenQuestion, setPOpenQuestion] = useState('')
  const [pConditional, setPConditional] = useState('')
  const [pConcern, setPConcern] = useState('')
  const [pImpact, setPImpact] = useState('')
  const [pExpectation, setPExpectation] = useState('')
  const [pSecret, setPSecret] = useState('')
  const [pDisplay, setPDisplay] = useState('')

  // Institutional History (Tag lists)
  const [pDiagnoses, setPDiagnoses] = useState<string[]>([])
  const [pSurgeries, setPSurgeries] = useState<string[]>([])
  const [pAllergies, setPAllergies] = useState<string[]>([])
  const [pMedications, setPMedications] = useState<string[]>([])
  const [pOtherHistory, setPOtherHistory] = useState('')

  // Recent Studies (Tag lists)
  const [pLabs, setPLabs] = useState<string[]>([])
  const [pImaging, setPImaging] = useState<string[]>([])
  const [pNotes, setPNotes] = useState<string[]>([])

  // Profile Response Selection
  const [pPersonality, setPPersonality] = useState('Neutral')
  const [pLanguageLevel, setPLanguageLevel] = useState('B')
  const [pMemoryLevel, setPMemoryLevel] = useState('Low')
  const [pCognitive, setPCognitive] = useState('Normal')

  // True Case
  const [pTrueMain, setPTrueMain] = useState('')
  const [pTrueDiffs, setPTrueDiffs] = useState<string[]>([])
  const [pTruePlan, setPTruePlan] = useState('')
  const [pTrueRx, setPTrueRx] = useState('')

  // Dynamic Symptoms tags
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [newSymptomName, setNewSymptomName] = useState('')
  const [newSymptomSeverity, setNewSymptomSeverity] = useState<number>(5)
  const [newSymptomDuration, setNewSymptomDuration] = useState<number>(1)

  // Visuals / Audio
  const [selectedVoice, setSelectedVoice] = useState('0')
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const selectedAvatar =
    pSelfReference === 'femenino' ? 'female'
      : pSelfReference === 'masculino' ? 'male'
        : (selectedVoice === '0' ? 'female' : 'male')

  const playVoiceSample = (voiceId: string) => {
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

    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)

    audio.play().catch(err => {
      console.warn('No se pudo reproducir la muestra de voz:', err)
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

      if (p.voice !== undefined && p.voice !== null && p.voice !== '') setSelectedVoice(String(p.voice))

      setPDob(p.administrative?.date_of_birth || '')
      setPDni(p.administrative?.dni || '')
      setPInsurance(p.administrative?.insurance || '')
      setPBirthSex((p.administrative?.birth_sex as BirthSexId) || '')
      setPSelfReference(p.self_reference || normalizeLegacySex(p.administrative?.sex))
      setPLegacySex(p.administrative?.sex || '')
      setPOccupation(p.administrative?.occupation || '')

      setPTriage(p.triage?.reference_short || '')
      setPChief(p.chief_complaint || '')
      setPFeel(p.what_they_feel || '')
      setPSpontaneous(p.spontaneous_info || '')
      setPOpenQuestion(p.open_question_info || '')
      setPConditional(p.conditional_info || '')
      setPConcern(p.patient_concern || '')
      setPImpact(p.daily_impact || '')
      setPExpectation(p.visit_expectation || '')
      setPSecret(p.unknown_real_problem || '')
      setPDisplay(p.doctor_display_real_problem || '')

      setPDiagnoses(p.institutional_history?.diagnoses || [])
      setPSurgeries(p.institutional_history?.surgeries || [])
      setPAllergies(p.institutional_history?.allergies || [])
      setPMedications(p.institutional_history?.medications_current || [])
      setPOtherHistory(p.known_medical_history?.['Contexto personal'] || '')

      setPLabs(p.recent_studies?.labs || [])
      setPImaging(p.recent_studies?.imaging || [])
      setPNotes(p.recent_studies?.notes || [])

      setPPersonality(p.personality || 'Neutral')
      setPLanguageLevel(p.language_level || 'B')
      setPMemoryLevel(p.medical_history_recall || 'Low')
      setPCognitive(p.cognitive_confusion || 'Normal')

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
    pFirstName, pLastName, pAge, pDob, pDni, pInsurance, pBirthSex, pSelfReference, pOccupation,
    pTriage, pChief, pFeel, pSpontaneous, pOpenQuestion, pConditional,
    pConcern, pImpact, pExpectation, pSecret, pDisplay,
    pDiagnoses, pSurgeries, pAllergies, pMedications, pOtherHistory, pLabs, pImaging, pNotes,
    pPersonality, pLanguageLevel, pMemoryLevel, pCognitive,
    pTrueMain, pTrueDiffs, pTruePlan, pTrueRx, symptoms, selectedVoice
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

  // Intercept browser back button when form is dirty
  useEffect(() => {
    if (!isFormDirty) return

    // Push state so back button doesn't immediately leave the page
    window.history.pushState({ unsavedGuard: true }, '')

    const handlePopState = () => {
      // User clicked browser back button
      window.history.pushState({ unsavedGuard: true }, '')
      setTargetPath('/patients')
      setShowUnsavedModal(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isFormDirty])

  const formCardRef = useRef<HTMLDivElement | null>(null)

  const scrollToFormTop = () => {
    if (formCardRef.current) {
      formCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

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
    navigate(targetPath, { replace: true })
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

  const validateStep = (step: FormStep): { field: string; message: string } | null => {
    if (step === 'identity') {
      if (!pFirstName.trim()) return { field: 'patient-name', message: 'Completá el nombre del paciente.' }
      if (!pAge || !Number.isInteger(Number(pAge)) || Number(pAge) < 0) return { field: 'patient-age', message: 'Completá una edad válida en años enteros.' }
      if (!pChief.trim()) return { field: 'patient-chief', message: 'Completá el motivo en palabras del paciente.' }
      if (!pBirthSex) return { field: 'patient-birth-sex', message: 'Elegí el sexo asignado al nacer.' }
      if (!pSelfReference) return { field: 'patient-self-reference', message: 'Elegí cómo se refiere el paciente a sí mismo.' }
    }
    if (step === 'person' && !pConcern.trim()) {
      return { field: 'patient-concern', message: 'Contá qué cree o teme el paciente para poder explorar su perspectiva.' }
    }
    if (step === 'interview' && !pFeel.trim()) {
      return { field: 'patient-feel', message: 'Contá qué siente el paciente para que pueda responder de forma consistente.' }
    }
    return null
  }

  const handleNextStep = () => {
    const error = validateStep(activeTab)
    if (error) {
      setFormError(error.message)
      setInvalidField(error.field)
      return
    }
    setFormError('')
    setInvalidField(null)
    const currentIndex = FORM_STEPS.findIndex(step => step.id === activeTab)
    const next = FORM_STEPS[currentIndex + 1]
    if (next) {
      setActiveTab(next.id)
      setTimeout(scrollToFormTop, 50)
    }
  }

  const handlePreviousStep = () => {
    setFormError('')
    setInvalidField(null)
    const currentIndex = FORM_STEPS.findIndex(step => step.id === activeTab)
    const previous = FORM_STEPS[currentIndex - 1]
    if (previous) {
      setActiveTab(previous.id)
      setTimeout(scrollToFormTop, 50)
    }
  }

  const savePatient = async (destinationPath: string = '/patients'): Promise<boolean> => {
    setFormError('')

    for (const step of FORM_STEPS) {
      const error = validateStep(step.id)
      if (error) {
        setFormError(error.message)
        setInvalidField(error.field)
        setActiveTab(step.id)
        return false
      }
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
      sex: pLegacySex,
      birth_sex: pBirthSex,
      self_reference: pSelfReference || null,
      occupation: pOccupation,
      triage_short: pTriage,
      chief_complaint: pChief,
      what_they_feel: pFeel,
      spontaneous_info: pSpontaneous,
      open_question_info: pOpenQuestion,
      conditional_info: pConditional,
      patient_concern: pConcern,
      daily_impact: pImpact,
      visit_expectation: pExpectation,
      symptoms: newSymptomName.trim()
        ? [...symptoms, { name: newSymptomName.trim(), severity: newSymptomSeverity, duration_days: newSymptomDuration }]
        : symptoms,
      known_history_text: pOtherHistory,
      diagnoses_text: pDiagnoses.join('\n'),
      surgeries_text: pSurgeries.join('\n'),
      allergies_text: pAllergies.join('\n'),
      medications_text: pMedications.join('\n'),
      labs_text: pLabs.join('\n'),
      imaging_text: pImaging.join('\n'),
      notes_text: pNotes.join('\n'),
      unknown_real_problem: pTrueMain || pSecret || '(Sin diagnóstico definido)',
      doctor_display_real_problem: pDisplay,
      true_main: pTrueMain,
      true_differentials_text: pTrueDiffs.join('\n'),
      true_plan: pTruePlan,
      true_rx: pTrueRx,
      personality: pPersonality,
      language_level: pLanguageLevel,
      medical_history_recall: pMemoryLevel,
      cognitive_confusion: pCognitive
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

      setInitialSnapshot('')
      navigate(destinationPath)
      return true
    } catch (err: any) {
      setFormError(err.message || 'Error desconocido.')
      setFormSaving(false)
      return false
    }
  }

  const handleSavePatient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    await savePatient('/patients')
  }

  const handleSaveAndExit = async () => {
    setShowUnsavedModal(false)
    await savePatient(targetPath || '/patients')
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
          <p className="text-sm text-slate-500 mt-1 font-medium">Diseñá una entrevista creíble. Los detalles clínicos pueden completarse después.</p>
        </div>
      </div>

      <div ref={formCardRef} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col mb-10">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (activeTab === 'advanced') {
              handleSavePatient(e)
            } else {
              handleNextStep()
            }
          }}
          className="flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" aria-label="Pasos de creación del paciente">
              {FORM_STEPS.map(({ id: key, label, helper }) => (
                <button
                  key={key}
                  type="button"
                  aria-current={activeTab === key ? 'step' : undefined}
                  onClick={() => { setActiveTab(key); setFormError(''); setInvalidField(null); setTimeout(scrollToFormTop, 50) }}
                  className={`text-left p-3 rounded-xl border transition-colors ${activeTab === key ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300'}`}
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-xs mt-1 opacity-75">{helper}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600"><span className="font-bold text-cyan-800">*</span> Campos obligatorios para que el paciente pueda sostener la consulta. Los demás permiten enriquecer el caso.</p>
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
                      <input id="patient-name" type="text" aria-required="true" aria-invalid={invalidField === 'patient-name'} value={pFirstName} onChange={e => { setPFirstName(e.target.value); clearRequiredError('patient-name') }} className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm ${requiredFieldClass('patient-name')}`} />
                      {invalidField === 'patient-name' && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Apellido</label>
                      <input type="text" value={pLastName} onChange={e => setPLastName(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Edad *</label>
                      <input id="patient-age" type="number" min={0} aria-required="true" aria-invalid={invalidField === 'patient-age'} value={pAge} onChange={e => { setPAge(e.target.value); clearRequiredError('patient-age') }} className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm ${requiredFieldClass('patient-age')}`} />
                      {invalidField === 'patient-age' && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Motivo de consulta (para el estudiante)</label>
                    <input type="text" value={pTriage} onChange={e => setPTriage(e.target.value)} placeholder="Ej: Dolor de panza desde ayer" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 text-sm" />
                    <p className="text-xs text-slate-500 mt-1">Es lo que el estudiante sabe antes de conversar.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Motivo en palabras del paciente *</label>
                    <AutoResizeTextarea id="patient-chief" aria-required="true" aria-invalid={invalidField === 'patient-chief'} value={pChief} onChange={e => { setPChief(e.target.value); clearRequiredError('patient-chief') }} placeholder="Ej: Me duele mucho la panza desde ayer." className={`px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 text-sm ${requiredFieldClass('patient-chief')}`} />
                    {invalidField === 'patient-chief' && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
                    <p className="text-xs text-slate-500 mt-1">Una frase, sin adelantar toda la historia.</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Identidad y voz</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="patient-birth-sex" className="block text-xs font-bold text-slate-600 mb-1">Sexo asignado al nacer *</label>
                      <select
                        id="patient-birth-sex"
                        aria-required="true"
                        aria-invalid={invalidField === 'patient-birth-sex'}
                        value={pBirthSex}
                        onChange={e => {
                          setPBirthSex(e.target.value as BirthSexId)
                          clearRequiredError('patient-birth-sex')
                        }}
                        className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm ${requiredFieldClass('patient-birth-sex')}`}
                      >
                        <option value="">Elegir</option>
                        {BIRTH_SEX_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      {invalidField === 'patient-birth-sex' && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
                      <p className="text-xs text-slate-500 mt-1">Dato clínico requerido. Se ve en la ficha del estudiante.</p>
                    </div>
                    <div>
                      <label htmlFor="patient-self-reference" className="block text-xs font-bold text-slate-600 mb-1">Cómo se refiere a sí mismo *</label>
                      <select id="patient-self-reference" aria-required="true" aria-invalid={invalidField === 'patient-self-reference'} value={pSelfReference} onChange={e => { const value = e.target.value as SelfReferenceId; setPSelfReference(value); if (value === 'masculino') setSelectedVoice('1'); if (value === 'femenino') setSelectedVoice('0'); clearRequiredError('patient-self-reference') }} className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm ${requiredFieldClass('patient-self-reference')}`}>
                        <option value="">Elegir</option>
                        <option value="masculino">Hombre</option>
                        <option value="femenino">Mujer</option>
                        <option value="neutral">No binario</option>
                      </select>
                      {invalidField === 'patient-self-reference' && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
                      <p className="text-xs text-slate-500 mt-1">Hombre y mujer seleccionan la voz correspondiente. No binario conserva la voz elegida. Siempre podés cambiarla abajo.</p>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-600 mb-1">Voz</span>
                      <div className="flex flex-col gap-2">
                        {VOICE_OPTIONS.map(option => (
                          <div key={option.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${selectedVoice === option.id ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200'}`}>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input type="radio" name="patient-voice" checked={selectedVoice === option.id} onChange={() => setSelectedVoice(option.id)} />
                              {option.name}
                            </label>
                            <button type="button" onClick={() => playVoiceSample(option.id)} aria-label={`${playingVoiceId === option.id ? 'Pausar' : 'Escuchar'} muestra de ${option.name}`} className="p-1.5 rounded-lg bg-white border border-slate-200 text-cyan-800">
                              {playingVoiceId === option.id ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Elegí la voz que mejor represente al personaje.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'person' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">La perspectiva del paciente</h2>
                  <p className="text-sm text-slate-500 mt-1">Estos detalles permiten que responda a la escucha, las preguntas y las explicaciones del estudiante.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">¿Qué cree o teme que le pasa? *</label>
                  <AutoResizeTextarea id="patient-concern" aria-required="true" aria-invalid={invalidField === 'patient-concern'} value={pConcern} onChange={e => { setPConcern(e.target.value); clearRequiredError('patient-concern') }} placeholder="Ej: Piensa que fue algo que comió, pero teme que sea grave." className={`px-3 py-2 border border-slate-200 rounded-lg text-sm ${requiredFieldClass('patient-concern')}`} />
                  {invalidField === 'patient-concern' && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">¿Cómo le afecta en su vida?</label>
                  <AutoResizeTextarea value={pImpact} onChange={e => setPImpact(e.target.value)} placeholder="Ej: No pudo ir a trabajar y le preocupa dejar solos a sus hijos." className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">¿Qué espera de la consulta?</label>
                  <AutoResizeTextarea value={pExpectation} onChange={e => setPExpectation(e.target.value)} placeholder="Ej: Quiere que le expliquen qué tiene y que le alivien el dolor." className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Cómo suele reaccionar</label>
                    <select value={pPersonality} onChange={e => setPPersonality(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                      <option value="Neutral">Tranquilo / neutral</option>
                      <option value="Ansioso">Ansioso</option>
                      <option value="Enojado">Enojado</option>
                      <option value="Deprimido">Abatido</option>
                      <option value="Colaborador">Colaborador</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Forma de hablar</label>
                    <select value={pLanguageLevel} onChange={e => setPLanguageLevel(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                      <option value="A">Palabras sencillas</option>
                      <option value="B">Lenguaje cotidiano</option>
                      <option value="C">Conoce algunos términos médicos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Memoria de antecedentes</label>
                    <select value={pMemoryLevel} onChange={e => setPMemoryLevel(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                      <option value="Low">Recuerda de forma aproximada</option>
                      <option value="High">Recuerda bien</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Estado cognitivo</label>
                    <select value={pCognitive} onChange={e => setPCognitive(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                      <option value="Normal">Lúcido</option>
                      <option value="Confuso">Confuso / desorientado</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-500 bg-cyan-50 border border-cyan-100 rounded-xl p-3">Son opcionales, pero recomendados para evaluar si el estudiante explora ideas, preocupaciones, contexto e impacto cotidiano.</p>
              </div>
            )}

            {activeTab === 'interview' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* 3. Clinical context */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Lo que sabe y cuenta el paciente</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Historia completa de lo que siente *</label>
                      <AutoResizeTextarea id="patient-feel" aria-required="true" aria-invalid={invalidField === 'patient-feel'} value={pFeel} onChange={e => { setPFeel(e.target.value); clearRequiredError('patient-feel') }} className={`px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm ${requiredFieldClass('patient-feel')}`} />
                      {invalidField === 'patient-feel' && <p className="text-xs text-rose-600 mt-1">{formError}</p>}
                      <p className="text-xs text-slate-500 mt-1">Es la verdad subjetiva del caso, no un discurso para decir de una vez.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Lo que dice al inicio</label>
                      <AutoResizeTextarea value={pSpontaneous} onChange={e => setPSpontaneous(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" placeholder="Ej: Desde ayer me duele mucho la panza y hoy está peor." />
                      <p className="text-xs text-slate-500 mt-1">Si queda vacío, usaremos el motivo de consulta.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Lo que amplía ante una pregunta abierta</label>
                      <AutoResizeTextarea value={pOpenQuestion} onChange={e => setPOpenQuestion(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" placeholder="Ej: Empezó cerca del ombligo y después se corrió a la derecha." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Respuestas ante preguntas específicas</label>
                      <ConditionalAnswersEditor value={pConditional} onChange={setPConditional} />
                      <p className="text-xs text-slate-500 mt-1">Incluí los «no» que importan. Si no cargás una respuesta, el paciente no la asumirá como negativa.</p>
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
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">Los datos administrativos, antecedentes y estudios de este paso aparecen en la ficha clínica lateral del estudiante durante la consulta. La resolución final queda para el evaluador.</p>

                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Datos administrativos opcionales</h4>
                  <p className="text-xs text-slate-500 mb-3">Lo que cargues acá será visible en «Datos de identificación» de la ficha del estudiante.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Fecha de nacimiento</label><input type="text" placeholder="AAAA-MM-DD" value={pDob} onChange={e => setPDob(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">DNI ficticio</label><input type="text" value={pDni} onChange={e => setPDni(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Obra social / seguro</label><input type="text" value={pInsurance} onChange={e => setPInsurance(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Ocupación</label><input type="text" value={pOccupation} onChange={e => setPOccupation(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                  </div>
                </div>

                {/* 4. Institutional history */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Historia clínica institucional · visible para el estudiante</h4>
                  <p className="text-xs text-slate-500 mb-3">Aparece en la ficha previa del estudiante. Cargá solo antecedentes que consten en su historia clínica.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TagInput
                      label="Diagnósticos Previos"
                      tags={pDiagnoses}
                      onChange={setPDiagnoses}
                      placeholder="Ej: Hipertensión arterial"
                    />
                    <TagInput
                      label="Cirugías Previas"
                      tags={pSurgeries}
                      onChange={setPSurgeries}
                      placeholder="Ej: Apendicectomía (2015)"
                    />
                    <TagInput
                      label="Alergias Conocidas"
                      tags={pAllergies}
                      onChange={setPAllergies}
                      placeholder="Ej: Penicilina"
                    />
                    <TagInput
                      label="Medicación Actual"
                      tags={pMedications}
                      onChange={setPMedications}
                      placeholder="Ej: Enalapril 10mg/día"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Hábitos y contexto personal (que conoce el paciente, para descubrir conversando)</label>
                    <AutoResizeTextarea
                      value={pOtherHistory}
                      onChange={e => setPOtherHistory(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 text-sm"
                      placeholder="Ej: Vive con su pareja y dos hijos. Fuma 5 cigarrillos por día desde hace 10 años. No hace actividad física regular."
                    />
                    <p className="text-xs text-slate-500 mt-1">Escribí frases simples. El paciente las conoce pero el estudiante debe descubrirlas conversando. No se muestran en la ficha lateral.</p>
                  </div>
                </div>

                {/* 5. Recent studies (Tags) */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Estudios y notas · visibles para el estudiante</h4>
                  <p className="text-xs text-slate-500 mb-3">Laboratorios, imágenes y notas se muestran en «Estudios clínicos recientes» de la ficha lateral. Cargá solo los resultados que el estudiante debe conocer.</p>
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

                <details className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
                  <summary className="cursor-pointer text-sm font-bold text-cyan-900">Ver ficha clínica del estudiante</summary>
                  <p className="text-xs text-slate-600 mt-2">Así se agrupan los datos en el panel derecho del consultorio. La historia subjetiva, la preocupación y la resolución final no aparecen aquí.</p>
                  <div className="mt-4 space-y-3 text-xs text-slate-700">
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <strong className="block text-slate-900 mb-1">{pFirstName || 'Paciente'} {pLastName} · {pAge || '—'} años · {pRegion}</strong>
                      <span className="font-semibold">Motivo de consulta (triage):</span> {pTriage || pChief || 'Sin motivo cargado'}
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
                      <strong className="block text-slate-900 mb-1">Datos de identificación</strong>
                      <div>DNI: {pDni || 'No cargado'} · Nacimiento: {pDob || 'No cargado'}</div>
                      <div>{pBirthSex ? `Sexo asignado al nacer: ${pBirthSex}` : `Sexo registrado: ${pLegacySex || 'No cargado'}`} · Obra social: {pInsurance || 'No cargada'} · Ocupación: {pOccupation || 'No cargada'}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
                      <strong className="block text-slate-900 mb-1">Historia clínica institucional</strong>
                      <div>Diagnósticos previos: {pDiagnoses.join(', ') || 'Sin datos cargados'}</div>
                      <div>Cirugías: {pSurgeries.join(', ') || 'Sin datos cargados'}</div>
                      <div>Alergias: {pAllergies.join(', ') || 'Sin datos cargados'}</div>
                      <div>Medicación: {pMedications.join(', ') || 'Sin datos cargados'}</div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
                      <strong className="block text-slate-900 mb-1">Estudios clínicos recientes</strong>
                      <div>Laboratorios: {pLabs.join(', ') || 'Sin datos cargados'}</div>
                      <div>Imágenes: {pImaging.join(', ') || 'Sin datos cargados'}</div>
                      <div>Notas: {pNotes.join(', ') || 'Sin datos cargados'}</div>
                    </div>
                  </div>
                </details>

                {/* 7. True Case Reveal */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-cyan-900 tracking-wider mb-3 pb-1 border-b border-slate-100">Resolución del caso (para el evaluador)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <AutoResizeTextarea value={pTruePlan} onChange={e => setPTruePlan(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Receta (True Case)</label>
                        <AutoResizeTextarea value={pTrueRx} onChange={e => setPTrueRx(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-cyan-500 transition-colors text-sm" />
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
            {activeTab !== 'identity' && (
              <button
                key="btn-prev"
                type="button"
                onClick={handlePreviousStep}
                className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold"
              >
                Atrás
              </button>
            )}
            {activeTab === 'advanced' ? (
              <button
                key="btn-save"
                type="button"
                onClick={() => handleSavePatient()}
                disabled={formSaving}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white hover:brightness-105 active:scale-98 text-sm font-bold shadow-lg shadow-cyan-950/10 disabled:opacity-50 transition-all"
              >
                {formSaving ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar paciente</>}
              </button>
            ) : (
              <button
                key="btn-next"
                type="button"
                onClick={handleNextStep}
                className="px-5 py-3 rounded-2xl bg-cyan-900 text-white hover:bg-cyan-800 text-sm font-bold"
              >
                Siguiente
              </button>
            )}
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
              ¿Deseas guardar los cambios antes de salir, seguir editando o descartar las modificaciones?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-xl text-xs transition-colors order-3 sm:order-1"
              >
                Descartar cambios
              </button>
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-xs transition-colors order-2"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={handleSaveAndExit}
                disabled={formSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-800 to-cyan-900 text-white hover:brightness-105 active:scale-98 text-xs font-bold rounded-xl shadow-md shadow-cyan-950/10 disabled:opacity-50 transition-all order-1 sm:order-3"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{formSaving ? 'Guardando...' : 'Guardar y salir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </EvaluatorLayout>
  )
}
