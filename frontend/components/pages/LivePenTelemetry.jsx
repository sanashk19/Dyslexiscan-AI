import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:5000/api/pen-status'

function clampPercent(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function ProgressRow({ label, value }) {
  const pct = clampPercent(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.92)', letterSpacing: 0.2 }}>{label}</div>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(226,232,240,0.92)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pct}%
        </div>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: 'rgba(148,163,184,0.18)',
          overflow: 'hidden',
          border: '1px solid rgba(148,163,184,0.18)',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(56,189,248,0.95), rgba(167,139,250,0.95))',
            transition: 'width 120ms linear',
          }}
        />
      </div>
    </div>
  )
}

export default function LivePenTelemetry() {
  const [telemetry, setTelemetry] = useState({
    grip_1_pressure: 0,
    grip_2_pressure: 0,
    is_gripping_hard: false,
  })
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchTelemetry() {
      try {
        const res = await fetch(API_URL, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return

        setTelemetry({
          grip_1_pressure: clampPercent(data?.grip_1_pressure),
          grip_2_pressure: clampPercent(data?.grip_2_pressure),
          is_gripping_hard: Boolean(data?.is_gripping_hard),
        })
        setConnected(true)
      } catch (_) {
        if (cancelled) return
        setConnected(false)
      }
    }

    fetchTelemetry()
    const id = setInterval(fetchTelemetry, 150)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 320,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          padding: 14,
          borderRadius: 16,
          background: 'rgba(2, 6, 23, 0.72)',
          border: '1px solid rgba(148,163,184,0.22)',
          boxShadow: '0 18px 55px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: '#E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>Live Pen Telemetry</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.9)' }}>Pressure stream</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: '#EF4444',
                    boxShadow: '0 0 0 3px rgba(239,68,68,0.18)',
                  }}
                />
                <span style={{ fontSize: 11, color: 'rgba(254,202,202,0.95)' }}>Hardware Disconnected</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: '#22C55E',
                    boxShadow: '0 0 0 3px rgba(34,197,94,0.18)',
                  }}
                />
                <span style={{ fontSize: 11, color: 'rgba(187,247,208,0.95)' }}>Connected</span>
              </div>
            )}

            {telemetry.is_gripping_hard ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(245, 158, 11, 0.16)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: 'rgba(253, 230, 138, 0.95)',
                }}
              >
                Grip too hard
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ProgressRow label="Grip 1" value={telemetry.grip_1_pressure} />
          <ProgressRow label="Grip 2" value={telemetry.grip_2_pressure} />
        </div>
      </div>
    </div>
  )
}
