import { useCallback, useMemo, useState } from 'react'
import axios from 'axios'
import { useDropzone } from 'react-dropzone'
import { jsPDF } from 'jspdf'
import { AlertTriangle, FileText, Gamepad2, GraduationCap, Loader2, ShieldAlert, ShieldCheck, UploadCloud, Volume2 } from 'lucide-react'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import DyslexiaToggle from './DyslexiaToggle.jsx'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function toPercent(n) {
  return Math.round(n * 10) / 10
}

function parseProbability(payload) {
  if (!payload || typeof payload !== 'object') return null

  const candidates = [
    payload.probability,
    payload.p,
    payload.raw_score,
    payload.score,
    payload.normal_probability,
    payload.prob_normal,
  ]

  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }

  return null
}

function riskFromProbability(p) {
  const prob = clamp01(p)
  return (1 - prob) * 100
}

function getBand(riskScore) {
  if (riskScore <= 30) return 'low'
  if (riskScore <= 70) return 'medium'
  return 'high'
}

const BAND_CONFIG = {
  low: {
    label: 'Low Risk',
    ring: 'ring-emerald-500/25',
    bar: 'from-emerald-500 to-emerald-400',
    accent: 'text-emerald-700',
    bg: 'bg-emerald-50',
    icon: ShieldCheck,
    message: 'Great job! Your handwriting looks standard.',
    actionLabel: 'Play Learning Games',
    actionVariant: 'bg-teal-600 hover:bg-teal-700 text-white',
    showPdf: false,
  },
  medium: {
    label: 'Medium Risk',
    ring: 'ring-amber-500/25',
    bar: 'from-amber-500 to-orange-400',
    accent: 'text-amber-700',
    bg: 'bg-amber-50',
    icon: AlertTriangle,
    message: 'Some irregularities detected. Keep practicing!',
    actionLabel: 'Consult Class Teacher',
    actionVariant: 'bg-teal-600 hover:bg-teal-700 text-white',
    showPdf: false,
  },
  high: {
    label: 'High Risk',
    ring: 'ring-rose-500/25',
    bar: 'from-rose-500 to-red-500',
    accent: 'text-rose-700',
    bg: 'bg-rose-50',
    icon: ShieldAlert,
    message: 'High likelihood of reversal patterns detected.',
    actionLabel: 'Download Clinical Report',
    actionVariant: 'bg-teal-600 hover:bg-teal-700 text-white',
    showPdf: true,
  },
}

