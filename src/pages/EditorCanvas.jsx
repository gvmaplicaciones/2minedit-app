import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditor } from '../EditorContext'
import { useCanvas } from '../hooks/useCanvas'
import AdSlot from '../components/AdSlot'
import { ExportModal } from '../components/ExportModal'
import { TutorialModal } from '../components/TutorialModal'
import FeedbackButton from '../components/FeedbackButton'
import { readVideoMeta, generateThumbnail } from '../videoMeta'

export default function Editor() {
  const navigate = useNavigate()
  const { ratio } = useEditor()

  if (!ratio) {
    navigate('/video-editor', { replace: true })
    return null
  }

  return <EditorShell ratio={ratio} navigate={navigate} />
}

// ── constants ─────────────────────────────────────────────────────────────────

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/wave']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const PX_PER_SEC  = 60    // base pixels per second at zoom 1×
const MIN_CLIP_PX = 64    // minimum clip width (touch-friendly)
const CLIP_GAP_PX = 6     // gap between clips in px (gap-1.5)
const ZOOM_MIN    = 0.05
const ZOOM_MAX    = 12
const OVERLAY_DEFAULT_DURATION = 5  // seconds for image overlays
const SNAP_PX = 8                   // pixel threshold for timeline magnetic snap
const FONT_FAMILIES = {
  sans:   'Arial, Helvetica, sans-serif',
  serif:  'Georgia, Times New Roman, serif',
  mono:   'Courier New, monospace',
  impact: 'Impact, Arial Narrow, sans-serif',
}
const TEXT_PRESET_COLORS = ['#ffffff', '#000000', '#ffcc00', '#ff4444', '#44aaff', '#44ff88', '#ff44cc', '#ff8800']

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function clampZoom(z) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
}

function getPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

// Effective timeline duration: source duration adjusted by playback speed
function effectiveDuration(clip) {
  return (clip.duration || 0) / (clip.speed || 1)
}

// Total rendered width of a clip on the timeline
function clipWidth(clip, zoom) {
  return Math.max(MIN_CLIP_PX, effectiveDuration(clip) * PX_PER_SEC * zoom)
}

// Read duration from an audio file
function readAudioMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.src = url
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ duration: audio.duration }) }
    audio.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: 0 }) }
  })
}

// Width of an audio segment tile on the timeline
function audioSegWidth(seg, zoom) {
  return Math.max(MIN_CLIP_PX, (seg.duration || 0) * PX_PER_SEC * zoom)
}

// Width of an overlay tile on the timeline
function overlayTileWidth(ov, zoom) {
  return Math.max(MIN_CLIP_PX, (ov.duration || 0) * PX_PER_SEC * zoom)
}

// Find which segment in a track's segments array is at a given timeline time
function getAudioSegAt(segments, time) {
  let remaining = time
  for (const seg of segments) {
    if (remaining <= seg.duration + 0.001) return { seg, localTime: Math.min(remaining, seg.duration) }
    remaining -= seg.duration
  }
  return null
}

// Find track and segment by segment id
function findAudioSeg(audioTracks, segId) {
  for (const track of audioTracks) {
    const seg = track.segments.find((s) => s.id === segId)
    if (seg) return { track, seg }
  }
  return null
}

// ── timeline math ─────────────────────────────────────────────────────────────

// Build a position map for all clips: startX, width, startTime, duration (all in effective/timeline time)
function buildClipPositions(clips, zoom) {
  let x = 0
  let time = 0
  return clips.map((clip) => {
    const cw = clipWidth(clip, zoom)
    const ed = effectiveDuration(clip)
    const pos = { startX: x, width: cw, startTime: time, duration: ed }
    x += cw + CLIP_GAP_PX
    time += ed
    return pos
  })
}

// Convert a timeline time (seconds) to a pixel X position in the inner clips div
function timeToPixel(time, positions) {
  for (const pos of positions) {
    if (time <= pos.startTime + pos.duration + 0.001) {
      const localTime = Math.max(0, time - pos.startTime)
      return pos.startX + (pos.duration > 0 ? (localTime / pos.duration) * pos.width : 0)
    }
  }
  if (positions.length === 0) return 0
  const last = positions[positions.length - 1]
  return last.startX + last.width
}

// Convert a pixel X position in the inner clips div to a timeline time (seconds)
function pixelToTime(x, positions) {
  for (const pos of positions) {
    if (x < pos.startX) return pos.startTime           // gap before this clip
    if (x <= pos.startX + pos.width) {
      const localX = x - pos.startX
      return pos.startTime + (pos.width > 0 ? (localX / pos.width) * pos.duration : 0)
    }
  }
  if (positions.length === 0) return 0
  const last = positions[positions.length - 1]
  return last.startTime + last.duration
}

// Find which clip is active at a given timeline time and its local offset (in effective time)
function getActiveClipInfo(time, clips) {
  let remaining = time
  for (const clip of clips) {
    const ed = effectiveDuration(clip)
    if (remaining <= ed + 0.001) {
      return { clip, localTime: Math.min(remaining, ed) }
    }
    remaining -= ed
  }
  if (clips.length > 0) {
    const last = clips[clips.length - 1]
    return { clip: last, localTime: effectiveDuration(last) }
  }
  return null
}

// ── main shell ────────────────────────────────────────────────────────────────

