import { useEffect, useRef } from 'react'
import Layout from './Layout.jsx'
import { Link, useNavigate } from 'react-router-dom'

export default function GameFrame({ src, title }) {
  const navigate = useNavigate()
  const iframeRef = useRef(null)

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      if (!iframeRef.current?.contentWindow) return
      if (event.source !== iframeRef.current.contentWindow) return

      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type !== 'DYSLEXISCAN_NAVIGATE') return
      if (typeof data.path !== 'string') return

      navigate(data.path)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [navigate])

  return (
    <Layout fullScreen={true}>
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to Games
          </Link>

          <div className="min-w-0 text-right">
            <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
            <div className="truncate text-xs text-slate-500">Embedded module (sandboxed iframe)</div>
          </div>
        </div>

        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          className="block w-full h-[calc(100vh-64px)] border-none rounded-xl shadow-sm bg-white"
          allow="microphone *; camera *; accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
          referrerPolicy="no-referrer"
        />
      </div>
    </Layout>
  )
}