export default function Scanner() {
  const API_URL = 'http://localhost:5000/predict'
  const showDebug = import.meta.env.DEV

  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [debugImage, setDebugImage] = useState(null)

  const [probability, setProbability] = useState(null)
  const [riskScore, setRiskScore] = useState(null)
  const [responsePayload, setResponsePayload] = useState(null)

  const speakResult = useCallback((text) => {
    if (typeof window === 'undefined') return
    const synth = window.speechSynthesis
    if (!synth) return

    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = 1.0
    utterance.rate = 0.9

    synth.speak(utterance)
  }, [])

  const detectedLetter = useMemo(() => {
    const name = file?.name
    if (typeof name !== 'string' || name.length === 0) return null

    const match = name.match(/[a-zA-Z]/)
    if (!match) return null
    return match[0].toUpperCase()
  }, [file?.name])

  const band = useMemo(() => {
    if (typeof riskScore !== 'number') return null
    return getBand(riskScore)
  }, [riskScore])

  const debugImageUrl = useMemo(() => {
    if (typeof debugImage !== 'string' || debugImage.length === 0) return null
    return `data:image/png;base64,${debugImage}`
  }, [debugImage])

  const bandConfig = band ? BAND_CONFIG[band] : null

  const spokenMessage = useMemo(() => {
    if (!bandConfig) return null

    const prefix = detectedLetter ? `Analysis complete for letter ${detectedLetter}. ` : 'Analysis complete. '

    if (band === 'low') {
      return `${prefix}Great job! That looks like a standard letter. Keep it up!`
    }

    if (band === 'high') {
      return `${prefix}We detected some potential reversal patterns. You might want to try the practice games.`
    }

    return `${prefix}We detected some irregularities. Keep practicing, and consider using the games for support.`
  }, [band, bandConfig, detectedLetter])

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles?.[0]
    if (!f) return

    setError(null)
    setResponsePayload(null)
    setProbability(null)
    setRiskScore(null)
    setDebugImage(null)

    setFile(f)

    const reader = new FileReader()
    reader.onload = () => {
      setPreviewUrl(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => {
      setPreviewUrl(null)
    }
    reader.readAsDataURL(f)
  }, [])

  const onDropRejected = useCallback((fileRejections) => {
    const first = fileRejections?.[0]
    const name = first?.file?.name || 'file'
    setError(`Unsupported image format: ${name}. Please use JPG/PNG/WEBP (or HEIC/HEIF on iPhone).`)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    multiple: false,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'],
    },
    maxFiles: 1,
  })

  const analyze = useCallback(async () => {
    if (!file) {
      setError('Please upload an image first.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const payload = res?.data
      setResponsePayload(payload)

      const dbg = payload?.debug_image
      setDebugImage(typeof dbg === 'string' ? dbg : null)

      const p = parseProbability(payload)
      if (typeof p !== 'number') {
        throw new Error('Backend response did not include a probability value.')
      }

      const p01 = clamp01(p)
      const risk = riskFromProbability(p01)

      setProbability(p01)
      setRiskScore(risk)
    } catch (e) {
      const message =
        e?.response?.data?.error ||
        e?.message ||
        'Failed to analyze image. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [API_URL, file])

  const reset = useCallback(() => {
    setFile(null)
    setPreviewUrl(null)
    setProbability(null)
    setRiskScore(null)
    setResponsePayload(null)
    setDebugImage(null)
    setError(null)
    setLoading(false)
  }, [])

  const generateReport = useCallback(() => {
    if (!previewUrl || typeof riskScore !== 'number') return

    const dateStr = new Date().toLocaleString()
    const scanId = `DS-${Date.now().toString(36).toUpperCase()}`
    const deviceSource =
      typeof navigator !== 'undefined' && navigator.userAgent
        ? `${navigator.userAgent.slice(0, 54)}${navigator.userAgent.length > 54 ? '…' : ''}`
        : 'Web Upload'

    const bandLocal = getBand(riskScore)
    const cfg = BAND_CONFIG[bandLocal]

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'pt',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 44
    const contentW = pageWidth - margin * 2

    const NAVY = { r: 0, g: 51, b: 102 }

    doc.setFillColor(NAVY.r, NAVY.g, NAVY.b)
    doc.rect(0, 0, pageWidth, 74, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('DYSLEXISCAN AI SCREENING', margin, 42)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Automated handwriting screening report (A4)', margin, 60)

    doc.setTextColor(15, 23, 42)

    const infoY = 92
    const infoH = 64
    doc.setFillColor(245, 248, 252)
    doc.rect(margin, infoY, contentW, infoH, 'F')
    doc.setDrawColor(203, 213, 225)
    doc.rect(margin, infoY, contentW, infoH, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Patient / Scan Info', margin + 12, infoY + 20)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Date: ${dateStr}`, margin + 12, infoY + 40)
    doc.text(`Scan ID: ${scanId}`, margin + 220, infoY + 40)
    doc.text(`Device Source: ${deviceSource}`, margin + 12, infoY + 56)

    const riskY = infoY + infoH + 18
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Risk Summary', margin, riskY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Risk Score: ${toPercent(riskScore)}%`, margin, riskY + 18)
    doc.text(`Risk Band: ${cfg.label}`, margin + 190, riskY + 18)

    const barX = margin
    const barY = riskY + 34
    const barW = contentW
    const barH = 12
    const segW = barW / 3

    doc.setFillColor(16, 185, 129)
    doc.rect(barX, barY, segW, barH, 'F')
    doc.setFillColor(245, 158, 11)
    doc.rect(barX + segW, barY, segW, barH, 'F')
    doc.setFillColor(239, 68, 68)
    doc.rect(barX + segW * 2, barY, segW, barH, 'F')

    doc.setDrawColor(148, 163, 184)
    doc.rect(barX, barY, barW, barH, 'S')

    const pointerRaw = barX + (Math.max(0, Math.min(100, riskScore)) / 100) * barW
    const pointerX = Math.max(barX + 6, Math.min(barX + barW - 6, pointerRaw))
    doc.setFillColor(15, 23, 42)
    doc.triangle(pointerX, barY - 1, pointerX - 6, barY - 12, pointerX + 6, barY - 12, 'F')
    doc.setFontSize(9)
    doc.text('LOW', barX, barY + 26)
    doc.text('MID', barX + segW, barY + 26)
    doc.text('HIGH', barX + segW * 2, barY + 26)

    const findingsY = barY + 44
    const findingsH = 102
    doc.setFillColor(255, 255, 255)
    doc.rect(margin, findingsY, contentW, findingsH, 'F')
    doc.setDrawColor(203, 213, 225)
    doc.rect(margin, findingsY, contentW, findingsH, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Clinical Findings', margin + 12, findingsY + 22)

    const detailedFindings =
      bandLocal === 'high'
        ? 'The analysis detected significant structural irregularities consistent with reversal patterns. These signals may indicate elevated risk and warrant further review.'
        : bandLocal === 'medium'
          ? 'The analysis detected moderate irregularities in structural geometry. Continued monitoring and practice are recommended, especially for commonly reversed characters.'
          : 'The analysis detected predominantly standard structural geometry with minimal irregularities. Continue routine practice and periodic screening.'

    const backendFinding =
      typeof responsePayload?.analysis === 'string' && responsePayload.analysis.length > 0
        ? `Model Note: ${responsePayload.analysis}`
        : null

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const findingsText = backendFinding ? `${detailedFindings}\n\n${backendFinding}` : detailedFindings
    const findingsLines = doc.splitTextToSize(findingsText, contentW - 24)
    doc.text(findingsLines, margin + 12, findingsY + 42)

    const figY = findingsY + findingsH + 18
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Evidence (Dual-View)', margin, figY)

    const gap = 14
    const imgBoxY = figY + 12
    const imgBoxH = 186
    const imgBoxW = (contentW - gap) / 2

    const leftX = margin
    const rightX = margin + imgBoxW + gap

    doc.setDrawColor(203, 213, 225)
    doc.setFillColor(250, 252, 255)
    doc.rect(leftX, imgBoxY, imgBoxW, imgBoxH, 'FD')
    doc.rect(rightX, imgBoxY, imgBoxW, imgBoxH, 'FD')

    const origType = previewUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
    doc.addImage(previewUrl, origType, leftX + 8, imgBoxY + 12, imgBoxW - 16, imgBoxH - 40, undefined, 'FAST')

    if (debugImageUrl) {
      doc.addImage(debugImageUrl, 'PNG', rightX + 8, imgBoxY + 12, imgBoxW - 16, imgBoxH - 40, undefined, 'FAST')
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text('AI Vision unavailable', rightX + 16, imgBoxY + imgBoxH / 2)
      doc.setTextColor(15, 23, 42)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Figure A: Subject Handwriting', leftX + 8, imgBoxY + imgBoxH - 14)
    doc.text('Figure B: Structural Neural Analysis', rightX + 8, imgBoxY + imgBoxH - 14)

    const recY = imgBoxY + imgBoxH + 22
    const recH = 100
    doc.setFillColor(245, 248, 252)
    doc.rect(margin, recY, contentW, recH, 'F')
    doc.setDrawColor(203, 213, 225)
    doc.rect(margin, recY, contentW, recH, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Recommended Actions', margin + 12, recY + 22)

    const recommendations =
      bandLocal === 'high'
        ? 'Refer to specialist for comprehensive assessment. Consider structured interventions and formal screening in an educational or clinical setting.'
        : bandLocal === 'medium'
          ? 'Consult class teacher and continue targeted practice. Recommended exercises: guided tracing, letter formation drills, and supervised writing sessions.'
          : 'Continue monitoring. Recommended exercises: letter tracing games, slow-copy practice, and short daily handwriting sessions.'

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const recLines = doc.splitTextToSize(recommendations, contentW - 24)
    doc.text(recLines, margin + 12, recY + 42)

    doc.setDrawColor(226, 232, 240)
    doc.line(margin, pageHeight - 44, pageWidth - margin, pageHeight - 44)
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(
      'Generated by DyslexiScan AI • Not a definitive medical diagnosis.',
      margin,
      pageHeight - 26,
    )

    doc.save(`dyslexiscan_report_${scanId}.pdf`)
  }, [debugImageUrl, previewUrl, responsePayload, riskScore])

  const actionHandler = useCallback(() => {
    if (!bandConfig?.showPdf) return
    generateReport()
  }, [bandConfig, generateReport])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[290px_1fr]">
        <aside className="sticky top-0 hidden h-screen overflow-auto bg-gradient-to-br from-teal-600 to-blue-600 px-4 py-6 text-white md:block">
          <div className="flex items-center gap-3 px-2 pb-5">
            <img className="h-8 w-8 rounded-lg bg-white/10 p-1" src="/logo.png" alt="DyslexiScan logo" />
            <div className="min-w-0">
              <div className="truncate text-lg font-extrabold">DyslexiScan</div>
              <div className="truncate text-xs font-medium text-white/90">Teacher/Admin Panel</div>
            </div>
          </div>

          <nav className="mt-2 grid gap-2">
            <NavLink
              to="/teacher"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-white/20' : 'hover:bg-white/15',
                )
              }
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">🏠</span>
              Dashboard
            </NavLink>

            <NavLink
              to="/handwriting"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-white/20' : 'hover:bg-white/15',
                )
              }
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">✍️</span>
              Handwriting Analysis
            </NavLink>

            <NavLink
              to="/games"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-white/20' : 'hover:bg-white/15',
                )
              }
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">🎮</span>
              Game Module
            </NavLink>

            <NavLink
              to="/monitoring"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-white/20' : 'hover:bg-white/15',
                )
              }
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">👨‍👩‍👧</span>
              Monitoring
            </NavLink>

            <NavLink
              to="/about"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-white/20' : 'hover:bg-white/15',
                )
              }
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">🧠</span>
              About
            </NavLink>

            <Link
              to="/"
              className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-white/15"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">🚪</span>
              Logout
            </Link>
          </nav>

          <div className="mt-6 border-t border-white/20 px-2 pt-4 text-xs leading-relaxed text-white/90">
            Dyslexia-friendly UI • High readability • Calm design
          </div>

          <div className="mt-4 px-2">
            <DyslexiaToggle />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/75 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-tight text-gray-900">
                  Handwriting Analysis
                </div>
                <div className="mt-0.5 text-sm text-gray-500">
                  Upload a single capital letter (A–Z) for AI screening.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/teacher')}
                  className="hidden rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 sm:inline-flex"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:p-6">
              <header className="flex flex-col gap-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  <span className="h-2 w-2 rounded-full bg-teal-600" />
                  Scanner Module
                </div>
                <h1 className="text-balance text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                  DyslexiScan AI Analysis
                </h1>
                <p className="max-w-2xl text-pretty text-sm text-gray-600 sm:text-base">
                  Upload a handwriting sample of a single <span className="font-semibold text-gray-900">capital letter (A–Z)</span>. The system estimates the probability of standard (normal) handwriting and inverts it to compute dyslexia risk.
                </p>
              </header>

              <div className="mt-6 grid gap-6 lg:grid-cols-5">
                <section className="lg:col-span-3">
                  <div
                    {...getRootProps()}
                    className={cn(
                      'group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition',
                      isDragActive
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-teal-200 bg-white hover:bg-gray-50',
                    )}
                  >
                    <input
                      {...getInputProps({
                        accept: 'image/*',
                        capture: 'environment',
                      })}
                    />

                    <div className="flex flex-col items-center gap-3">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-teal-100">
                        <UploadCloud className="h-6 w-6 text-teal-600" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {isDragActive ? 'Drop the image to upload' : 'Drag & Drop your image here'}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          Upload a photo of a single capital letter (A–Z).
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          PNG / JPG / WEBP · 1 file
                        </p>
                      </div>

                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                        Take Photo
                      </div>
                    </div>

                    {previewUrl ? (
                      <div className="mt-6 w-full">
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                          <img
                            src={previewUrl}
                            alt="Uploaded handwriting sample"
                            className="h-56 w-full object-contain"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-600">
                          <span className="truncate">{file?.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              reset()
                            }}
                            className="rounded-md px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={analyze}
                      disabled={!file || loading}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition',
                        !file || loading
                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                          : 'bg-teal-600 text-white hover:bg-teal-700',
                      )}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      Analyze Sample
                    </button>

                    <button
                      type="button"
                      onClick={reset}
                      disabled={loading && !file}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                      Reset
                    </button>

                    <div className="text-xs text-gray-500">
                      Backend: <span className="font-mono text-gray-700">{API_URL}</span>
                    </div>
                  </div>

                  {error ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="mt-0.5 h-4 w-4 text-rose-600" />
                        <div className="min-w-0">
                          <div className="font-semibold">Analysis Failed</div>
                          <div className="mt-1 text-rose-800/90">{error}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <aside className="lg:col-span-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Result
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <div className="text-lg font-semibold text-gray-900">
                            {bandConfig ? bandConfig.label : 'Awaiting Analysis'}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (spokenMessage) speakResult(spokenMessage)
                            }}
                            disabled={!spokenMessage}
                            className={cn(
                              'inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-sm transition',
                              spokenMessage
                                ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400',
                            )}
                            title="Listen"
                            aria-label="Listen to result"
                          >
                            <Volume2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {bandConfig ? (
                        <div className={cn('inline-flex rounded-2xl p-2 ring-1', bandConfig.bg, bandConfig.ring)}>
                          <bandConfig.icon className={cn('h-5 w-5', bandConfig.accent)} />
                        </div>
                      ) : (
                        <div className="inline-flex rounded-2xl bg-gray-50 p-2 ring-1 ring-gray-200">
                          <FileText className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      <div className="flex items-end justify-between">
                        <div className="text-4xl font-semibold tracking-tight text-gray-900">
                          {typeof riskScore === 'number' ? `${toPercent(riskScore)}%` : '--'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {typeof probability === 'number'
                            ? `p(normal) = ${toPercent(probability)} (inverted)`
                            : 'Risk Score = (1 - p) × 100'}
                        </div>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={cn(
                            'h-full rounded-full bg-gradient-to-r transition-all',
                            bandConfig ? bandConfig.bar : 'from-gray-400 to-gray-300',
                          )}
                          style={{
                            width:
                              typeof riskScore === 'number'
                                ? `${Math.max(0, Math.min(100, riskScore))}%`
                                : '0%',
                          }}
                        />
                      </div>

                      <div className="mt-4 text-sm text-gray-700">
                        {bandConfig
                          ? bandConfig.message
                          : 'Upload an image and click Analyze Sample to get a result.'}
                      </div>

                      {previewUrl && debugImageUrl ? (
                        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Visual Analysis
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                              <div className="px-3 py-2 text-xs font-semibold text-gray-700">Original Input</div>
                              <img
                                src={previewUrl}
                                alt="Original input"
                                className="h-40 w-full object-contain"
                              />
                            </div>

                            <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white ring-1 ring-emerald-100">
                              <div className="flex items-center justify-between px-3 py-2">
                                <div className="text-xs font-semibold text-gray-700">AI Neural Vision</div>
                                <div className="text-[10px] font-mono text-emerald-700">X-RAY</div>
                              </div>
                              <img
                                src={debugImageUrl}
                                alt="AI contour vision"
                                className="h-40 w-full bg-black object-contain"
                              />
                            </div>
                          </div>

                          <div className="mt-3 text-xs italic text-gray-500">
                            Structural geometry extracted for analysis.
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-5">
                        {bandConfig?.showPdf ? (
                          <>
                            <button
                              type="button"
                              onClick={actionHandler}
                              disabled={loading}
                              className={cn(
                                'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition',
                                loading
                                  ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                  : bandConfig.actionVariant,
                              )}
                            >
                              <FileText className="h-4 w-4" />
                              {bandConfig.actionLabel}
                            </button>

                            <div className="mt-2 text-xs text-gray-500">
                              PDF will include the original upload and AI neural vision evidence.
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {showDebug && responsePayload ? (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Debug Payload
                      </div>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-gray-950 p-3 text-xs text-gray-100">
                        {JSON.stringify(responsePayload, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </aside>
              </div>

              <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Integrated Care Ecosystem
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Launch connected tools for practice and educator support.
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => navigate('/games')}
                    className="group inline-flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
                  >
                    <span className="inline-flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 ring-1 ring-teal-100">
                        <Gamepad2 className="h-5 w-5 text-teal-700" />
                      </span>
                      <span>
                        <div className="text-gray-900">Neuro-Plasticity Games</div>
                        <div className="mt-0.5 text-xs font-normal text-gray-500">
                          Practice + training suite
                        </div>
                      </span>
                    </span>
                    <span className="text-xs font-normal text-teal-700 group-hover:text-teal-800">
                      Open
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/teacher')}
                    className="group inline-flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
                  >
                    <span className="inline-flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 ring-1 ring-teal-100">
                        <GraduationCap className="h-5 w-5 text-teal-700" />
                      </span>
                      <span>
                        <div className="text-gray-900">Educator Dashboard</div>
                        <div className="mt-0.5 text-xs font-normal text-gray-500">
                          Teacher insights + tracking
                        </div>
                      </span>
                    </span>
                    <span className="text-xs font-normal text-teal-700 group-hover:text-teal-800">
                      Open
                    </span>
                  </button>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
