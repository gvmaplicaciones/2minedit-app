import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import FeedbackButton from '../components/FeedbackButton'
import RelatedTools from '../components/RelatedTools'
import ToolSeoSection from '../components/ToolSeoSection'

const CORE_JS   = `${location.origin}/ffmpeg-core.js`
const CORE_WASM = `${location.origin}/ffmpeg-core.wasm`

const MODES = [
  { key: 'high',    crf: 26, labelES: 'Alta calidad',      labelEN: 'High quality' },
  { key: 'balance', crf: 32, labelES: 'Equilibrado',       labelEN: 'Balanced' },
  { key: 'max',     crf: 40, labelES: 'Máxima compresión', labelEN: 'Max compression' },
]

function fmt(bytes) {
  if (!bytes) return '—'
  return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export default function CompressVideo() {
  const { i18n } = useTranslation()
  const loc = useLocation()
  const isEN = i18n.language === 'en' || loc.pathname.startsWith('/en')

  const [file, setFile]               = useState(null)
  const [mode, setMode]               = useState('balance')
  const [status, setStatus]           = useState('idle')
  const [progress, setProgress]       = useState(0)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [outputSize, setOutputSize]   = useState(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [isDragging, setIsDragging]   = useState(false)
  const ffmpegRef    = useRef(null)
  const fileInputRef = useRef(null)
  const downloadRef  = useRef(null)

  const title = isEN ? 'Compress Video Online Free | 2minedit — No install'
                     : 'Comprimir vídeo online gratis | 2minedit — Sin instalar'
  const desc  = isEN ? 'Reduce your video file size online for free. No signup, no watermark. Compress MP4, MOV and WebM directly from your browser.'
                     : 'Reduce el tamaño de tus vídeos online gratis. Sin registrarte, sin marca de agua. Comprime MP4, MOV y WebM directamente desde el navegador.'

  function handleDrop(e) { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }

  async function handleCompress() {
    if (!file) return
    setStatus('loading'); setProgress(2); setErrorMsg(''); setDownloadUrl(null); setOutputSize(null)
    try {
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg
      ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(5 + p * 90)))
      await ffmpeg.load({ coreURL: CORE_JS, wasmURL: CORE_WASM })
      const ext = file.name.split('.').pop().toLowerCase() || 'mp4'
      await ffmpeg.writeFile(`input.${ext}`, await fetchFile(file))
      const crf = MODES.find(m => m.key === mode)?.crf ?? 28
      await ffmpeg.exec(['-i', `input.${ext}`, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', 'output.mp4'])
      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      if (blob.size >= file.size) {
        setStatus('already_optimized')
        return
      }
      setOutputSize(blob.size)
      setDownloadUrl(URL.createObjectURL(blob))
      setStatus('done'); setProgress(100)
      setTimeout(() => downloadRef.current?.click(), 200)
    } catch (err) {
      setErrorMsg(err?.message || (isEN ? 'Unknown error.' : 'Error desconocido.'))
      setStatus('error')
    }
  }

  function reset() {
    setFile(null); setStatus('idle'); setProgress(0); setDownloadUrl(null); setOutputSize(null); setErrorMsg('')
    if (ffmpegRef.current) { try { ffmpegRef.current.terminate() } catch (_) {} ffmpegRef.current = null }
  }

  const savings = file && outputSize ? Math.round((1 - outputSize / file.size) * 100) : null

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={isEN ? 'https://2minedit.com/en/compress-video' : 'https://2minedit.com/compress-video'} />
        <link rel="alternate" hrefLang="es" href="https://2minedit.com/compress-video" />
        <link rel="alternate" hrefLang="en" href="https://2minedit.com/en/compress-video" />
        <link rel="alternate" hrefLang="x-default" href="https://2minedit.com/compress-video" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": isEN ? "Compress Video Online Free | 2minedit" : "Comprimir vídeo online gratis | 2minedit",
          "url": isEN ? "https://2minedit.com/en/compress-video" : "https://2minedit.com/compress-video",
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": isEN
            ? "Reduce your video file size online for free. No signup, no watermark. Compress MP4, MOV and WebM directly from your browser."
            : "Reduce el tamaño de tus vídeos online gratis. Sin registrarte, sin marca de agua. Comprime MP4, MOV y WebM directamente desde el navegador."
        })}</script>
      </Helmet>

      <ToolLayout isEN={isEN}>
        <ToolHeader
          h1={isEN ? 'Compress video online' : 'Comprimir vídeo online'}
          sub={isEN ? 'Reduce your video file size. No signup, no watermark, processed in your browser.'
                    : 'Reduce el tamaño de tu vídeo. Sin registro, sin marca de agua, procesado en tu navegador.'}
        />

        <UploadZone file={file} isDragging={isDragging} fileInputRef={fileInputRef} isEN={isEN}
          accept=".mp4,.mov,.webm,video/*" acceptLabel="MP4, MOV, WebM"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); e.target.value = '' }}
          onReset={reset} status={status}
        />

        {file && status === 'idle' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>{isEN ? 'Compression mode' : 'Modo de compresión'}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {MODES.map(m => (
                  <button key={m.key} onClick={() => setMode(m.key)} style={{
                    flex: 1, padding: '10px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid',
                    borderColor: mode === m.key ? '#e87040' : '#2a2a2a',
                    backgroundColor: mode === m.key ? '#1f1008' : '#141414',
                    color: mode === m.key ? '#e87040' : '#666', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {isEN ? m.labelEN : m.labelES}
                  </button>
                ))}
              </div>
            </div>
            <PrimaryBtn onClick={handleCompress}>{isEN ? 'Compress video' : 'Comprimir vídeo'}</PrimaryBtn>
          </>
        )}

        <ProgressBar status={status} progress={progress} label={isEN ? 'Compressing...' : 'Comprimiendo...'} />

        {status === 'done' && (
          <ResultCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><p style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{isEN ? 'Before' : 'Antes'}</p><p style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{fmt(file.size)}</p></div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <div><p style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{isEN ? 'After' : 'Después'}</p><p style={{ fontSize: 15, fontWeight: 600, color: '#e87040' }}>{fmt(outputSize)}</p></div>
              {savings > 0 && <div style={{ backgroundColor: '#1f1008', border: '1px solid #3a1a08', borderRadius: 8, padding: '6px 12px' }}><p style={{ color: '#e87040', fontWeight: 700 }}>−{savings}%</p></div>}
            </div>
            <a ref={downloadRef} href={downloadUrl} download="video-comprimido.mp4" style={btnStyle}>
              ⬇ {isEN ? 'Download MP4' : 'Descargar MP4'}
            </a>
            <ResetBtn onClick={reset} isEN={isEN} label={isEN ? 'Compress another video' : 'Comprimir otro vídeo'} />
          </ResultCard>
        )}

        {status === 'already_optimized' && (
          <ResultCard>
            <p style={{ fontSize: 14, color: '#f0f0f0', fontWeight: 600, marginBottom: 8 }}>
              {isEN ? 'Your video is already well compressed' : 'Tu vídeo ya está bien comprimido'}
            </p>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
              {isEN
                ? 'Re-encoding would produce a larger file. No savings possible with this mode.'
                : 'Recodificar produciría un archivo mayor. No hay ahorro posible con este modo.'}
            </p>
            <ResetBtn onClick={reset} isEN={isEN} label={isEN ? 'Try with another video' : 'Probar con otro vídeo'} />
          </ResultCard>
        )}

        <ErrorCard status={status} errorMsg={errorMsg} onReset={reset} isEN={isEN} />
        <ToolSeoSection toolKey="compressVideo" />
        <RelatedTools currentKey="compressVideo" isEN={isEN} />
      </ToolLayout>

      <FeedbackButton />
    </>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

export function ToolLayout({ isEN, children }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '80px 32px 80px' }}>
        {children}
      </div>
    </div>
  )
}

