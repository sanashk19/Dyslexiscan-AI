import { useEffect, useState } from 'react'

const STORAGE_KEY = 'dyslexia_simulator_enabled'

export default function DyslexiaToggle() {
  const [isSimulated, setIsSimulated] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isSimulated) {
      document.body.classList.add('dyslexia-mode')
    } else {
      document.body.classList.remove('dyslexia-mode')
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, isSimulated ? '1' : '0')
    } catch {
      // ignore
    }
  }, [isSimulated])

  return (
    <button
      type="button"
      aria-pressed={isSimulated}
      onClick={() => setIsSimulated((v) => !v)}
      className={
        isSimulated
          ? 'w-full rounded-full border border-red-200 bg-red-50 px-3 py-2 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100'
          : 'w-full rounded-full border border-white/30 bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition hover:bg-white'
      }
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span
            className={
              isSimulated
                ? 'grid h-7 w-7 place-items-center rounded-full bg-red-600 text-white'
                : 'grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-700'
            }
            aria-hidden="true"
          >
            👁️
          </span>
          <span className="leading-none">Simulate Dyslexia</span>
        </span>
        <span
          className={
            isSimulated
              ? 'h-5 w-9 rounded-full bg-red-200 p-0.5'
              : 'h-5 w-9 rounded-full bg-slate-200/80 p-0.5'
          }
          aria-hidden="true"
        >
          <span
            className={
              isSimulated
                ? 'block h-4 w-4 translate-x-4 rounded-full bg-red-600 transition'
                : 'block h-4 w-4 translate-x-0 rounded-full bg-white transition'
            }
          />
        </span>
      </span>
    </button>
  )
}
