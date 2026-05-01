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

const FORMATS = [
  { key: 'mp3', ext: 'mp3', mime: 'audio/mpeg',  codec: ['-vn', '-acodec', 'libmp3lame', '-q:a', '2'] },
  { key: 'aac', ext: 'aac', mime: 'audio/aac',   codec: ['-vn', '-acodec', 'aac', '-b:a', '192k'] },
  { key: 'wav', ext: 'wav', mime: 'audio/wav',   codec: ['-vn', '-acodec', 'pcm_s16le'] },
]

export default function ExtractAudio() {
  const loc = useLocation()
  const isEN = loc.pathname.startsWith('/en')

  const [file, setFile]               = useState(null)
  const [format, setFormat]           = useState('mp3')
  const [status, setStatus]           = useState('idle')
  const [progress, setProgress]       = useState(0)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [isDragging, setIsDragging]   = useState(false)
  const ffmpegRef    = useRef(null)
  const fileInputRef = useRef(null)
  const downloadRef  = useRef(null)

  async function handleExtract() {
    if (!file) return
    setStatus('loading'); setProgress(5); setErrorMsg(''); setDownloadUrl(null)
    try {
      const ffmpeg = new FFmpeg(); ffmpegRef.current = ffmpeg
      ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(5 + p * 90)))
      await ffmpeg.load({ coreURL: CORE_JS, wasmURL: CORE_WASM })
      const ext = file.name.split('.').pop().toLowerCase() || 'mp4'
      const fmt = FORMATS.find(f => f.key === format)
      await ffmpeg.writeFile(`input.${ext}`, await fetchFile(file))
      await ffmpeg.exec(['-i', `input.${ext}`, ...fmt.codec, '-y', `output.${fmt.ext}`])
      const data = await ffmpeg.readFile(`output.${fmt.ext}`)
      const blob = new Blob([data.buffer], { type: fmt.mime })
      setDownloadUrl(URL.createObjectURL(blob))
      setStatus('done'); setProgress(100)
      setTimeout(() => downloadRef.current?.click(), 200)
    } catch (err) {
      setErrorMsg(err?.message || (isEN ? 'Unknown error.' : 'Error desconocido.'))
      setStatus('error')
    }
  }

  function reset() {
    setFile(null); setStatus('idle'); setProgress(0); setDownloadUrl(null); setErrorMsg('')
    if (ffmpegRef.current) { try { ffmpegRef.current.terminate() } catch (_) {} ffmpegRef.current = null }
  }

  const baseName = file ? file.name.replace(/\.[^.]+$/, '') : 'audio'

  return (
    <>
      <Helmet>
        <title>{isEN ? 'Extract Audio from Video Online Free | 2minedit' : 'Extraer audio de vídeo online gratis | 2minedit'}</title>
        <meta name="description" content={isEN ? 'Extract audio from any video and download it as MP3 for free. No signup, no install.' : 'Extrae el audio de cualquier vídeo y descárgalo como MP3 gratis. Sin registrarte.'} />
        <link rel="canonical" href={isEN ? 'https://www.2minedit.com/en/extract-audio' : 'https://www.2minedit.com/extract-audio'} />
        <link rel="alternate" hrefLang="es" href="https://www.2minedit.com/extract-audio" />
        <link rel="alternate" hrefLang="en" href="https://www.2minedit.com/en/extract-audio" />
        <link rel="alternate" hrefLang="x-default" href="https://www.2minedit.com/extract-audio" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": isEN ? "Extract Audio from Video Online Free | 2minedit" : "Extraer audio de vídeo online gratis | 2minedit",
          "url": isEN ? "https://www.2minedit.com/en/extract-audio" : "https://www.2minedit.com/extract-audio",
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": isEN
            ? "Extract audio from any video and download it as MP3 for free. No signup, no install."
            : "Extrae el audio de cualquier vídeo y descárgalo como MP3 gratis. Sin registrarte."
        })}</script>
      </Helmet>

      <ToolLayout isEN={isEN}>
        <ToolHeader
          h1={isEN ? 'Extract audio from video' : 'Extraer audio de vídeo'}
          sub={isEN ? 'Get the audio from any video file. No signup, processed in your browser.'
                    : 'Saca el audio de cualquier vídeo. Sin registro, procesado en tu navegador.'}
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
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>{isEN ? 'Output format' : 'Formato de salida'}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {FORMATS.map(f => (
                  <button key={f.key} onClick={() => setFormat(f.key)} style={{
                    flex: 1, padding: '10px 4px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: '1px solid', borderColor: format === f.key ? '#e87040' : '#2a2a2a',
                    backgroundColor: format === f.key ? '#1f1008' : '#141414',
                    color: format === f.key ? '#e87040' : '#666', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {f.key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <PrimaryBtn onClick={handleExtract}>{isEN ? 'Extract audio' : 'Extraer audio'}</PrimaryBtn>
          </>
        )}

        <ProgressBar status={status} progress={progress} label={isEN ? 'Extracting...' : 'Extrayendo...'} />

        {status === 'done' && (
          <ResultCard>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              {isEN ? 'Your download should have started automatically.' : 'La descarga debería haber comenzado automáticamente.'}
            </p>
            <a ref={downloadRef} href={downloadUrl} download={`${baseName}.${format}`} style={{ ...btnStyle, display: 'flex', width: '100%', justifyContent: 'center', marginBottom: 12 }}>
              ⬇ {isEN ? `Download ${format.toUpperCase()}` : `Descargar ${format.toUpperCase()}`}
            </a>
            <ResetBtn onClick={reset} label={isEN ? 'Extract from another video' : 'Extraer de otro vídeo'} />
          </ResultCard>
        )}

        <ErrorCard status={status} errorMsg={errorMsg} onReset={reset} isEN={isEN} />
        <ToolSeoSection toolKey="extractAudio" />
        <RelatedTools currentKey="extractAudio" isEN={isEN} />
      </ToolLayout>

      <FeedbackButton />
    </>
  )
}
