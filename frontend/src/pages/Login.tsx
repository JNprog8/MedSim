import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

export default function Login() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get('next') || '/'

  const [isAuthRequired, setIsAuthRequired] = useState(true)

  // Verificar si ya está autenticado
  useEffect(() => {
    let isMounted = true

    async function checkAuthStatus() {
      try {
        const res = await fetch('/auth/status', {
          headers: { 'Accept': 'application/json' }
        })
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            setIsAuthRequired(Boolean(data.required))
          }
          // Solo redirigir si se requiere autenticación Y ya está autenticado
          if (data.required && data.authenticated) {
            const cleanNext = nextPath.startsWith('/frontend') 
              ? nextPath.replace(/^\/frontend/, '') 
              : nextPath
            navigate(cleanNext === '/index' ? '/' : (cleanNext || '/'), { replace: true })
            return
          }
        }
      } catch {
        // En caso de fallo de red, permitir que intente iniciar sesión
      } finally {
        if (isMounted) {
          setCheckingAuth(false)
        }
      }
    }

    checkAuthStatus()
    return () => {
      isMounted = false
    }
  }, [navigate, nextPath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAuthRequired && !password.trim()) {
      setError('Por favor, ingresá la contraseña.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          password,
          next: nextPath,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const target = data.redirect || nextPath || '/'
        const cleanTarget = target.startsWith('/frontend')
          ? target.replace(/^\/frontend/, '')
          : target
        navigate(cleanTarget === '/index' ? '/' : (cleanTarget || '/'), { replace: true })
      } else {
        const errorData = await response.json().catch(() => null)
        setError(errorData?.detail || 'Contraseña incorrecta. Verificá los datos e intentá de nuevo.')
      }
    } catch {
      setError('Ocurrió un error de conexión al servidor. Intente más tarde.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div 
        className="min-h-screen w-full flex items-center justify-center relative z-10 overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: "url('/IMG/imagendefondoMedsim.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/30 pointer-events-none z-0" />
        <div className="relative z-10 flex flex-col items-center gap-3 text-white">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-slate-300 text-sm font-medium">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center items-center py-12 px-4 relative z-10 overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed"
      style={{
        backgroundImage: "url('/IMG/imagendefondoMedsim.jpg')"
      }}
    >
      {/* Background Overlays coherentes con Home */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/20 pointer-events-none z-0" />
      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-slate-900/40 via-slate-900/10 to-transparent pointer-events-none z-0" />
      <div className="absolute -bottom-32 -left-32 w-128 h-128 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none z-0" />
      <div className="absolute -top-32 -right-32 w-128 h-128 rounded-full bg-teal-500/15 blur-3xl pointer-events-none z-0" />

      <main className="relative z-10 w-full max-w-md mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="font-extrabold text-white text-4xl md:text-5xl tracking-tight leading-none mb-3 drop-shadow-lg">
            MedSim
          </h1>
          <p className="text-slate-200 text-sm md:text-base leading-relaxed drop-shadow-md">
            Plataforma de Simulación y Evaluación Clínica
          </p>
        </div>

        {/* Login Card */}
        <div className="flex flex-col p-8 md:p-10 rounded-3xl bg-white/95 backdrop-blur-md border border-white/50 shadow-2xl transition-all duration-300">
          {/* Card Icon */}
          <div className="w-16 h-16 rounded-2xl bg-cyan-100 flex items-center justify-center text-cyan-800 mb-6 shadow-inner mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <div className="text-center mb-6">
            <h2 className="font-extrabold text-slate-900 text-2xl leading-none tracking-tight mb-2">
              Acceso al Sistema
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Ingresá la contraseña de acceso para continuar a la plataforma.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-rose-700 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-snug">{error}</p>
            </div>
          )}

          {/* Local Dev Info Badge */}
          {!isAuthRequired && (
            <div className="mb-6 p-3.5 rounded-2xl bg-cyan-50/90 border border-cyan-200/80 flex items-center gap-2.5 text-cyan-900 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-700" />
              <span>Modo desarrollo: podés ingresar con cualquier clave o dejarla vacía.</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label 
                htmlFor="site-password" 
                className="text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                Contraseña {isAuthRequired ? '' : '(Opcional en desarrollo)'}
              </label>
              
              <div className="relative flex items-center">
                <input
                  id="site-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isAuthRequired ? "••••••••••••" : "Sin clave requerida en dev"}
                  autoFocus
                  required={isAuthRequired}
                  disabled={loading}
                  className="w-full pl-4 pr-12 py-3.5 bg-slate-50/90 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:border-transparent transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Botón de ingreso */}
            <button
              type="submit"
              disabled={loading || (isAuthRequired && !password)}
              className="w-full min-h-14 mt-2 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white font-extrabold shadow-lg hover:brightness-105 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a MedSim</span>
                  <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Footer Card */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-cyan-700" />
            <span>Acceso seguro protegido</span>
          </div>
        </div>
      </main>
    </div>
  )
}
