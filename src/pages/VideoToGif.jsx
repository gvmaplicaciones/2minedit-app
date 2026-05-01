import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import FeedbackButton from '../components/FeedbackButton'
import RelatedTools from '../components/RelatedTools'
import ToolSeoSection from '../components/ToolSeoSection'
import { ToolLayout, ToolHeader, UploadZone, ProgressBar, ResultCard, ErrorCard, PrimaryBtn, ResetBtn, btnStyle } from './CompressVideo'

const CORE_JS   = `${location.origin}/ffmpeg-core.js`
const CORE_WASM = `${location.origin}/ffmpeg-core.wasm`

const SIZES = [{ key: '320', label: '320px' }, { key: '480', label: '480px' }, { key: '640', label: '640px' }]

function fmt(bytes) {
  if (!bytes) return '—'
  return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export default function VideoToGif() {
  const loc = useLocation()
  const isEN = loc.pathname.startsWith('/en')

  const [file, setFile]               = useState(null)
  const [start, setStart]             = useState(0)
  const [duration, setDuration]       = useState(5)
  const [size, setSize]               = useState('480')
  const [status, setStatus]           = useState('idle')
  const [progress, setProgress]       = useState(0)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [gifSize, setGifSize]         = useState(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [isDragging, setIsDragging]   = useState(false)
  const ffmpegRef    = useRef(null)
  const fileInputRef = useRef(null)
  const downloadRef  = useRef(null)

  async function handleConvert() {
    if (!file) return
    setStatus('loading'); setProgress(5); setErrorMsg(''); setDownloadUrl(null); setGifSize(null)
    try {
      const ffmpeg = new FFmpeg(); ffmpegRef.current = ffmpeg
      ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(5 + p * 85)))
      await ffmpeg.load({ coreURL: CORE_JS, wasmURL: CORE_WASM })
      const ext = file.name.split('.').pop().toLowerCase() || 'mp4'
      await ffmpeg.writeFile(`input.${ext}`, await fetchFile(file))
      setProgress(20)
      await ffmpeg.exec(['-ss', String(start), '-t', String(Math.min(duration, 15)), '-i', `input.${ext}`, '-vf', `fps=15,scale=${size}:-1:flags=lanczos,palettegen`, '-y', 'palette.png'])
      setProgress(55)
      await ffmpeg.exec(['-ss', String(start), '-t', String(Math.min(duration, 15)), '-i', `input.${ext}`, '-i', 'palette.png', '-filter_complex', `fps=15,scale=${size}:-1:flags=lanczos[x];[x][1:v]paletteuse`, '-y', 'output.gif'])
      const data = await ffmpeg.readFile('output.gif')
      const blob = new Blob([data.buffer], { type: 'image/gif' })
      setGifSize(blob.size)
      setDownloadUrl(URL.createObjectURL(blob))
      setStatus('done'); setProgress(100)
      setTimeout(() => downloadRef.current?.click(), 200)
    } catch (err) {
      setErrorMsg(err?.message || (isEN ? 'Unknown error.' : 'Error desconocido.'))
      setStatus('error')
    }
  }

  function reset() {
    setFile(null); setStatus('idle'); setProgress(0); setDownloadUrl(null); setGifSize(null); setErrorMsg(''); setStart(0); setDuration(5)
    if (ffmpegRef.current) { try { ffmpegRef.current.terminate() } catch (_) {} ffmpegRef.current = null }
  }

  const inputStyle = { width: '100%', backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#fff', outline: 'none' }

  return (
    <>
      <Helmet>
        <title>{isEN ? 'Convert Video to GIF Online Free | 2minedit' : 'Convertir vídeo a GIF online gratis | 2minedit'}</title>
        <meta name="description" content={isEN ? 'Convert any video to animated GIF online for free. No signup, no watermark. Create GIFs from MP4, MOV or WebM in seconds.' : 'Convierte cualquier vídeo a GIF animado online gratis. Sin registrarte, sin marca de agua.'} />
        <link rel="canonical" href={isEN ? 'https://www.2minedit.com/en/video-to-gif' : 'https://www.2minedit.com/video-to-gif'} />
        <link rel="alternate" hrefLang="es" href="https://www.2minedit.com/video-to-gif" />
        <link rel="alternate" hrefLang="en" href="https://www.2minedit.com/en/video-to-gif" />
        <link rel="alternate" hrefLang="x-default" href="https://www.2minedit.com/video-to-gif" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": isEN ? "Convert Video to GIF Online Free | 2minedit" : "Convertir vídeo a GIF online gratis | 2minedit",
          "url": isEN ? "https://www.2minedit.com/en/video-to-gif" : "https://www.2minedit.com/video-to-gif",
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": isEN
            ? "Convert any video to animated GIF online for free. No signup, no watermark. Create GIFs from MP4, MOV or WebM in seconds."
            : "Convierte cualquier vídeo a GIF animado online gratis. Sin registrarte, sin marca de agua."
        })}</script>
      </Helmet>

      <ToolLayout isEN={isEN}>
        <ToolHeader
          h1={isEN ? 'Video to GIF' : 'Vídeo a GIF'}
          sub={isEN ? 'Convert any video clip to animated GIF. No signup, processed in your browser.'
                    : 'Convierte cualquier clip de vídeo a GIF animado. Sin registro, procesado en tu navegador.'}
        />

        <UploadZone file={file} isDragging={isDragging} fileInputRef={fileInputRef} isEN={isEN}
          accept=".mp4,.mov,.webm,video/*" acceptLabel="MP4, MOV, WebM"
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
          onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); e.target.value = '' }}
          onReset={reset} status={status}
        />

        {file && status === 'idle' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 8 }}>{isEN ? 'Start (seconds)' : 'Inicio (segundos)'}</label>
                <input type="number" min="0" value={start} onChange={e => setStart(Math.max(0, Number(e.target.value)))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 8 }}>{isEN ? 'Duration (max 15s)' : 'Duración (máx 15s)'}</label>
                <input type="number" min="1" max="15" value={duration} onChange={e => setDuration(Math.min(15, Math.max(1, Number(e.target.value))))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>{isEN ? 'Output size' : 'Tamaño de salida'}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {SIZES.map(s => (
                  <button key={s.key} onClick={() => setSize(s.key)} style={{
                    flex: 1, padding: '10px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: '1px solid', borderColor: size === s.key ? '#e87040' : '#2a2a2a',
                    backgroundColor: size === s.key ? '#1f1008' : '#141414',
                    color: size === s.key ? '#e87040' : '#666', cursor: 'pointer', transition: 'all 0.15s',
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
            <PrimaryBtn onClick={handleConvert}>{isEN ? 'Convert to GIF' : 'Convertir a GIF'}</PrimaryBtn>
          </>
        )}

        <ProgressBar status={status} progress={progress} label={isEN ? 'Creating GIF...' : 'Creando GIF...'} />

        {status === 'done' && (
          <ResultCard>
            {downloadUrl && <img src={downloadUrl} alt="GIF preview" style={{ width: '100%', borderRadius: 10, marginBottom: 16, maxHeight: 280, objectFit: 'contain', backgroundColor: '#0f0f0f' }} />}
            <p style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>{isEN ? 'File size' : 'Tamaño'}: <span style={{ color: '#fff' }}>{fmt(gifSize)}</span></p>
            <a ref={downloadRef} href={downloadUrl} download="animation.gif" style={{ ...btnStyle, display: 'flex', width: '100%', justifyContent: 'center', marginBottom: 12 }}>
              ⬇ {isEN ? 'Download GIF' : 'Descargar GIF'}
            </a>
            <ResetBtn onClick={reset} label={isEN ? 'Convert another video' : 'Convertir otro vídeo'} />
          </ResultCard>
        )}

        <ErrorCard status={status} errorMsg={errorMsg} onReset={reset} isEN={isEN} />
        <ToolSeoSection toolKey="videoToGif" />
        <RelatedTools currentKey="videoToGif" isEN={isEN} />
      </ToolLayout>

      <FeedbackButton />
    </>
  )
}