function EditorShell({ ratio, navigate }) {
  const { t } = useTranslation()
  const { canvasStyle } = useCanvas(ratio)
  const { clips, setClips, addClip } = useEditor()

  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [canvasDims, setCanvasDims] = useState({ w: 300, h: 400 })
  const canvasContainerRef = useRef(null)
  const [errorMsg, setErrorMsg]             = useState('')
  const [zoom, setZoom]                     = useState(1)
  const [playheadTime, setPlayheadTime]     = useState(0)
  const [selectedClipId, setSelectedClipId] = useState(null)
  const [isPlaying, setIsPlaying]           = useState(false)
  const [showBackConfirm,  setShowBackConfirm]  = useState(false)
  const [isExportOpen,     setIsExportOpen]     = useState(false)
  const [isTutorialOpen,   setIsTutorialOpen]   = useState(false)

  const [audioTracks, setAudioTracks]               = useState([])
  const [selectedAudioSegId, setSelectedAudioSegId] = useState(null)

  const [overlays, setOverlays]               = useState([])      // Array<overlay>
  const [selectedOverlayId, setSelectedOverlayId] = useState(null)

  const [texts, setTexts]                   = useState([])        // Array<text layer>
  const [selectedTextId, setSelectedTextId] = useState(null)
  const [editingTextId, setEditingTextId]   = useState(null)

  const fileInputRef           = useRef(null)
  const audioFileInputRef      = useRef(null)
  const overlayFileInputRef    = useRef(null)
  const clipsRowRef            = useRef(null)   // scrollable container
  const timelineInnerRef       = useRef(null)   // inner min-w-max div
  const pinchRef               = useRef(null)
  const previewVideoRef        = useRef(null)
  const previewSrcRef          = useRef(null)   // objectUrl currently loaded in preview
  const playheadDragRef        = useRef(null)   // drag state for playhead handle
  const scrollRafRef           = useRef(null)   // RAF id for edge auto-scroll
  const scrollSpeedRef         = useRef(0)      // px/frame: negative=left, positive=right
  const pointerClientXRef      = useRef(0)      // last pointer clientX during drag
  const isPlayingRef           = useRef(false)  // mirror of isPlaying for RAF callbacks
  const playRafRef             = useRef(null)   // RAF id for playback loop
  const currentPlayClipRef     = useRef(null)   // id of clip currently being played
  const clipsRef               = useRef(clips)  // up-to-date clips for RAF callbacks
  const audioTracksRef         = useRef([])     // up-to-date for RAF/audio operations
  const audioElemsRef          = useRef({})     // { trackId: HTMLAudioElement }
  const overlaysRef            = useRef([])     // up-to-date for RAF operations
  const overlayVideoElemsRef   = useRef({})     // { overlayId: HTMLVideoElement }
  const textsRef               = useRef([])     // up-to-date for RAF operations
  const undoStackRef           = useRef([])     // snapshots to restore on undo
  const redoStackRef           = useRef([])     // snapshots to restore on redo
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const videoDuration = clips.reduce((acc, c) => acc + effectiveDuration(c), 0)
  const audioDuration = audioTracks.reduce((acc, track) => {
    const trackEnd = (track.startOffset || 0) + track.segments.reduce((s, seg) => s + seg.duration, 0)
    return Math.max(acc, trackEnd)
  }, 0)
  const overlayDuration = overlays.reduce((acc, ov) => Math.max(acc, ov.startTime + ov.duration), 0)
  const textsDuration   = texts.reduce((acc, t) => Math.max(acc, t.startTime + t.duration), 0)
  const totalDuration = Math.max(videoDuration, audioDuration, overlayDuration, textsDuration)
  const clampedPlayhead = Math.max(0, Math.min(totalDuration, playheadTime))

  // Clip positions: computed once per render from clips + zoom
  const clipPositions = useMemo(
    () => buildClipPositions(clips, zoom),
    [clips, zoom],
  )

  // ── dnd-kit sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  // Keep refs in sync so RAF callbacks always see fresh data
  useEffect(() => { clipsRef.current = clips }, [clips])
  useEffect(() => { audioTracksRef.current = audioTracks }, [audioTracks])
  useEffect(() => { overlaysRef.current = overlays }, [overlays])
  useEffect(() => { textsRef.current = texts }, [texts])

  // Preload audio src for every track so seek+play works instantly during playback
  useEffect(() => {
    audioTracks.forEach((track) => {
      const audio = audioElemsRef.current[track.trackId]
      if (!audio) return
      const firstSeg = track.segments[0]
      if (!firstSeg) return
      if (audio.getAttribute('data-src') !== firstSeg.objectUrl) {
        audio.setAttribute('data-src', firstSeg.objectUrl)
        audio.src = firstSeg.objectUrl
        audio.load()
      }
    })
  }, [audioTracks])

  // Seek video overlays to correct position when scrubbing (not during playback)
  useEffect(() => {
    if (isPlayingRef.current) return
    overlays.forEach((ov) => {
      if (ov.type !== 'video') return
      const video = overlayVideoElemsRef.current[ov.id]
      if (!video) return
      const localT = clampedPlayhead - ov.startTime
      if (localT >= 0 && localT < ov.duration) {
        const srcTime = (ov.trimStart || 0) + localT
        if (video.getAttribute('data-src') !== ov.objectUrl) {
          video.setAttribute('data-src', ov.objectUrl)
          video.src = ov.objectUrl
          video.load()
          video.addEventListener('loadeddata', () => { video.currentTime = srcTime }, { once: true })
        } else {
          video.currentTime = srcTime
        }
      }
    })
  }, [clampedPlayhead, overlays])

  // Stop playback when component unmounts
  useEffect(() => () => stopPlayback(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Track canvas container dimensions for overlay pixel sizing
  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setCanvasDims({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── beforeunload ──
  useEffect(() => {
    if (clips.length === 0) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [clips.length])

  // ── pinch zoom (mobile) + Ctrl+wheel zoom (desktop) ──
  useEffect(() => {
    const container = clipsRowRef.current
    if (!container) return

    // Registered on window in capture phase so it fires before React's event delegation
    // and before dnd-kit's TouchSensor activator
    function onWindowTouchStart(e) {
      if (e.touches.length < 2) return

      // Only act when the gesture is inside our timeline container
      let inContainer = false
      for (let i = 0; i < e.touches.length; i++) {
        if (container.contains(e.touches[i].target)) { inContainer = true; break }
      }
      if (!inContainer) return

      pinchRef.current = getPinchDist(e.touches)

      // Cancel dnd-kit's pending 250ms activation timer (or any active drag) by
      // dispatching touchcancel on the first touch's target. dnd-kit's TouchSensor
      // registers a touchcancel cleanup listener on that element.
      try {
        e.touches[0].target.dispatchEvent(
          new TouchEvent('touchcancel', { bubbles: true, cancelable: false })
        )
      } catch (_) {}
    }

    function onWindowTouchEnd(e) {
      if (e.touches.length < 2) pinchRef.current = null
    }

    // Container-level capture for touchmove: prevents dnd-kit from moving clips
    // while a pinch is in progress and updates the zoom level
    function onTouchMove(e) {
      if (e.touches.length >= 2 && pinchRef.current != null) {
        e.preventDefault()
        e.stopPropagation()
        const dist  = getPinchDist(e.touches)
        const ratio = dist / pinchRef.current
        pinchRef.current = dist
        setZoom((z) => clampZoom(z * ratio))
      }
    }

    function onWheel(e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.12 : 0.9
        setZoom((z) => clampZoom(z * factor))
      }
    }

    window.addEventListener('touchstart',    onWindowTouchStart, { capture: true, passive: true  })
    window.addEventListener('touchend',      onWindowTouchEnd,   { capture: true, passive: true  })
    container.addEventListener('touchmove',  onTouchMove,        { capture: true, passive: false })
    container.addEventListener('wheel',      onWheel,            { passive: false })

    return () => {
      window.removeEventListener('touchstart',    onWindowTouchStart, { capture: true })
      window.removeEventListener('touchend',      onWindowTouchEnd,   { capture: true })
      container.removeEventListener('touchmove',  onTouchMove,        { capture: true })
      container.removeEventListener('wheel',      onWheel)
    }
  }, [])

  // ── update canvas preview when playhead moves (skip during active playback) ──
  useEffect(() => {
    if (isPlayingRef.current) return   // RAF handles seeking during playback
    const video = previewVideoRef.current
    if (!video || clips.length === 0) return

    const info = getActiveClipInfo(clampedPlayhead, clips)
    if (!info) return
    const { clip, localTime } = info

    // seekTime = offset within the source file
    // localTime is in effective (timeline) time → multiply by speed to get source time
    const seekTime = (clip.trimStart || 0) + localTime * (clip.speed || 1)

    if (previewSrcRef.current !== clip.objectUrl) {
      // Source file changed — reload then seek
      previewSrcRef.current = clip.objectUrl
      video.src = clip.objectUrl
      video.load()
      video.addEventListener('loadeddata', () => {
        video.currentTime = seekTime
      }, { once: true })
    } else {
      // Same source file (includes split fragments) — just seek
      video.currentTime = seekTime
    }
  }, [clampedPlayhead, clips])

  // ── sync video volume/mute to active clip (runs even during playback) ──
  useEffect(() => {
    const video = previewVideoRef.current
    if (!video || clips.length === 0) return
    const info = getActiveClipInfo(clampedPlayhead, clips)
    if (!info) return
    const { clip } = info
    video.volume = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume ?? 1))
  }, [clampedPlayhead, clips])

  // ── timeline snap ──
  function buildSnapPoints(excludeOverlayId = null, excludeTextId = null, excludeAudioTrackId = null) {
    const pts = new Set()
    // clip edit points
    let t = 0
    for (const clip of clips) {
      pts.add(t)
      t += effectiveDuration(clip)
      pts.add(t)
    }
    // audio track edit points
    for (const track of audioTracks) {
      if (track.trackId === excludeAudioTrackId) continue
      let st = track.startOffset || 0
      pts.add(st)
      for (const seg of track.segments) { st += seg.duration; pts.add(st) }
    }
    // overlay edit points
    for (const ov of overlays) {
      if (ov.id === excludeOverlayId) continue
      pts.add(ov.startTime)
      pts.add(ov.startTime + ov.duration)
    }
    // text edit points
    for (const tx of texts) {
      if (tx.id === excludeTextId) continue
      pts.add(tx.startTime)
      pts.add(tx.startTime + tx.duration)
    }
    return Array.from(pts)
  }

  function snapTime(time, pts) {
    const threshold = SNAP_PX / (PX_PER_SEC * zoom)
    let best = time, bestDist = threshold
    for (const p of pts) {
      const d = Math.abs(time - p)
      if (d < bestDist) { bestDist = d; best = p }
    }
    return best
  }

  // ── history (undo / redo) — two-stack approach ──
  function currentSnapshot() {
    return {
      clips: clipsRef.current,
      audioTracks: audioTracksRef.current,
      overlays: overlaysRef.current,
      texts: textsRef.current,
    }
  }

  function pushHistory() {
    undoStackRef.current.push(currentSnapshot())
    if (undoStackRef.current.length > 50) undoStackRef.current.shift()
    redoStackRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }

  function restoreSnapshot(snap) {
    stopPlayback()
    setClips(snap.clips)
    setAudioTracks(snap.audioTracks)
    setOverlays(snap.overlays ?? [])
    setTexts(snap.texts ?? [])
    setSelectedClipId(null)
    setSelectedAudioSegId(null)
    setSelectedOverlayId(null)
    setSelectedTextId(null)
    setEditingTextId(null)
  }

  function undo() {
    if (undoStackRef.current.length === 0) return
    redoStackRef.current.push(currentSnapshot())
    const snap = undoStackRef.current.pop()
    restoreSnapshot(snap)
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
  }

  function redo() {
    if (redoStackRef.current.length === 0) return
    undoStackRef.current.push(currentSnapshot())
    const snap = redoStackRef.current.pop()
    restoreSnapshot(snap)
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
  }

  function updateAudioTrack(trackId, changes) {
    setAudioTracks((prev) => prev.map((t) => t.trackId === trackId ? { ...t, ...changes } : t))
  }

  function updateOverlay(overlayId, changes) {
    setOverlays((prev) => prev.map((ov) => ov.id === overlayId ? { ...ov, ...changes } : ov))
  }

  function handleDeleteOverlay(overlayId) {
    pushHistory()
    setOverlays((prev) => prev.filter((ov) => ov.id !== overlayId))
    setSelectedOverlayId(null)
  }

  function updateText(textId, changes) {
    setTexts((prev) => prev.map((t) => t.id === textId ? { ...t, ...changes } : t))
  }

  function handleDeleteText(textId) {
    pushHistory()
    setTexts((prev) => prev.filter((t) => t.id !== textId))
    setSelectedTextId(null)
    setEditingTextId(null)
  }

  function handleAddText() {
    const allTracks = [
      ...overlays.map((o) => o.trackIndex ?? 0),
      ...texts.map((t) => t.trackIndex ?? 0),
    ]
    const nextTrackIndex = allTracks.length === 0 ? 0 : Math.max(...allTracks) + 1
    const id = crypto.randomUUID()
    pushHistory()
    const newText = {
      id,
      content: 'Texto',
      startTime: clampedPlayhead,
      duration: 5,
      trackIndex: nextTrackIndex,
      x: 0.5,
      y: 0.8,
      fontSize: 0.08,
      fontFamily: 'sans',
      color: '#ffffff',
      bold: false,
      italic: false,
      opacity: 1,
    }
    setTexts((prev) => [...prev, newText])
    setSelectedTextId(id)
    setEditingTextId(id)
    setSelectedClipId(null)
    setSelectedAudioSegId(null)
    setSelectedOverlayId(null)
  }

  // ── file selection ──
  async function handleFileSelect(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setErrorMsg(t('errors.invalid_format'))
      return
    }
    const MAX_CLIP_MB = 200
    if (file.size > MAX_CLIP_MB * 1024 * 1024) {
      setErrorMsg(t('errors.file_too_large', { mb: Math.round(file.size / 1024 / 1024), max: MAX_CLIP_MB }))
      return
    }
    setErrorMsg('')

    const { duration, thumbnail, videoWidth, videoHeight } = await readVideoMeta(file)
    const objectUrl = URL.createObjectURL(file)

    pushHistory()
    addClip({
      id: crypto.randomUUID(),
      name: file.name,
      file,
      objectUrl,
      duration,
      thumbnail,
      videoWidth,
      videoHeight,
    })
  }

  // ── drag end: reorder ──
  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    pushHistory()
    const oldIndex = clips.findIndex((c) => c.id === active.id)
    const newIndex = clips.findIndex((c) => c.id === over.id)
    setClips(arrayMove(clips, oldIndex, newIndex))
  }

  // ── playback ──

  function stopPlayback() {
    isPlayingRef.current = false
    setIsPlaying(false)
    if (playRafRef.current) { cancelAnimationFrame(playRafRef.current); playRafRef.current = null }
    previewVideoRef.current?.pause()
    for (const audio of Object.values(audioElemsRef.current)) {
      audio.pause()
    }
    for (const video of Object.values(overlayVideoElemsRef.current)) {
      video.pause()
    }
  }

  function playTick() {
    if (!isPlayingRef.current) return
    const video = previewVideoRef.current
    if (!video) { stopPlayback(); return }

    const allClips = clipsRef.current
    const clip = allClips.find((c) => c.id === currentPlayClipRef.current)
    if (!clip) { stopPlayback(); return }

    const trimStart  = clip.trimStart  || 0
    const speed      = clip.speed      || 1
    const sourceTime = video.currentTime

    // Reached the end of this clip's source window → advance to next
    if (sourceTime >= trimStart + clip.duration - 0.04) {
      const idx = allClips.findIndex((c) => c.id === clip.id)
      if (idx === -1 || idx >= allClips.length - 1) { stopPlayback(); return }
      playClip(allClips[idx + 1], 0)
      return
    }

    // Compute timeline position and update playhead
    let clipStart = 0
    for (const c of allClips) {
      if (c.id === clip.id) break
      clipStart += effectiveDuration(c)
    }
    const effectiveLocal = (sourceTime - trimStart) / speed
    const currentTL = clipStart + effectiveLocal
    setPlayheadTime(currentTL)

    // Sync audio tracks every frame: start, stop, and apply fade out in real time
    for (const track of audioTracksRef.current) {
      const audio = audioElemsRef.current[track.trackId]
      if (!audio) continue
      const offset = track.startOffset || 0
      const localT = currentTL - offset
      const totalDur = track.segments.reduce((s, seg) => s + seg.duration, 0)
      if (localT >= 0 && localT < totalDur) {
        const result = getAudioSegAt(track.segments, localT)
        if (!result) continue
        const { seg, localTime } = result

        // Compute volume with optional fade out curve
        const baseVol = Math.max(0, Math.min(1, seg.volume ?? 1))
        let vol = baseVol
        if (seg.fadeOut) {
          const fadeOutDur = Math.min(2, seg.duration * 0.3)
          const timeUntilEnd = seg.duration - localTime
          if (timeUntilEnd < fadeOutDur && fadeOutDur > 0) {
            vol = baseVol * (timeUntilEnd / fadeOutDur)
          }
        }

        if (audio.paused) {
          audio.currentTime = (seg.trimStart || 0) + localTime
          audio.volume = vol
          audio.play().catch(() => {})
        } else {
          // Update volume every frame so fade out is applied continuously
          audio.volume = Math.max(0, vol)
        }
      } else if (!audio.paused) {
        audio.pause()
      }
    }

    // Sync video overlays every frame
    for (const ov of overlaysRef.current) {
      if (ov.type !== 'video') continue
      const ovVideo = overlayVideoElemsRef.current[ov.id]
      if (!ovVideo) continue
      const localT = currentTL - ov.startTime
      if (localT >= 0 && localT < ov.duration) {
        const ovVol = ov.muted ? 0 : Math.max(0, Math.min(1, ov.volume ?? 1))
        if (ovVideo.paused) {
          ovVideo.currentTime = (ov.trimStart || 0) + localT
          ovVideo.playbackRate = ov.speed || 1
          ovVideo.volume = ovVol
          ovVideo.play().catch(() => {})
        } else {
          ovVideo.volume = ovVol
        }
      } else if (!ovVideo.paused) {
        ovVideo.pause()
      }
    }

    playRafRef.current = requestAnimationFrame(playTick)
  }

  function playClip(clip, sourceLocalTime) {
    const video = previewVideoRef.current
    if (!video) return
    currentPlayClipRef.current = clip.id

    const doPlay = () => {
      video.currentTime  = (clip.trimStart || 0) + sourceLocalTime
      video.playbackRate = clip.speed || 1
      video.volume       = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume ?? 1))
      video.play().catch(() => {})
      playRafRef.current = requestAnimationFrame(playTick)
    }

    if (previewSrcRef.current !== clip.objectUrl) {
      previewSrcRef.current = clip.objectUrl
      video.src = clip.objectUrl
      video.load()
      video.addEventListener('loadeddata', doPlay, { once: true })
    } else {
      doPlay()
    }
  }

  function startAudioTracks(timelineTime) {
    for (const track of audioTracksRef.current) {
      const audio = audioElemsRef.current[track.trackId]
      if (!audio) continue
      const offset = track.startOffset || 0
      if (timelineTime < offset) { audio.pause(); continue }
      const localT = timelineTime - offset
      const totalTrackDur = track.segments.reduce((s, seg) => s + seg.duration, 0)
      if (localT >= totalTrackDur) { audio.pause(); continue }
      const result = getAudioSegAt(track.segments, localT)
      if (!result) { audio.pause(); continue }
      const { seg, localTime } = result
      audio.currentTime = (seg.trimStart || 0) + localTime
      audio.volume = Math.max(0, Math.min(1, seg.volume ?? 1))
      audio.play().catch(() => {})
    }
  }

  function startOverlayVideos(timelineTime) {
    for (const ov of overlaysRef.current) {
      if (ov.type !== 'video') continue
      const ovVideo = overlayVideoElemsRef.current[ov.id]
      if (!ovVideo) continue
      const localT = timelineTime - ov.startTime
      if (localT >= 0 && localT < ov.duration) {
        ovVideo.currentTime = (ov.trimStart || 0) + localT
        ovVideo.playbackRate = ov.speed || 1
        ovVideo.volume = ov.muted ? 0 : Math.max(0, Math.min(1, ov.volume ?? 1))
        ovVideo.play().catch(() => {})
      } else {
        ovVideo.pause()
      }
    }
  }

  function startPlayback() {
    const allClips = clipsRef.current
    if (allClips.length === 0) return
    const info = getActiveClipInfo(clampedPlayhead, allClips)
    if (!info) return
    isPlayingRef.current = true
    setIsPlaying(true)
    // Convert effective local time → source local time
    const sourceLocal = info.localTime * (info.clip.speed || 1)
    playClip(info.clip, sourceLocal)
    startAudioTracks(clampedPlayhead)
    startOverlayVideos(clampedPlayhead)
  }

  function togglePlayback() {
    isPlayingRef.current ? stopPlayback() : startPlayback()
  }

  // ── audio file selection ──
  async function handleAudioFileSelect(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const mime = file.type.toLowerCase()
    const ext  = file.name.split('.').pop().toLowerCase()
    const validExt = ['mp3', 'aac', 'wav'].includes(ext)
    if (!ALLOWED_AUDIO_TYPES.includes(mime) && !validExt) {
      setErrorMsg(t('errors.invalid_audio_format'))
      return
    }
    setErrorMsg('')
    const { duration } = await readAudioMeta(file)
    const objectUrl = URL.createObjectURL(file)
    pushHistory()
    setAudioTracks((prev) => [
      ...prev,
      {
        trackId: crypto.randomUUID(),
        startOffset: 0,
        segments: [{ id: crypto.randomUUID(), name: file.name, file, objectUrl, duration, trimStart: 0, volume: 1, fadeOut: false }],
      },
    ])
  }

  // ── overlay file selection ──
  async function handleOverlayFileSelect(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
    if (!isImage && !isVideo) {
      setErrorMsg(t('errors.invalid_format'))
      return
    }
    setErrorMsg('')
    const objectUrl = URL.createObjectURL(file)
    let duration = OVERLAY_DEFAULT_DURATION
    if (isVideo) {
      const meta = await readVideoMeta(file)
      duration = meta.duration || OVERLAY_DEFAULT_DURATION
    }
    pushHistory()
    setOverlays((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: file.name,
        objectUrl,
        type: isImage ? 'image' : 'video',
        duration,
        startTime: clampedPlayhead,
        trimStart: 0,
        trackIndex: (() => { const all = [...overlays.map((o) => o.trackIndex ?? 0), ...texts.map((t) => t.trackIndex ?? 0)]; return all.length === 0 ? 0 : Math.max(...all) + 1 })(),
        x: 0.5,
        y: 0.5,
        widthPct: 0.35,
        opacity: 1,
        volume: 1,
        muted: false,
        speed: 1,
      },
    ])
  }

  // ── split an audio segment at playhead ──
  function handleSplitAudioTrack(trackId) {
    const trackObj = audioTracks.find((t) => t.trackId === trackId)
    if (!trackObj) return
    const localT = clampedPlayhead - (trackObj.startOffset || 0)
    if (localT < 0) return
    const result = getAudioSegAt(trackObj.segments, localT)
    if (!result) return
    const { seg, localTime } = result
    if (localTime < 0.1 || localTime > seg.duration - 0.1) return

    const segA = { ...seg, id: crypto.randomUUID(), duration: localTime }
    const segB = { ...seg, id: crypto.randomUUID(), duration: seg.duration - localTime, trimStart: seg.trimStart + localTime }

    setAudioTracks((prev) =>
      prev.map((t) =>
        t.trackId === trackId
          ? { ...t, segments: t.segments.flatMap((s) => (s.id === seg.id ? [segA, segB] : [s])) }
          : t,
      ),
    )
    setSelectedAudioSegId(null)
  }

  // ── update an audio segment ──
  function updateAudioSeg(trackId, segId, changes) {
    setAudioTracks((prev) =>
      prev.map((t) =>
        t.trackId === trackId
          ? { ...t, segments: t.segments.map((s) => (s.id === segId ? { ...s, ...changes } : s)) }
          : t,
      ),
    )
  }

  // ── delete an audio segment (remove entire track row if it was the last segment) ──
  function handleDeleteAudioSeg(trackId, segId) {
    pushHistory()
    setAudioTracks((prev) =>
      prev
        .map((t) => (t.trackId === trackId ? { ...t, segments: t.segments.filter((s) => s.id !== segId) } : t))
        .filter((t) => t.segments.length > 0),
    )
    setSelectedAudioSegId(null)
  }

  // ── split clip at playhead ──
  async function handleSplit() {
    // If a text layer is selected, split it at the playhead
    if (selectedTextId) {
      const txt = texts.find((t) => t.id === selectedTextId)
      if (txt) {
        const localT = clampedPlayhead - txt.startTime
        if (localT > 0.1 && localT < txt.duration - 0.1) {
          pushHistory()
          const txtA = { ...txt, id: crypto.randomUUID(), duration: localT }
          const txtB = { ...txt, id: crypto.randomUUID(), startTime: txt.startTime + localT, duration: txt.duration - localT }
          setTexts((prev) => prev.flatMap((t) => t.id === txt.id ? [txtA, txtB] : [t]))
          setSelectedTextId(null)
        }
      }
      return
    }

    // If an overlay is selected, split it at the playhead
    if (selectedOverlayId) {
      const ov = overlays.find((o) => o.id === selectedOverlayId)
      if (ov) {
        const localT = clampedPlayhead - ov.startTime
        if (localT > 0.1 && localT < ov.duration - 0.1) {
          pushHistory()
          const ovA = { ...ov, id: crypto.randomUUID(), duration: localT }
          const ovB = {
            ...ov,
            id: crypto.randomUUID(),
            startTime: ov.startTime + localT,
            duration: ov.duration - localT,
            trimStart: (ov.trimStart || 0) + localT,
          }
          setOverlays((prev) => prev.flatMap((o) => o.id === ov.id ? [ovA, ovB] : [o]))
          setSelectedOverlayId(null)
        }
      }
      return
    }

    // If an audio segment is selected, split it
    if (selectedAudioSegId) {
      const found = findAudioSeg(audioTracks, selectedAudioSegId)
      if (found) { pushHistory(); handleSplitAudioTrack(found.track.trackId) }
      return
    }
    if (clips.length === 0 || totalDuration === 0) return
    const info = getActiveClipInfo(clampedPlayhead, clips)
    if (!info) return
    const { clip, localTime } = info  // localTime is in effective (timeline) time

    // Convert effective time to source time for trim math
    const speed         = clip.speed || 1
    const sourceLocal   = localTime * speed          // position inside source clip
    const trimStart     = clip.trimStart || 0

    // Ignore cuts too close to the edges of the source clip (< 0.1 s)
    if (sourceLocal < 0.1 || sourceLocal > clip.duration - 0.1) return

    pushHistory()
    const thumb2 = await generateThumbnail(
      clip.objectUrl,
      trimStart + sourceLocal,
      clip.videoWidth,
      clip.videoHeight,
    )

    const clipA = {
      ...clip,
      id:        crypto.randomUUID(),
      duration:  sourceLocal,                    // source duration of first half
      trimStart,
    }
    const clipB = {
      ...clip,
      id:        crypto.randomUUID(),
      duration:  clip.duration - sourceLocal,    // source duration of second half
      trimStart: trimStart + sourceLocal,
      thumbnail: thumb2 || clip.thumbnail,
    }

    stopPlayback()
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === clip.id)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), clipA, clipB, ...prev.slice(idx + 1)]
    })
    setSelectedClipId(null)
  }

  // ── delete a clip and adjust playhead ──
  function handleDeleteClip(clipId) {
    const clipToDelete = clips.find((c) => c.id === clipId)
    if (!clipToDelete) return
    pushHistory()

    // Find where this clip starts in the timeline (effective time)
    let clipStart = 0
    for (const c of clips) {
      if (c.id === clipId) break
      clipStart += effectiveDuration(c)
    }
    const clipEd  = effectiveDuration(clipToDelete)
    const clipEnd = clipStart + clipEd

    setPlayheadTime((prev) => {
      if (prev >= clipEnd)  return prev - clipEd
      if (prev > clipStart) return clipStart
      return prev
    })

    stopPlayback()
    setClips((prev) => prev.filter((c) => c.id !== clipId))
    setSelectedClipId(null)
  }

  // ── update a clip's properties ──
  function updateClip(clipId, changes) {
    setClips((prev) => prev.map((c) => c.id === clipId ? { ...c, ...changes } : c))
  }

  // ── click on timeline to set playhead ──
  function handleTimelineClick(e) {
    if (clips.length === 0 || totalDuration === 0) return
    // Ignore clicks that originated from the + button or clip tiles (they bubble up)
    if (e.target.closest('[data-no-seek]')) return
    const scrollable = clipsRowRef.current
    if (!scrollable) return
    const rect = scrollable.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollable.scrollLeft
    const newTime = pixelToTime(Math.max(0, x), clipPositions)
    setPlayheadTime(Math.max(0, Math.min(totalDuration, newTime)))
  }

  // ── auto-scroll during playhead drag ──
  const EDGE_ZONE       = 56   // px from edge of scrollable to trigger auto-scroll
  const MAX_SCROLL_SPEED = 14  // px per animation frame at full speed

  function startAutoScroll() {
    if (scrollRafRef.current) return
    function tick() {
      const el    = clipsRowRef.current
      const speed = scrollSpeedRef.current
      const drag  = playheadDragRef.current
      if (!el || speed === 0 || !drag) {
        scrollRafRef.current = null
        return
      }
      el.scrollLeft += speed
      // Recompute playhead time based on current pointer + new scroll offset
      const rect    = el.getBoundingClientRect()
      const x       = pointerClientXRef.current - rect.left + el.scrollLeft
      setPlayheadTime(Math.max(0, Math.min(drag.capturedTotal,
        pixelToTime(Math.max(0, x), drag.capturedPositions))))
      scrollRafRef.current = requestAnimationFrame(tick)
    }
    scrollRafRef.current = requestAnimationFrame(tick)
  }

  function stopAutoScroll() {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = null
    }
    scrollSpeedRef.current = 0
  }

  // ── playhead handle drag ──
  function handlePlayheadPointerDown(e) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)

    playheadDragRef.current = {
      capturedPositions: clipPositions,
      capturedTotal:     totalDuration,
    }
    pointerClientXRef.current = e.clientX
  }

  function handlePlayheadPointerMove(e) {
    const drag = playheadDragRef.current
    if (!drag || !e.currentTarget.hasPointerCapture(e.pointerId)) return

    pointerClientXRef.current = e.clientX

    // Update playhead position based on pointer location in the scrollable content
    const scrollable = clipsRowRef.current
    if (!scrollable) return
    const rect = scrollable.getBoundingClientRect()
    const x    = e.clientX - rect.left + scrollable.scrollLeft
    setPlayheadTime(Math.max(0, Math.min(drag.capturedTotal,
      pixelToTime(Math.max(0, x), drag.capturedPositions))))

    // Auto-scroll: ramp speed within EDGE_ZONE px of left/right edge
    const distRight = rect.right - e.clientX
    const distLeft  = e.clientX - rect.left
    if (distRight < EDGE_ZONE && distRight >= 0) {
      scrollSpeedRef.current = ((EDGE_ZONE - distRight) / EDGE_ZONE) * MAX_SCROLL_SPEED
      startAutoScroll()
    } else if (distLeft < EDGE_ZONE && distLeft >= 0) {
      scrollSpeedRef.current = -((EDGE_ZONE - distLeft) / EDGE_ZONE) * MAX_SCROLL_SPEED
      startAutoScroll()
    } else {
      stopAutoScroll()
    }
  }

  function handlePlayheadPointerUp() {
    playheadDragRef.current = null
    stopAutoScroll()
  }

  const playheadX   = timeToPixel(clampedPlayhead, clipPositions)
  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null
  const previewHeightClass = previewExpanded ? 'h-[65vh]' : 'h-[clamp(180px,35vh,300px)]'

  // Compute minWidth for inner timeline div (accounts for audio tracks and overlays)
  const timelineMinWidth = (() => {
    const audioPxEnd = audioTracks.reduce((max, track) => {
      const offsetPx = Math.round((track.startOffset || 0) * PX_PER_SEC * zoom)
      const segsW = track.segments.reduce((w, seg) => w + audioSegWidth(seg, zoom) + CLIP_GAP_PX, 0)
      return Math.max(max, offsetPx + 16 + segsW)
    }, 0)
    const overlayPxEnd = overlays.reduce((max, ov) => {
      const left = Math.round(ov.startTime * PX_PER_SEC * zoom)
      const width = overlayTileWidth(ov, zoom)
      return Math.max(max, left + width + 16)
    }, 0)
    const textPxEnd = texts.reduce((max, t) => {
      const left = Math.round(t.startTime * PX_PER_SEC * zoom)
      const width = Math.max(MIN_CLIP_PX, t.duration * PX_PER_SEC * zoom)
      return Math.max(max, left + width + 16)
    }, 0)
    const pxEnd = Math.max(audioPxEnd, overlayPxEnd, textPxEnd)
    return pxEnd > 0 ? { minWidth: pxEnd + 16 } : undefined
  })()

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] overflow-hidden select-none">

      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-b border-[#1f1f1f] shrink-0 h-[52px]">
        <button
          onClick={() => setShowBackConfirm(true)}
          className="text-xs text-[#555] hover:text-[#aaa] transition-colors"
        >
          ← {t('nav.back')}
        </button>

        <div className="flex items-center gap-1.5">
          {/* Undo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors
              ${canUndo ? 'text-[#888] hover:text-white' : 'text-[#333] cursor-not-allowed'}`}
            aria-label={t('editor.undo')}
            title={t('editor.undo_title')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 5h5.5a4 4 0 010 8H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 5l2.5-2.5M2 5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Redo */}
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors
              ${canRedo ? 'text-[#888] hover:text-white' : 'text-[#333] cursor-not-allowed'}`}
            aria-label={t('editor.redo')}
            title={t('editor.redo_title')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 5H6.5a4 4 0 000 8H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 5L9.5 2.5M12 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="bg-[#1f1008] border border-[#e87040]/50 rounded px-2.5 py-1 ml-1">
            <span className="text-[10px] font-bold text-[#e87040]">{ratio}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] text-[#555] hover:text-[#aaa] hover:border-[#3a3a3a] transition-colors"
          >
            {t('editor.tutorial_btn')}
          </button>
          <button
            onClick={() => { if (clips.length > 0) setIsExportOpen(true) }}
            disabled={clips.length === 0}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-opacity
              ${clips.length > 0 ? 'bg-white text-black hover:opacity-90' : 'bg-[#2a2a2a] text-[#555] cursor-not-allowed'}`}
          >
            {t('editor.export_btn')}
          </button>
        </div>
      </nav>

      {/* ── CANVAS / PREVIEW ── */}
      <div className={`${previewHeightClass} w-full bg-black flex items-center justify-center shrink-0 relative transition-[height] duration-300`}>
        <div
          ref={canvasContainerRef}
          onClick={(e) => { setEditingTextId(null); if (clips.length > 0) togglePlayback() }}
          className={`bg-[#0a0a0a] border border-[#1f1f1f] relative flex items-center justify-center overflow-hidden
            ${clips.length > 0 ? 'cursor-pointer' : ''}`}
          style={canvasStyle}
        >
          {/* Video preview — always mounted, visible only when clips exist */}
          <video
            ref={previewVideoRef}
            className={`w-full h-full object-contain absolute inset-0 ${clips.length > 0 ? 'block' : 'hidden'}`}
            playsInline
            preload="auto"
            onVolumeChange={() => {}} // prevent browser from resetting volume
          />

          {/* Overlay elements — rendered on top of the video */}
          {overlays.map((ov) => {
            const localT = clampedPlayhead - ov.startTime
            if (localT < 0 || localT >= ov.duration) return null
            return (
              <OverlayElement
                key={ov.id}
                overlay={ov}
                canvasW={canvasDims.w}
                isSelected={selectedOverlayId === ov.id}
                onSelect={(id) => { setSelectedOverlayId(id); setSelectedClipId(null); setSelectedAudioSegId(null) }}
                onMove={(x, y) => updateOverlay(ov.id, { x, y })}
                onResize={(pct) => updateOverlay(ov.id, { widthPct: pct })}
                videoRef={ov.type === 'video'
                  ? (el) => {
                      if (el) overlayVideoElemsRef.current[ov.id] = el
                      else delete overlayVideoElemsRef.current[ov.id]
                    }
                  : undefined}
              />
            )
          })}

          {/* Text layer elements — rendered on top of overlays */}
          {texts.map((t) => {
            const localT = clampedPlayhead - t.startTime
            if (localT < 0 || localT >= t.duration) return null
            return (
              <TextElement
                key={t.id}
                text={t}
                canvasH={canvasDims.h}
                isSelected={selectedTextId === t.id}
                isEditing={editingTextId === t.id}
                onSelect={(id) => { setSelectedTextId(id); setSelectedClipId(null); setSelectedAudioSegId(null); setSelectedOverlayId(null) }}
                onMove={(x, y) => updateText(t.id, { x, y })}
                onContentChange={(content) => updateText(t.id, { content })}
                onResize={(newFs) => updateText(t.id, { fontSize: newFs })}
                onStartEdit={() => setEditingTextId(t.id)}
                onStopEdit={() => setEditingTextId(null)}
              />
            )
          })}

          {/* Play/pause overlay */}
          {clips.length === 0 ? (
            /* Empty state: static icon */
            <div className="w-10 h-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <polygon points="3,2 3,12 12,7" fill="rgba(255,255,255,0.45)" />
              </svg>
            </div>
          ) : (
            /* Clips loaded: play/pause button fades in on hover */
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                {isPlaying ? (
                  /* Pause icon */
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <rect x="3" y="2" width="4" height="14" rx="1" fill="white"/>
                    <rect x="11" y="2" width="4" height="14" rx="1" fill="white"/>
                  </svg>
                ) : (
                  /* Play icon */
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <polygon points="4,2 4,16 16,9" fill="white"/>
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setPreviewExpanded((v) => !v)}
          className="absolute bottom-2 right-3 w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center hover:border-[#3a3a3a] transition-colors"
          aria-label={previewExpanded ? t('editor.preview_shrink') : t('editor.preview_expand')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            {previewExpanded
              ? <path d="M2 7L5 4L8 7" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M2 3L5 6L8 3" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>
      </div>

      {/* Timecode + zoom level + play/pause */}
      <div className="flex items-center justify-between px-4 py-1 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => clampZoom(z / 1.35))}
            className="px-2 py-1 rounded border border-[#252525] text-[9px] text-[#555] hover:text-[#aaa] hover:border-[#3a3a3a] transition-colors"
          >
            {t('editor.zoom_out')}
          </button>
          <button
            onClick={() => setZoom(1)}
            className="text-[10px] text-[#333] hover:text-[#555] transition-colors tabular-nums px-1 min-w-[28px] text-center"
            title={t('editor.zoom_reset')}
          >
            {zoom === 1 ? '1×' : `${zoom.toFixed(1)}×`}
          </button>
          <button
            onClick={() => setZoom((z) => clampZoom(z * 1.35))}
            className="px-2 py-1 rounded border border-[#252525] text-[9px] text-[#555] hover:text-[#aaa] hover:border-[#3a3a3a] transition-colors"
          >
            {t('editor.zoom_in')}
          </button>
        </div>

        {/* Play / Pause */}
        <button
          onClick={() => { if (clips.length > 0) togglePlayback() }}
          disabled={clips.length === 0}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors
            ${clips.length > 0
              ? 'border-[#e87040]/60 hover:border-[#e87040] text-[#e87040]'
              : 'border-[#2a2a2a] text-[#333] cursor-not-allowed'}`}
          aria-label={isPlaying ? t('editor.pause_aria') : t('editor.play_aria')}
        >
          {isPlaying ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" fill="currentColor"/>
              <rect x="6" y="1" width="2.5" height="8" rx="0.5" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <polygon points="2,1 2,9 9,5" fill="currentColor"/>
            </svg>
          )}
        </button>

        <span className="text-[10px] text-[#444] tabular-nums">
          {formatDuration(clampedPlayhead)} / {formatDuration(totalDuration)}
        </span>
      </div>

      {/* ── TIMELINE (scrollable) ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden border-t border-[#1a1a1a] min-h-0"
        onClick={() => { setSelectedClipId(null); setSelectedAudioSegId(null); setSelectedOverlayId(null); setSelectedTextId(null); setEditingTextId(null) }}
      >

        {errorMsg && (
          <div className="mx-3.5 mt-3 px-3 py-2 rounded-lg bg-[#2a0808] border border-[#e87040]/40">
            <span className="text-[10px] text-[#e87040]">{errorMsg}</span>
          </div>
        )}

        {/* ── Unified scrollable timeline: clips + overlays + audio tracks + shared playhead ── */}
        <div ref={clipsRowRef} className="mx-3.5 mb-1 overflow-x-auto pb-2">
          {/* Inner container: relative positioning anchor for the playhead */}
          <div
            ref={timelineInnerRef}
            className="min-w-max relative"
            style={timelineMinWidth}
            onClick={handleTimelineClick}
          >
            {/* LAYER rows (overlays + texts) — grouped by trackIndex, above the clip row */}
            {(() => {
              const allIndices = [
                ...new Set([
                  ...overlays.map((ov) => ov.trackIndex ?? 0),
                  ...texts.map((t) => t.trackIndex ?? 0),
                ]),
              ].sort((a, b) => a - b)
              return allIndices.map((trackIdx) => (
                <div key={trackIdx} className="mb-1.5 relative" style={{ height: 36 }}>
                  {overlays
                    .filter((ov) => (ov.trackIndex ?? 0) === trackIdx)
                    .map((ov) => (
                      <OverlayTile
                        key={ov.id}
                        overlay={ov}
                        zoom={zoom}
                        isSelected={selectedOverlayId === ov.id}
                        onSelect={() => { setSelectedOverlayId(ov.id); setSelectedClipId(null); setSelectedAudioSegId(null); setSelectedTextId(null) }}
                        onStartTimeChange={(newStart) => updateOverlay(ov.id, { startTime: Math.max(0, newStart) })}
                        onDurationChange={(newDur) => updateOverlay(ov.id, { duration: newDur })}
                        onTrackChange={(newIdx) => updateOverlay(ov.id, { trackIndex: newIdx })}
                        onDelete={() => handleDeleteOverlay(ov.id)}
                        snapFn={(t) => snapTime(t, buildSnapPoints(ov.id, null, null))}
                      />
                    ))
                  }
                  {texts
                    .filter((t) => (t.trackIndex ?? 0) === trackIdx)
                    .map((t) => (
                      <TextTile
                        key={t.id}
                        text={t}
                        zoom={zoom}
                        isSelected={selectedTextId === t.id}
                        onSelect={() => { setSelectedTextId(t.id); setSelectedClipId(null); setSelectedAudioSegId(null); setSelectedOverlayId(null) }}
                        onStartTimeChange={(newStart) => updateText(t.id, { startTime: Math.max(0, newStart) })}
                        onDurationChange={(newDur) => updateText(t.id, { duration: newDur })}
                        onTrackChange={(newIdx) => updateText(t.id, { trackIndex: newIdx })}
                        onDelete={() => handleDeleteText(t.id)}
                        snapFn={(ti) => snapTime(ti, buildSnapPoints(null, t.id, null))}
                      />
                    ))
                  }
                </div>
              ))
            })()}

            {/* Clips row with drag & drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={clips.map((c) => c.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex items-center gap-1.5" style={{ height: 56 }}>
                  {clips.map((clip) => (
                    <SortableClipTile
                      key={clip.id}
                      clip={clip}
                      zoom={zoom}
                      isSelected={selectedClipId === clip.id}
                      onSelect={(id) => { setSelectedClipId(id); setSelectedAudioSegId(null); setSelectedOverlayId(null) }}
                      onDelete={handleDeleteClip}
                    />
                  ))}

                  {/* Add clip button — always at the end, outside sortable */}
                  <button
                    data-no-seek
                    onClick={(e) => { e.stopPropagation(); setErrorMsg(''); fileInputRef.current?.click() }}
                    className="flex-shrink-0 h-14 w-16 rounded-lg border border-dashed border-[#2a2a2a] flex items-center justify-center text-[#3a3a3a] text-lg hover:border-[#3a3a3a] transition-colors"
                    aria-label={t('editor.add_clip')}
                  >
                    +
                  </button>
                </div>
              </SortableContext>
            </DndContext>

            {/* AUDIO track rows */}
            {audioTracks.map((track) => {
              const offsetPx = Math.round((track.startOffset || 0) * PX_PER_SEC * zoom)
              return (
                <div key={track.trackId} className="mt-1.5" style={{ height: 36 }}>
                  <div className="relative" style={{ height: 36 }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: offsetPx,
                        top: 0,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {track.segments.map((seg) => (
                        <AudioSegTile
                          key={seg.id}
                          seg={seg}
                          zoom={zoom}
                          isSelected={selectedAudioSegId === seg.id}
                          onSelect={(id) => { setSelectedAudioSegId(id); setSelectedClipId(null); setSelectedOverlayId(null) }}
                          onDelete={() => handleDeleteAudioSeg(track.trackId, seg.id)}
                          trackStartOffset={track.startOffset || 0}
                          onTrackOffsetChange={(newOffset) => updateAudioTrack(track.trackId, { startOffset: newOffset })}
                          snapFn={(t) => snapTime(t, buildSnapPoints(null, null, track.trackId))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* "+ pista" row (always visible as the last row in the inner container) */}
            <div className="mt-1.5 flex items-center gap-1.5" style={{ height: 36 }}>
              <button
                data-no-seek
                onClick={(e) => { e.stopPropagation(); setErrorMsg(''); audioFileInputRef.current?.click() }}
                className="h-9 w-[72px] rounded-md border border-dashed border-[#2a2a2a] flex items-center justify-center text-[#3a3a3a] text-lg hover:border-[#3a3a3a] transition-colors flex-shrink-0"
                aria-label={t('editor.add_track')}
              >
                +
              </button>
            </div>

            {/* ── Playhead — spans full height of the inner container ── */}
            {(clips.length > 0 || audioTracks.length > 0 || overlays.length > 0) && totalDuration > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: playheadX,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: '#e87040',
                  boxShadow: '0 0 0 1px #000',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                {/* Drag handle */}
                <div
                  data-no-seek
                  style={{ pointerEvents: 'auto' }}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#e87040] rounded-full cursor-ew-resize touch-none ring-2 ring-black"
                  onPointerDown={handlePlayheadPointerDown}
                  onPointerMove={handlePlayheadPointerMove}
                  onPointerUp={handlePlayheadPointerUp}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Clip properties panel — shown when a clip is selected ── */}
        {selectedClip && (
          <div onClick={(e) => e.stopPropagation()}>
            <ClipPanel
              clip={selectedClip}
              onUpdate={(changes) => updateClip(selectedClipId, changes)}
              onDelete={() => handleDeleteClip(selectedClipId)}
            />
          </div>
        )}

        {/* ── Audio segment panel — shown when an audio segment is selected ── */}
        {selectedAudioSegId && (() => {
          const found = findAudioSeg(audioTracks, selectedAudioSegId)
          if (!found) return null
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <AudioSegPanel
                seg={found.seg}
                onUpdate={(changes) => updateAudioSeg(found.track.trackId, found.seg.id, changes)}
                onDelete={() => handleDeleteAudioSeg(found.track.trackId, found.seg.id)}
              />
            </div>
          )
        })()}

        {/* ── Overlay panel — shown when an overlay is selected ── */}
        {selectedOverlayId && (() => {
          const ov = overlays.find((o) => o.id === selectedOverlayId)
          if (!ov) return null
          const maxTrack = Math.max(...overlays.map((o) => o.trackIndex ?? 0))
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <OverlayPanel
                overlay={ov}
                maxTrack={maxTrack}
                onUpdate={(changes) => updateOverlay(ov.id, changes)}
                onTrackChange={(newIdx) => updateOverlay(ov.id, { trackIndex: newIdx })}
                onDelete={() => handleDeleteOverlay(ov.id)}
              />
            </div>
          )
        })()}

        {/* ── Text layer panel — shown when a text layer is selected ── */}
        {selectedTextId && (() => {
          const txt = texts.find((t) => t.id === selectedTextId)
          if (!txt) return null
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <TextPanel
                text={txt}
                onUpdate={(changes) => updateText(txt.id, changes)}
                onEdit={() => setEditingTextId(txt.id)}
                onDelete={() => handleDeleteText(txt.id)}
              />
            </div>
          )
        })()}

        <p className="text-center text-[9px] text-[#2a2a2a] py-4">
          {t('editor.scroll_hint')}
        </p>
      </div>

      {/* ── ADSENSE BANNER ── */}
      <AdSlot variant="banner" />

      {/* ── BOTTOM ACTION BAR ── */}
      <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] px-2 py-3 flex gap-2 shrink-0">
        <ActionBtn label={t('editor.add_clip')} onClick={() => { setErrorMsg(''); fileInputRef.current?.click() }} />
        <ActionBtn label={t('editor.split')} onClick={handleSplit} />
        <ActionBtn label={t('editor.add_audio')} onClick={() => { setErrorMsg(''); audioFileInputRef.current?.click() }} />
        <ActionBtn label={t('editor.add_layer')} onClick={() => { setErrorMsg(''); overlayFileInputRef.current?.click() }} />
        <ActionBtn label={t('editor.add_text')} onClick={handleAddText} />
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/x-wav,.mp3,.aac,.wav"
        className="hidden"
        onChange={handleAudioFileSelect}
      />
      <input
        ref={overlayFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleOverlayFileSelect}
      />

      {/* Hidden audio elements — one per audio track, used for preview playback */}
      {audioTracks.map((track) => (
        <audio
          key={track.trackId}
          ref={(el) => {
            if (el) audioElemsRef.current[track.trackId] = el
            else delete audioElemsRef.current[track.trackId]
          }}
          preload="auto"
          className="hidden"
        />
      ))}

      {/* ── EXPORT MODAL ── */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        clips={clips}
        audioTracks={audioTracks}
        overlays={overlays}
        texts={texts}
        ratio={ratio}
      />

      {/* ── FEEDBACK ── */}
      <FeedbackButton />

      {/* ── TUTORIAL MODAL ── */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      {/* ── BACK CONFIRMATION DIALOG ── */}
      {showBackConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowBackConfirm(false)}
        >
          <div
            className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-6 py-5 mx-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-[#2a0808] border border-[#e87040]/40 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2L9 10" stroke="#e87040" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="9" cy="14" r="1.2" fill="#e87040"/>
                </svg>
              </div>
            </div>
            <p className="text-white text-sm font-semibold text-center mb-1">{t('editor.back_confirm_title')}</p>
            <p className="text-[#666] text-xs text-center mb-5 leading-relaxed">
              {t('editor.back_confirm_body')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBackConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors"
              >
                {t('editor.back_confirm_cancel')}
              </button>
              <button
                onClick={() => navigate('/video-editor')}
                className="flex-1 py-2 rounded-lg bg-[#e87040] text-black text-xs font-bold hover:opacity-90 transition-opacity"
              >
                {t('editor.back_confirm_yes')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function SortableClipTile({ clip, zoom, isSelected, onSelect, onDelete }) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id })

  const outerStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: clipWidth(clip, zoom),
    opacity: isDragging ? 0.45 : 1,
    zIndex:  isDragging ? 10 : 'auto',
  }

  const label = clip.name.replace(/\.[^.]+$/, '')

  return (
    <div
      ref={setNodeRef}
      data-no-seek
      style={outerStyle}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onSelect(clip.id) }}
      className={`flex-shrink-0 h-14 rounded-lg border overflow-hidden flex items-stretch cursor-grab active:cursor-grabbing bg-[#1a0d05] relative
        ${isSelected
          ? 'border-white/90'
          : 'border-[#e87040]/70'}`}
    >
      {/* Thumbnail */}
      {clip.thumbnail
        ? <img src={clip.thumbnail} alt="" className="h-full w-auto object-cover flex-shrink-0 pointer-events-none" />
        : <div className="h-full w-10 bg-[#2a2a2a] flex-shrink-0" />
      }

      {/* Title + duration */}
      <div className="flex flex-col justify-center px-2 min-w-0 pointer-events-none">
        <span className="text-[10px] text-white font-medium truncate leading-tight">{label}</span>
        {clip.file?.size && (
          <span className="text-[8px] text-[#888] leading-none">{(clip.file.size / 1024 / 1024).toFixed(1)} MB</span>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] text-[#e87040] tabular-nums">{formatDuration(effectiveDuration(clip))}</span>
          {clip.speed && clip.speed !== 1 && (
            <span className="text-[8px] text-[#e87040] bg-[#e87040]/20 px-1 rounded">
              {clip.speed}×
            </span>
          )}
          {clip.muted && <IconMuted size={10} className="text-[#555]" />}
        </div>
      </div>

      {/* Delete overlay — shown when selected */}
      {isSelected && (
        <button
          data-no-seek
          onClick={(e) => { e.stopPropagation(); onDelete(clip.id) }}
          className="absolute top-1 right-1 w-5 h-5 rounded bg-black/75 flex items-center justify-center hover:bg-black/95 transition-opacity"
          aria-label={t('editor.delete_clip_aria')}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function ClipPanel({ clip, onUpdate, onDelete }) {
  const { t } = useTranslation()
  const speed  = clip.speed  ?? 1
  const volume = clip.volume ?? 1
  const muted  = clip.muted  ?? false

  return (
    <div className="mx-3.5 mb-2 p-3 rounded-lg bg-[#0d0d0d] border border-[#1f1f1f]">

      {/* Speed */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#444] tracking-widest w-14 shrink-0">{t('editor.panel_speed')}</span>
        <div className="flex gap-1.5">
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => onUpdate({ speed: s })}
              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors
                ${speed === s
                  ? 'bg-[#e87040] border-[#e87040] text-black'
                  : 'bg-transparent border-[#2a2a2a] text-[#555] hover:border-[#444]'}`}
            >
              {s === 0.5 ? '0.5×' : s === 1 ? '1×' : '2×'}
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#444] tracking-widest w-14 shrink-0">{t('editor.panel_volume')}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(e) => onUpdate({ volume: parseFloat(e.target.value), muted: false })}
          className="flex-1 accent-[#e87040] h-1 cursor-pointer"
        />
        <span className="text-[9px] text-[#444] tabular-nums w-8 text-right shrink-0">
          {muted ? '0%' : `${Math.round(volume * 100)}%`}
        </span>
      </div>

      {/* Mute toggle */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#444] tracking-widest w-14 shrink-0">{t('editor.panel_audio')}</span>
        <button
          onClick={() => onUpdate({ muted: !muted })}
          className={`w-8 h-8 rounded border flex items-center justify-center transition-colors
            ${muted
              ? 'bg-[#e87040] border-[#e87040] text-black'
              : 'bg-transparent border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#888]'}`}
          aria-label={muted ? t('editor.unmute') : t('editor.mute')}
        >
          {muted ? <IconMuted size={14}/> : <IconVolume size={14}/>}
        </button>
      </div>

      {/* Delete clip */}
      <div className="flex items-center gap-3 pt-3 border-t border-[#1a1a1a]">
        <span className="text-[9px] text-[#444] tracking-widest w-14 shrink-0">{t('editor.panel_clip')}</span>
        <button
          onClick={onDelete}
          className="px-3 py-1 rounded border border-[#2a1a1a] text-[#884040] text-[10px] hover:border-[#3a2020] transition-colors"
        >
          {t('editor.delete')}
        </button>
      </div>

    </div>
  )
}

// ── icon primitives ───────────────────────────────────────────────────────────

function IconVolume({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M2 5.5h2.5L8 2v12L4.5 10.5H2V5.5z" fill="currentColor"/>
      <path d="M10.5 5a4 4 0 010 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M12.5 3a7 7 0 010 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconMuted({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M2 5.5h2.5L8 2v12L4.5 10.5H2V5.5z" fill="currentColor"/>
      <path d="M11 6l3.5 3.5M14.5 6L11 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function ActionBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-[#2a1508] border border-[#e87040]/60 text-[#e87040] text-[10px] font-bold py-2.5 rounded-lg hover:opacity-90 active:opacity-75 transition-opacity"
    >
      {label}
    </button>
  )
}

// ── AudioSegTile — one audio segment block in the timeline ────────────────────

function AudioSegTile({ seg, zoom, isSelected, onSelect, onDelete, trackStartOffset, onTrackOffsetChange, snapFn }) {
  const { t } = useTranslation()
  const width = audioSegWidth(seg, zoom)
  const label = seg.name.replace(/\.[^.]+$/, '')
  const dragRef = useRef(null)

  function handlePointerDown(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startOffset: trackStartOffset ?? 0, dragging: false }
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    if (!dragRef.current.dragging && Math.abs(dx) > 5) {
      dragRef.current.dragging = true
    }
    if (dragRef.current.dragging && onTrackOffsetChange) {
      const rawOffset = Math.max(0, dragRef.current.startOffset + dx / (PX_PER_SEC * zoom))
      onTrackOffsetChange(snapFn ? snapFn(rawOffset) : rawOffset)
    }
  }

  function handlePointerUp(e) {
    const wasDragging = dragRef.current?.dragging ?? false
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!wasDragging) onSelect(seg.id)
  }

  return (
    <div
      data-no-seek
      style={{ width, flexShrink: 0, touchAction: 'none' }}
      className={`h-9 rounded-md border flex items-center overflow-hidden relative select-none
        ${isSelected ? 'border-white/90 cursor-grabbing' : 'border-[#4a8c5c]/70 cursor-grab'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Waveform-like background */}
      <div className="absolute inset-0 bg-[#0d1f12] opacity-90" />

      {/* Music note icon */}
      <div className="relative flex-shrink-0 pl-2 pr-1">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M4 9V3l6-1.5v1.5L4 4.5V9" fill="none" stroke="#4a8c5c" strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="3" cy="9" r="1.5" fill="#4a8c5c"/>
          <circle cx="9" cy="7.5" r="1.5" fill="#4a8c5c"/>
        </svg>
      </div>

      {/* Label + duration */}
      <div className="relative flex flex-col justify-center min-w-0 flex-1 pr-1">
        <span className="text-[9px] text-[#4a8c5c] font-medium truncate leading-tight">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-[#3a7a4c] tabular-nums">{formatDuration(seg.duration)}</span>
          {seg.fadeOut && <span className="text-[7px] text-[#3a7a4c] opacity-70">↘</span>}
        </div>
      </div>

      {/* Delete button when selected */}
      {isSelected && (
        <button
          data-no-seek
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/75 flex items-center justify-center hover:bg-black/95 transition-opacity"
          aria-label={t('editor.delete_aria')}
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// ── AudioSegPanel — controls for a selected audio segment ─────────────────────

function AudioSegPanel({ seg, onUpdate, onDelete }) {
  const { t } = useTranslation()
  const volume  = seg.volume  ?? 1
  const fadeOut = seg.fadeOut ?? false

  return (
    <div className="mx-3.5 mb-2 p-3 rounded-lg bg-[#0d0d0d] border border-[#1f2e22]">

      {/* Volume */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#3a7a4c] tracking-widest w-14 shrink-0">{t('editor.panel_volume')}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: '#4a8c5c' }}
        />
        <span className="text-[9px] text-[#3a7a4c] tabular-nums w-8 text-right shrink-0">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Fade out toggle */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#3a7a4c] tracking-widest w-14 shrink-0">{t('editor.panel_fade_out')}</span>
        <button
          onClick={() => onUpdate({ fadeOut: !fadeOut })}
          className={`px-3 py-1 rounded border text-[10px] font-bold transition-colors
            ${fadeOut
              ? 'bg-[#4a8c5c] border-[#4a8c5c] text-black'
              : 'bg-transparent border-[#1f2e22] text-[#3a7a4c] hover:border-[#2a4a30]'}`}
        >
          ↘ fade
        </button>
        <span className="text-[8px] text-[#2a4a30]">{t('editor.fade_soft')}</span>
      </div>

      {/* Delete track */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-[#3a7a4c] tracking-widest w-14 shrink-0">{t('editor.panel_track')}</span>
        <button
          onClick={onDelete}
          className="px-3 py-1 rounded border border-[#2a1a1a] text-[#884040] text-[10px] hover:border-[#3a2020] transition-colors"
        >
          {t('editor.delete')}
        </button>
      </div>

    </div>
  )
}

// ── OverlayTile — one overlay block in the timeline ──────────────────────────

const OVERLAY_ROW_HEIGHT = 42  // 36px tile + 6px gap — used for vertical drag snapping

function OverlayTile({ overlay, zoom, isSelected, onSelect, onStartTimeChange, onDurationChange, onTrackChange, onDelete, snapFn }) {
  const { t } = useTranslation()
  const width = overlayTileWidth(overlay, zoom)
  const left  = Math.round(overlay.startTime * PX_PER_SEC * zoom)
  const label = overlay.name.replace(/\.[^.]+$/, '')
  const dragRef       = useRef(null)  // for moving (startTime + trackIndex)
  const resizeDragRef = useRef(null)  // for resizing (duration)

  function handlePointerDown(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: overlay.startTime,
      startTrack: overlay.trackIndex ?? 0,
      dragging: false,
    }
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) dragRef.current.dragging = true
    if (dragRef.current.dragging) {
      // Horizontal → startTime (with snap)
      const rawTime = Math.max(0, dragRef.current.startTime + dx / (PX_PER_SEC * zoom))
      onStartTimeChange(snapFn ? snapFn(rawTime) : rawTime)
      // Vertical → trackIndex (snaps to row)
      const trackDelta = Math.round(dy / OVERLAY_ROW_HEIGHT)
      const newTrack = Math.max(0, dragRef.current.startTrack + trackDelta)
      if (newTrack !== (overlay.trackIndex ?? 0)) onTrackChange(newTrack)
    }
  }

  function handlePointerUp(e) {
    const wasDragging = dragRef.current?.dragging ?? false
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!wasDragging) onSelect()
  }

  return (
    <div
      data-no-seek
      style={{ position: 'absolute', left, top: 0, width, height: '100%', touchAction: 'none' }}
      className={`rounded-md border flex items-center overflow-hidden relative select-none ${isSelected
          ? 'border-white/90 cursor-grabbing'
          : overlay.type === 'video'
            ? 'border-[#5a7c9e]/70 cursor-grab'
            : 'border-[#7c5a9e]/70 cursor-grab'
        }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`absolute inset-0 opacity-90 ${overlay.type === 'video' ? 'bg-[#0f1a2e]' : 'bg-[#1a0f2e]'}`} />

      {/* Type icon */}
      <div className="relative flex-shrink-0 pl-2 pr-1">
        {overlay.type === 'image' ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="10" height="10" rx="2" stroke="#9a7cbe" strokeWidth="1.2"/>
            <circle cx="4" cy="4.5" r="1.2" fill="#9a7cbe"/>
            <path d="M1 8.5l3-3 2 2 2-2.5 3 3.5" stroke="#9a7cbe" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="2" width="8" height="8" rx="1.5" stroke="#7aabe" strokeWidth="1.2"/>
            <path d="M9 5l2.5-2v6L9 7" stroke="#7aaabe" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Label + duration */}
      <div className="relative flex flex-col justify-center min-w-0 flex-1 pr-3">
        <span className={`text-[9px] font-medium truncate leading-tight ${overlay.type === 'video' ? 'text-[#7aaabe]' : 'text-[#9a7cbe]'}`}>{label}</span>
        <span className={`text-[8px] tabular-nums ${overlay.type === 'video' ? 'text-[#5a8aae]' : 'text-[#7a5cae]'}`}>{formatDuration(overlay.duration)}</span>
      </div>

      {/* Delete button when selected */}
      {isSelected && (
        <button
          data-no-seek
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-0.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded bg-black/75 flex items-center justify-center hover:bg-black/95 transition-opacity z-10"
          aria-label={t('editor.delete_layer_aria')}
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Resize handle — right edge (drag to change duration) */}
      <div
        data-no-seek
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 12,
          height: '100%',
          cursor: 'ew-resize',
          touchAction: 'none',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        className="bg-[#2e1f4a] hover:bg-[#4a2f7a] transition-colors rounded-r-[5px]"
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          resizeDragRef.current = { startX: e.clientX, startDuration: overlay.duration, startTime: overlay.startTime }
        }}
        onPointerMove={(e) => {
          if (!resizeDragRef.current) return
          const dx = e.clientX - resizeDragRef.current.startX
          const rawEnd = resizeDragRef.current.startTime + resizeDragRef.current.startDuration + dx / (PX_PER_SEC * zoom)
          const snappedEnd = snapFn ? snapFn(rawEnd) : rawEnd
          onDurationChange(Math.max(0.5, snappedEnd - resizeDragRef.current.startTime))
        }}
        onPointerUp={(e) => {
          resizeDragRef.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="4" height="12" viewBox="0 0 4 12" fill="none" aria-hidden="true">
          <line x1="1" y1="2" x2="1" y2="10" stroke="#9a7cbe" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="3" y1="2" x2="3" y2="10" stroke="#9a7cbe" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── OverlayElement — draggable + resizable overlay on the canvas ──────────────

function OverlayElement({ overlay, canvasW, isSelected, onSelect, onMove, onResize, videoRef }) {
  const dragRef   = useRef(null)  // move drag
  const cornerRef = useRef(null)  // corner resize drag
  const pinchRef  = useRef(null)  // pinch resize

  const pixelWidth = Math.round((overlay.widthPct ?? 0.35) * (canvasW || 300))

  // ── move drag (pointer) ──
  function handlePointerDown(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const parent = e.currentTarget.parentElement
    const rect = parent.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startOvX: overlay.x, startOvY: overlay.y,
      parentW: rect.width, parentH: rect.height,
      dragging: false,
    }
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dr = dragRef.current
    const dx = e.clientX - dr.startX
    const dy = e.clientY - dr.startY
    if (!dr.dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) dr.dragging = true
    if (dr.dragging) {
      onMove(
        Math.max(0, Math.min(1, dr.startOvX + dx / dr.parentW)),
        Math.max(0, Math.min(1, dr.startOvY + dy / dr.parentH)),
      )
    }
  }

  function handlePointerUp(e) {
    const wasDragging = dragRef.current?.dragging ?? false
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!wasDragging) onSelect(overlay.id)
  }

  // ── pinch resize (touch) ──
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      e.stopPropagation()
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      pinchRef.current = { startDist: d, startPct: overlay.widthPct ?? 0.35 }
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.stopPropagation()
      e.preventDefault()
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      const ratio = d / pinchRef.current.startDist
      onResize(Math.max(0.05, pinchRef.current.startPct * ratio))
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length < 2) pinchRef.current = null
  }

  const mediaStyle = { display: 'block', width: '100%', height: 'auto', pointerEvents: 'none', borderRadius: 4 }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${overlay.x * 100}%`,
        top: `${overlay.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: pixelWidth,
        zIndex: isSelected ? 15 : 10,
        opacity: overlay.opacity ?? 1,
        cursor: 'move',
        touchAction: 'none',
        userSelect: 'none',
        outline: isSelected ? '2px solid rgba(255,255,255,0.8)' : 'none',
        outlineOffset: 2,
        borderRadius: 4,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => e.stopPropagation()}
    >
      {overlay.type === 'image' ? (
        <img src={overlay.objectUrl} alt="" style={mediaStyle} draggable={false} />
      ) : (
        <video ref={videoRef} src={overlay.objectUrl} style={mediaStyle} playsInline preload="auto" />
      )}

      {/* Corner resize handle — inside bottom-right corner, visible when selected */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            bottom: 3,
            right: 3,
            width: 14,
            height: 14,
            background: 'white',
            border: '2px solid rgba(0,0,0,0.4)',
            borderRadius: 3,
            cursor: 'nwse-resize',
            touchAction: 'none',
            zIndex: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            cornerRef.current = { startX: e.clientX, startPct: overlay.widthPct ?? 0.35 }
          }}
          onPointerMove={(e) => {
            if (!cornerRef.current) return
            const dx = e.clientX - cornerRef.current.startX
            const newPct = Math.max(0.05, cornerRef.current.startPct + dx / (canvasW || 300))
            onResize(newPct)
          }}
          onPointerUp={(e) => {
            cornerRef.current = null
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}

// ── OverlayPanel — controls for a selected overlay ────────────────────────────

function OverlayPanel({ overlay, maxTrack, onUpdate, onTrackChange, onDelete }) {
  const { t } = useTranslation()
  const opacity    = overlay.opacity    ?? 1
  const widthPct   = overlay.widthPct   ?? 0.35
  const trackIndex = overlay.trackIndex ?? 0

  return (
    <div className="mx-3.5 mb-2 p-3 rounded-lg bg-[#0d0d0d] border border-[#2e1f4a]">

      {/* Size */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#7a5cae] tracking-widest w-14 shrink-0">{t('editor.panel_size')}</span>
        <input
          type="range"
          min="0.05"
          max="3"
          step="0.01"
          value={widthPct}
          onChange={(e) => onUpdate({ widthPct: parseFloat(e.target.value) })}
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: '#7c5a9e' }}
        />
        <span className="text-[9px] text-[#7a5cae] tabular-nums w-8 text-right shrink-0">
          {Math.round(widthPct * 100)}%
        </span>
      </div>

      {/* Video-only controls: speed + volume + mute */}
      {overlay.type === 'video' && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[9px] text-[#7a5cae] tracking-widest w-14 shrink-0">{t('editor.panel_speed')}</span>
            <div className="flex gap-1.5">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdate({ speed: s })}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors
                    ${(overlay.speed ?? 1) === s
                      ? 'bg-[#7c5a9e] border-[#7c5a9e] text-white'
                      : 'bg-transparent border-[#2a1f4a] text-[#7a5cae] hover:border-[#4a3a6a]'}`}
                >
                  {s === 0.5 ? '0.5×' : s === 1 ? '1×' : '2×'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-[9px] text-[#7a5cae] tracking-widest w-14 shrink-0">{t('editor.panel_volume')}</span>
            <input
              type="range" min="0" max="1" step="0.01"
              value={overlay.muted ? 0 : (overlay.volume ?? 1)}
              onChange={(e) => onUpdate({ volume: parseFloat(e.target.value), muted: false })}
              className="flex-1 h-1 cursor-pointer"
              style={{ accentColor: '#7c5a9e' }}
            />
            <span className="text-[9px] text-[#7a5cae] tabular-nums w-8 text-right shrink-0">
              {overlay.muted ? '0%' : `${Math.round((overlay.volume ?? 1) * 100)}%`}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-[9px] text-[#7a5cae] tracking-widest w-14 shrink-0">{t('editor.panel_audio')}</span>
            <button
              onClick={() => onUpdate({ muted: !(overlay.muted ?? false) })}
              className={`w-8 h-8 rounded border flex items-center justify-center transition-colors
                ${(overlay.muted ?? false)
                  ? 'bg-[#7c5a9e] border-[#7c5a9e] text-white'
                  : 'bg-transparent border-[#2a1f4a] text-[#7a5cae] hover:border-[#4a3a6a] hover:text-[#9a7cbe]'}`}
              aria-label={(overlay.muted ?? false) ? t('editor.unmute') : t('editor.mute')}
            >
              {(overlay.muted ?? false) ? <IconMuted size={14}/> : <IconVolume size={14}/>}
            </button>
          </div>
        </>
      )}

      {/* Opacity */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#7a5cae] tracking-widest w-14 shrink-0">{t('editor.panel_opacity')}</span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: '#7c5a9e' }}
        />
        <span className="text-[9px] text-[#7a5cae] tabular-nums w-8 text-right shrink-0">
          {Math.round(opacity * 100)}%
        </span>
      </div>

      {/* Delete */}
      <div className="flex items-center gap-3 pt-3 border-t border-[#1a1428]">
        <span className="text-[9px] text-[#7a5cae] tracking-widest w-14 shrink-0">{t('editor.panel_layer')}</span>
        <button
          onClick={onDelete}
          className="px-3 py-1 rounded border border-[#2a1a1a] text-[#884040] text-[10px] hover:border-[#3a2020] transition-colors"
        >
          {t('editor.delete')}
        </button>
      </div>

    </div>
  )
}

// ── TextTile — one text layer block in the timeline ───────────────────────────

const TEXT_ROW_HEIGHT = 42  // same as OVERLAY_ROW_HEIGHT for consistent vertical drag

function TextTile({ text, zoom, isSelected, onSelect, onStartTimeChange, onDurationChange, onTrackChange, onDelete, snapFn }) {
  const { t } = useTranslation()
  const width = Math.max(MIN_CLIP_PX, text.duration * PX_PER_SEC * zoom)
  const left  = Math.round(text.startTime * PX_PER_SEC * zoom)
  const label = text.content.length > 20 ? text.content.slice(0, 20) + '…' : text.content
  const dragRef       = useRef(null)
  const resizeDragRef = useRef(null)

  function handlePointerDown(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startTime: text.startTime, startTrack: text.trackIndex ?? 0,
      dragging: false,
    }
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) dragRef.current.dragging = true
    if (dragRef.current.dragging) {
      const rawTime = Math.max(0, dragRef.current.startTime + dx / (PX_PER_SEC * zoom))
      onStartTimeChange(snapFn ? snapFn(rawTime) : rawTime)
      const trackDelta = Math.round(dy / TEXT_ROW_HEIGHT)
      const newTrack = Math.max(0, dragRef.current.startTrack + trackDelta)
      if (newTrack !== (text.trackIndex ?? 0)) onTrackChange(newTrack)
    }
  }

  function handlePointerUp(e) {
    const wasDragging = dragRef.current?.dragging ?? false
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!wasDragging) onSelect()
  }

  return (
    <div
      data-no-seek
      style={{ position: 'absolute', left, top: 0, width, height: '100%', touchAction: 'none' }}
      className={`rounded-md border flex items-center overflow-hidden relative select-none
        ${isSelected ? 'border-white/90 cursor-grabbing' : 'border-[#8c7a20]/70 cursor-grab'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-[#1e1a05] opacity-90" />

      {/* T icon */}
      <div className="relative flex-shrink-0 pl-2 pr-1">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1 2.5h10M6 2.5V10" stroke="#c8b040" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Label + duration */}
      <div className="relative flex flex-col justify-center min-w-0 flex-1 pr-3">
        <span className="text-[9px] text-[#c8b040] font-medium truncate leading-tight">{label}</span>
        <span className="text-[8px] text-[#8c7a20] tabular-nums">{formatDuration(text.duration)}</span>
      </div>

      {/* Delete button when selected */}
      {isSelected && (
        <button
          data-no-seek
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-0.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded bg-black/75 flex items-center justify-center hover:bg-black/95 transition-opacity z-10"
          aria-label={t('editor.delete_text_aria')}
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Resize handle — right edge */}
      <div
        data-no-seek
        style={{ position: 'absolute', right: 0, top: 0, width: 12, height: '100%', cursor: 'ew-resize', touchAction: 'none', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="bg-[#2e2a05] hover:bg-[#4a4010] transition-colors rounded-r-[5px]"
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          resizeDragRef.current = { startX: e.clientX, startDuration: text.duration, startTime: text.startTime }
        }}
        onPointerMove={(e) => {
          if (!resizeDragRef.current) return
          const dx = e.clientX - resizeDragRef.current.startX
          const rawEnd = resizeDragRef.current.startTime + resizeDragRef.current.startDuration + dx / (PX_PER_SEC * zoom)
          const snappedEnd = snapFn ? snapFn(rawEnd) : rawEnd
          onDurationChange(Math.max(0.5, snappedEnd - resizeDragRef.current.startTime))
        }}
        onPointerUp={(e) => {
          resizeDragRef.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="4" height="12" viewBox="0 0 4 12" fill="none" aria-hidden="true">
          <line x1="1" y1="2" x2="1" y2="10" stroke="#c8b040" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="3" y1="2" x2="3" y2="10" stroke="#c8b040" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── TextElement — editable text rendered on the canvas ────────────────────────

function TextElement({ text, canvasH, isSelected, isEditing, onSelect, onMove, onContentChange, onResize, onStartEdit, onStopEdit }) {
  const dragRef   = useRef(null)
  const cornerRef = useRef(null)
  const textareaRef = useRef(null)

  const actualFontSize = Math.round((text.fontSize ?? 0.08) * (canvasH || 400))
  const fontFamily = FONT_FAMILIES[text.fontFamily ?? 'sans']

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  function handlePointerDown(e) {
    if (isEditing) return
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const parent = e.currentTarget.parentElement
    const rect = parent.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startOvX: text.x, startOvY: text.y,
      parentW: rect.width, parentH: rect.height,
      dragging: false,
    }
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dr = dragRef.current
    const dx = e.clientX - dr.startX
    const dy = e.clientY - dr.startY
    if (!dr.dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) dr.dragging = true
    if (dr.dragging) {
      onMove(
        Math.max(0, Math.min(1, dr.startOvX + dx / dr.parentW)),
        Math.max(0, Math.min(1, dr.startOvY + dy / dr.parentH)),
      )
    }
  }

  function handlePointerUp(e) {
    const wasDragging = dragRef.current?.dragging ?? false
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!wasDragging) onSelect(text.id)
  }

  const sharedStyle = {
    fontSize: actualFontSize,
    fontFamily,
    color: text.color ?? '#ffffff',
    fontWeight: text.bold ? 'bold' : 'normal',
    fontStyle: text.italic ? 'italic' : 'normal',
    textAlign: 'center',
    lineHeight: 1.2,
    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
    whiteSpace: 'pre',
    wordBreak: 'normal',
    minWidth: actualFontSize * 2,
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${text.x * 100}%`,
        top: `${text.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 25 : 12,
        opacity: text.opacity ?? 1,
        cursor: isEditing ? 'default' : 'move',
        touchAction: isEditing ? 'auto' : 'none',
        userSelect: isEditing ? 'text' : 'none',
        outline: isSelected && !isEditing ? '2px solid rgba(255,255,255,0.8)' : 'none',
        outlineOffset: 4,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => { e.stopPropagation(); onStartEdit() }}
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text.content}
          onChange={(e) => onContentChange(e.target.value)}
          onBlur={onStopEdit}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            ...sharedStyle,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 4,
            padding: '4px 8px',
            outline: 'none',
            resize: 'none',
            cursor: 'text',
            minHeight: actualFontSize * 1.5,
            width: Math.max(120, text.content.length * actualFontSize * 0.6),
          }}
          rows={Math.max(1, text.content.split('\n').length)}
        />
      ) : (
        <span style={{ ...sharedStyle, display: 'block', padding: '2px 6px' }}>
          {text.content || ' '}
        </span>
      )}

      {/* Corner resize handle — bottom-right, only when selected and not editing */}
      {isSelected && !isEditing && (
        <div
          style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 14, height: 14,
            background: 'white', borderRadius: 2,
            cursor: 'nwse-resize', touchAction: 'none', zIndex: 30,
            boxShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            cornerRef.current = { startY: e.clientY, startFs: text.fontSize ?? 0.08, canvasH: canvasH || 400 }
          }}
          onPointerMove={(e) => {
            if (!cornerRef.current) return
            const dy = e.clientY - cornerRef.current.startY
            const newFs = Math.max(0.02, Math.min(0.4, cornerRef.current.startFs + dy / cornerRef.current.canvasH))
            onResize(newFs)
          }}
          onPointerUp={(e) => {
            cornerRef.current = null
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
        />
      )}
    </div>
  )
}

// ── TextPanel — controls for a selected text layer ────────────────────────────

function TextPanel({ text, onUpdate, onEdit, onDelete }) {
  const { t } = useTranslation()
  const opacity    = text.opacity    ?? 1
  const fontSize   = text.fontSize   ?? 0.08
  const fontFamily = text.fontFamily ?? 'sans'
  const color      = text.color      ?? '#ffffff'
  const bold       = text.bold       ?? false
  const italic     = text.italic     ?? false

  return (
    <div className="mx-3.5 mb-2 p-3 rounded-lg bg-[#0d0d0d] border border-[#2e2a0a]">

      {/* Content + edit button */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-[9px] text-[#8c7a20] tracking-widest w-14 shrink-0 pt-1">{t('editor.panel_text_label')}</span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] text-[#c8b040] bg-[#1e1a05] border border-[#2e2a0a] rounded px-2 py-1 truncate cursor-pointer hover:border-[#4a4010] transition-colors"
            onClick={onEdit}
            title={t('editor.text_edit_tooltip')}
          >
            {text.content || <span className="text-[#4a4010] italic">{t('editor.text_empty')}</span>}
          </div>
          <p className="text-[8px] text-[#4a4010] mt-0.5">{t('editor.text_edit_hint')}</p>
        </div>
      </div>

      {/* Font family */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#8c7a20] tracking-widest w-14 shrink-0">{t('editor.panel_font')}</span>
        <div className="flex gap-1 flex-wrap">
          {Object.keys(FONT_FAMILIES).map((key) => (
            <button
              key={key}
              onClick={() => onUpdate({ fontFamily: key })}
              className={`px-2 py-0.5 rounded text-[9px] border transition-colors
                ${fontFamily === key
                  ? 'bg-[#c8b040] border-[#c8b040] text-black font-bold'
                  : 'bg-transparent border-[#2e2a0a] text-[#8c7a20] hover:border-[#4a4010]'}`}
              style={{ fontFamily: FONT_FAMILIES[key] }}
            >
              {key === 'sans' ? 'Sans' : key === 'serif' ? 'Serif' : key === 'mono' ? 'Mono' : 'Impact'}
            </button>
          ))}
        </div>
      </div>

      {/* Bold + Italic */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#8c7a20] tracking-widest w-14 shrink-0">{t('editor.panel_style')}</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onUpdate({ bold: !bold })}
            className={`w-7 h-7 rounded border text-[11px] font-bold transition-colors
              ${bold ? 'bg-[#c8b040] border-[#c8b040] text-black' : 'bg-transparent border-[#2e2a0a] text-[#8c7a20] hover:border-[#4a4010]'}`}
          >B</button>
          <button
            onClick={() => onUpdate({ italic: !italic })}
            className={`w-7 h-7 rounded border text-[11px] italic transition-colors
              ${italic ? 'bg-[#c8b040] border-[#c8b040] text-black' : 'bg-transparent border-[#2e2a0a] text-[#8c7a20] hover:border-[#4a4010]'}`}
          >I</button>
        </div>
      </div>

      {/* Font size */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#8c7a20] tracking-widest w-14 shrink-0">{t('editor.panel_size')}</span>
        <input
          type="range" min="0.02" max="0.4" step="0.005"
          value={fontSize}
          onChange={(e) => onUpdate({ fontSize: parseFloat(e.target.value) })}
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: '#c8b040' }}
        />
        <span className="text-[9px] text-[#8c7a20] tabular-nums w-8 text-right shrink-0">
          {Math.round(fontSize * 100)}%
        </span>
      </div>

      {/* Color */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#8c7a20] tracking-widest w-14 shrink-0">{t('editor.panel_color')}</span>
        <div className="flex gap-1.5 flex-wrap items-center">
          {TEXT_PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              style={{ background: c, width: 18, height: 18, borderRadius: 3, border: color === c ? '2px solid white' : '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}
              title={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
            title={t('editor.custom_color')}
            style={{ padding: 0 }}
          />
        </div>
      </div>

      {/* Opacity */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[9px] text-[#8c7a20] tracking-widest w-14 shrink-0">{t('editor.panel_opacity')}</span>
        <input
          type="range" min="0.1" max="1" step="0.05"
          value={opacity}
          onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: '#c8b040' }}
        />
        <span className="text-[9px] text-[#8c7a20] tabular-nums w-8 text-right shrink-0">
          {Math.round(opacity * 100)}%
        </span>
      </div>

      {/* Delete */}
      <div className="flex items-center gap-3 pt-3 border-t border-[#1e1a05]">
        <span className="text-[9px] text-[#8c7a20] tracking-widest w-14 shrink-0">{t('editor.panel_layer')}</span>
        <button
          onClick={onDelete}
          className="px-3 py-1 rounded border border-[#2a1a1a] text-[#884040] text-[10px] hover:border-[#3a2020] transition-colors"
        >
          {t('editor.delete')}
        </button>
      </div>

    </div>
  )
}
