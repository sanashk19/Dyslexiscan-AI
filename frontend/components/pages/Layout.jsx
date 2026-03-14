import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ClipboardList,
  Eye,
  EyeOff,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  PenLine,
  ScanLine,
  Settings,
  TrendingDown,
  UserCheck,
  Users,
  BookOpen,
} from 'lucide-react'

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Layout({ children, fullScreen = false }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [role, setRole] = useState(() => {
    const stored = localStorage.getItem('userRole')
    return stored === 'parent' ? 'parent' : stored === 'teacher' ? 'teacher' : null
  })

  const [isDyslexiaMode, setIsDyslexiaMode] = useState(() => {
    return localStorage.getItem('isDyslexiaMode') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('isDyslexiaMode', String(isDyslexiaMode))
  }, [isDyslexiaMode])

  useEffect(() => {
    if (!role) navigate('/')
  }, [navigate, role])

  const navItems = useMemo(() => {
    if (role === 'parent') {
      return [
        { to: '/parent-portal', label: "My Child's Progress", icon: TrendingDown },
        { to: '/parent-portal#notes', label: 'Teacher Notes', icon: MessageSquareText },
        { to: '/games', label: 'Home reinforcement', icon: Gamepad2 },
        { to: '/tools', label: 'Assistive Tools', icon: null, emoji: '🛠️' },
      ]
    }

    return [
      { to: '/dashboard', label: 'Screening overview', icon: LayoutDashboard },
      { to: '/handwriting', label: 'Handwriting screening', icon: ScanLine },
      { to: '/consultation', label: 'Consultation Module', icon: UserCheck },
      { to: '/smart-pen', label: 'Smart Pen Telemetry', icon: PenLine },
      { to: '/teacher-guide', label: 'Lesson prep guide', icon: BookOpen },
      { to: '/games', label: 'Reinforcement modules', icon: Gamepad2 },
      { to: '/tools', label: 'Assistive Tools', icon: null, emoji: '🛠️' },
      { to: '/students', label: 'Learner monitoring', icon: Users },
      { to: '/settings', label: 'Clinical controls', icon: Settings },
    ]
  }, [role])

  const onLogout = () => {
    localStorage.removeItem('userRole')
    setRole(null)
    navigate('/')
  }

  return (
    <div className={cn('min-h-screen bg-slate-50 text-slate-900', isDyslexiaMode ? 'dyslexia-mode' : null)}>
      <div className={cn('flex min-h-screen', fullScreen ? 'w-full' : 'mx-auto max-w-[1400px]')}>
        <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-900 px-4 py-6 text-slate-300 lg:block">
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-700 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">DyslexiScan Pro</div>
              <div className="truncate text-xs text-slate-400">{role === 'parent' ? 'Parent Portal' : 'Teacher Console'}</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-200">Demo flow</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              Start with a handwriting screening, review the risk signal, then assign a reinforcement module.
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                      isActive
                        ? 'border-l-4 border-teal-500 bg-slate-800 pl-2 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    )
                  }
                >
                  {Icon ? (
                    <Icon className="h-4 w-4" />
                  ) : (
                    <span className="grid h-4 w-4 place-items-center text-sm leading-none">{item.emoji}</span>
                  )}
                  <span className="min-w-0 truncate">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">DyslexiScan Pro</div>
                <div className="truncate text-xs text-slate-500">Screening dashboard</div>
              </div>

              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {role === 'parent' ? 'PR' : 'TR'}
                </span>

                <motion.button
                  type="button"
                  onClick={() => setIsDyslexiaMode((v) => !v)}
                  whileTap={{ scale: 0.96 }}
                  className="ds-btn-ghost"
                  aria-label={isDyslexiaMode ? 'Disable dyslexia-friendly mode' : 'Enable dyslexia-friendly mode'}
                >
                  {isDyslexiaMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  Dyslexia Mode
                </motion.button>

                <motion.button
                  type="button"
                  onClick={onLogout}
                  whileTap={{ scale: 0.96 }}
                  className="ds-btn-ghost"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </motion.button>
              </div>
            </div>
          </header>

          <main
            className={cn(
              fullScreen ? 'flex-1 p-0 overflow-hidden' : 'flex-1 p-8',
              isDyslexiaMode ? 'bg-transparent' : 'bg-brand-bg',
            )}
          >
            <div
              className={cn(
                'flex w-full flex-col',
                fullScreen ? 'max-w-none' : 'mx-auto max-w-[1180px]',
              )}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {children ?? <Outlet />}
                </motion.div>
              </AnimatePresence>

              {fullScreen ? null : (
                <footer className="mt-12 border-t border-slate-200/60 py-6">
                  <div className="text-xs leading-5 text-slate-500">
                    DyslexiScan is a screening support tool and does not replace professional evaluation.
                  </div>
                </footer>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
