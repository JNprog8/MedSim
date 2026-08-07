import { Link } from 'react-router-dom'
import { Stethoscope, GraduationCap, ChevronRight } from 'lucide-react'

export default function Home() {
  return (
    <div 
      className="min-height-screen w-full flex flex-col justify-center py-10 px-4 relative z-10 overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed"
      style={{
        backgroundImage: "url('/IMG/imagendefondoMedsim.jpg')"
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/20 pointer-events-none z-0" />
      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-slate-900/40 via-slate-900/10 to-transparent pointer-events-none z-0" />
      <div className="absolute -bottom-32 -left-32 w-128 h-128 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none z-0" />

      <main className="relative z-10 w-full max-w-5xl mx-auto flex flex-col justify-center min-h-screen py-10">
        <section className="text-center max-w-4xl mx-auto mb-12">
          <h1 className="font-extrabold text-white text-5xl md:text-7xl tracking-tight leading-none mb-6 drop-shadow-lg">
            MedSim
          </h1>
          <p className="text-slate-200 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto drop-shadow-md">
            Plataforma integral para la evaluación de habilidades de comunicación clínica en entornos controlados, con acceso simple para evaluadores y estudiantes.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mx-auto">
          {/* Evaluator Card */}
          <section className="flex flex-col p-8 md:p-10 rounded-3xl bg-white/95 backdrop-blur-md border border-white/50 shadow-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-white/5 group">
            <div className="w-16 h-16 rounded-2xl bg-cyan-100 flex items-center justify-center text-cyan-800 mb-8 transition-transform duration-300 group-hover:scale-105">
              <Stethoscope className="w-8 h-8" />
            </div>
            <h2 className="font-extrabold text-slate-900 text-3xl leading-none tracking-tight mb-4">
              Evaluador/a
            </h2>
            <p className="text-slate-500 text-base leading-relaxed flex-1 mb-8">
              Abrí conversaciones, gestioná pacientes y estudiantes, y evaluá el desempeño clínico desde un panel unificado.
            </p>
            <Link 
              className="w-full min-h-14 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-800 to-cyan-900 text-white font-extrabold shadow-lg hover:brightness-105 active:scale-98 transition-all"
              to="/evaluator"
            >
              <span>Entrar como evaluador/a</span>
              <ChevronRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </section>

          {/* Student Card */}
          <section className="flex flex-col p-8 md:p-10 rounded-3xl bg-slate-50/95 backdrop-blur-md border border-white/50 shadow-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-slate-200/5 group">
            <div className="w-16 h-16 rounded-2xl bg-slate-200/70 flex items-center justify-center text-slate-700 mb-8 transition-transform duration-300 group-hover:scale-105">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h2 className="font-extrabold text-slate-900 text-3xl leading-none tracking-tight mb-4">
              Estudiante
            </h2>
            <p className="text-slate-500 text-base leading-relaxed flex-1 mb-8">
              Ingresá al espacio del estudiante para esperar una conversación activa o ver sesiones finalizadas.
            </p>
            <Link 
              className="w-full min-h-14 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-700 text-white font-extrabold border border-slate-600/10 shadow-lg hover:bg-slate-800 active:scale-98 transition-all"
              to="/student_join"
            >
              <span>Entrar como estudiante</span>
              <ChevronRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}
