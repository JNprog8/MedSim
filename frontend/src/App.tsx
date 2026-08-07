import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import PatientsABM from './pages/PatientsABM'
import PatientForm from './pages/PatientForm'
import StudentsABM from './pages/StudentsABM'
import EvaluatorDashboard from './pages/EvaluatorDashboard'
import EvaluatorEncounter from './pages/EvaluatorEncounter'
import StudentPortal from './pages/StudentPortal'
import StudentSimulator from './pages/StudentSimulator'

function App() {
  return (
    <BrowserRouter basename="/frontend">
      <Routes>
        {/* Navigation routes matching old URL structures */}
        <Route path="/" element={<Navigate to="/index" replace />} />
        <Route path="/index" element={<Home />} />
        <Route path="/patients" element={<PatientsABM />} />
        <Route path="/patients/new" element={<PatientForm />} />
        <Route path="/patients/edit/:id" element={<PatientForm />} />
        <Route path="/students" element={<StudentsABM />} />
        <Route path="/evaluator" element={<EvaluatorDashboard />} />
        <Route path="/evaluator_encounter" element={<EvaluatorEncounter />} />
        <Route path="/student_join" element={<StudentPortal view="join" />} />
        <Route path="/student_sessions" element={<StudentPortal view="sessions" />} />
        <Route path="/student" element={<StudentSimulator />} />
        <Route path="*" element={<Navigate to="/index" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