export function ToolHeader({ h1, sub }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 10 }}>{h1}</h1>
      <p style={{ fontSize: 14, color: '#666', lineHeight: 1.65 }}>{sub}</p>
    </div>
  )
}

export function UploadZone({ file, isDragging, fileInputRef, isEN, accept, acceptLabel, onDragOver, onDragLeave, onDrop, onChange, onReset, status }) {
  if (!file) return (
    <div
      style={{ border: `2px dashed ${isDragging ? '#e87040' : '#2a2a2a'}`, backgroundColor: isDragging ? '#1f1008' : '#141414', borderRadius: 14, cursor: 'pointer', marginBottom: 20, transition: 'all 0.15s' }}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      <input ref={fileInputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={onChange} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '52px 24px' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>{isEN ? 'Upload your file' : 'Sube tu archivo'}</p>
        <p style={{ fontSize: 11, color: '#555' }}>{acceptLabel}</p>
      </div>
    </div>
  )
  return (
    <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e87040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M10 9l5 3-5 3V9z"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
        <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
      </div>
      {status === 'idle' && <button onClick={onReset} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>}
    </div>
  )
}

export function ProgressBar({ status, progress, label }) {
  if (status !== 'loading') return null
  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 }}>{label}</p>
      <div style={{ backgroundColor: '#1f1f1f', borderRadius: 99, height: 4, overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#e87040', height: 4, borderRadius: 99, width: `${progress}%`, transition: 'width 0.3s' }} />
      </div>
      <p style={{ fontSize: 11, color: '#444', textAlign: 'center', marginTop: 8 }}>{progress}%</p>
    </div>
  )
}

export function ResultCard({ children }) {
  return <div style={{ marginTop: 24, backgroundColor: '#141414', border: '1px solid #242424', borderRadius: 14, padding: '20px 24px' }}>{children}</div>
}

export function ErrorCard({ status, errorMsg, onReset, isEN }) {
  if (status !== 'error') return null
  return (
    <div style={{ marginTop: 24, backgroundColor: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 12, padding: 20 }}>
      <p style={{ color: '#e87040', fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>
      <button onClick={onReset} style={btnStyle}>{isEN ? 'Try again' : 'Reintentar'}</button>
    </div>
  )
}

export function PrimaryBtn({ onClick, children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...btnStyle, width: '100%', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  )
}

export function ResetBtn({ onClick, label }) {
  return <button onClick={onClick} style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{label}</button>
}

export const btnStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '11px 24px', backgroundColor: '#e87040', color: '#000',
  fontWeight: 700, fontSize: 14, borderRadius: 10, border: 'none',
  cursor: 'pointer', textDecoration: 'none', transition: 'opacity 0.15s',
}
