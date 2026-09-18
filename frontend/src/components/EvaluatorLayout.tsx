import { Link } from 'react-router-dom'
import { ArrowLeft, MessageSquareCode, Users, HeartHandshake, LogOut } from 'lucide-react'

interface EvaluatorLayoutProps {
  children: React.ReactNode
  activePill: 'encounters' | 'patients' | 'students'
  onNavigate?: (path: string) => void
}

export default function EvaluatorLayout({ children, activePill, onNavigate }: EvaluatorLayoutProps) {
  const handleNav = (e: React.MouseEvent, path: string) => {
    if (onNavigate) {
      e.preventDefault()
      onNavigate(path)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-sky-50 via-slate-50 to-teal-50/30 text-slate-900 font-sans pb-16">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm py-4 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link 
              to="/" 
              onClick={(e) => handleNav(e, '/')}
              className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-cyan-800 transition-colors shadow-sm"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-extrabold text-cyan-900 text-2xl md:text-3xl tracking-tight leading-none">
                MedSim
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">Panel de Control Evaluador</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <nav className="flex items-center gap-1.5 md:gap-3 bg-slate-100/80 p-1.5 rounded-2xl overflow-x-auto" aria-label="Navegación del evaluador">
              <Link 
                to="/evaluator"
                onClick={(e) => handleNav(e, '/evaluator')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activePill === 'encounters' 
                    ? 'bg-white text-cyan-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                }`}
              >
                <MessageSquareCode className="w-4 h-4" />
                <span>Conversaciones</span>
              </Link>
              <Link 
                to="/patients"
                onClick={(e) => handleNav(e, '/patients')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activePill === 'patients' 
                    ? 'bg-white text-cyan-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                }`}
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Pacientes</span>
              </Link>
              <Link 
                to="/students"
                onClick={(e) => handleNav(e, '/students')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activePill === 'students' 
                    ? 'bg-white text-cyan-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Estudiantes</span>
              </Link>
            </nav>

            <a
              href="/auth/logout"
              title="Cerrar sesión"
              className="p-2.5 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all shadow-sm"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 md:px-12 mt-8">
        {children}
      </main>
    </div>
  )
}
