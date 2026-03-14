import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout.jsx'
import About from './pages/About.jsx'
import Consultation from './pages/Consultation.jsx'
import Dashboard from './pages/Dashboard.jsx'
import GameCenter from './pages/Games/GameCenter.jsx'
import HandwritingAnalysis from './pages/HandwritingAnalysis.jsx'
import AssistiveTools from './pages/AssistiveTools.jsx'
import Login from './pages/Login.jsx'
import Monitoring from './pages/Monitoring.jsx'
import ParentDashboard from './pages/ParentDashboard.jsx'
import Settings from './pages/Settings.jsx'
import SmartPenDashboard from './pages/SmartPenDashboard.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import Students from './pages/Students.jsx'
import TeacherGuide from './pages/TeacherGuide.jsx'
import GameFrame from './components/GameFrame.jsx'

function RequireRole() {
  const role = localStorage.getItem('userRole')
  if (role !== 'teacher' && role !== 'parent') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: 12,
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #E2E8F0',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          },
        }}
      />

      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<RequireRole />}>
          <Route path="/games" element={<GameCenter />} />
          <Route path="/play/level-1" element={<GameFrame src="/games/5-7yrs.html" title="Early Development" />} />
          <Route path="/play/level-2" element={<GameFrame src="/games/8-10yrs.html" title="Cognitive Foundations" />} />
          <Route path="/play/level-3" element={<GameFrame src="/games/11-14yrs.html" title="Neural Morph" />} />
          <Route path="/play/hs" element={<GameFrame src="/games/hs.html" title="Neuro-Elite" />} />
          <Route path="/play/test" element={<GameFrame src="/games/test2.html" title="Clinical Assessment" />} />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/handwriting" element={<HandwritingAnalysis />} />
            <Route path="/consultation" element={<Consultation />} />
            <Route path="/tools" element={<AssistiveTools />} />
            <Route path="/teacher-guide" element={<TeacherGuide />} />
            <Route path="/parent-portal" element={<ParentDashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/students" element={<Students />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/smart-pen" element={<SmartPenDashboard />} />
            <Route path="/about" element={<About />} />

            <Route path="/teacher" element={<Navigate to="/dashboard" replace />} />
            <Route path="/parent" element={<Navigate to="/parent-portal" replace />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
