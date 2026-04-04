import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useExport } from '../hooks/useExport'
import AdSlot from './AdSlot'

export function ExportModal({ isOpen, onClose, clips, audioTracks, overlays, texts, ratio }) {
  const { t } = useTranslation()
  const { exportVideo, cancel, status, phase, progress, errorMsg, downloadUrl, reset } = useExport()
  const downloadRef = useRef(null)
  const startedRef  = useRef(false)

  // Start export automatically when modal opens
  useEffect(() => {
    if (!isOpen) {
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    exportVideo({ clips, audioTracks, overlays, texts, ratio })
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-click the download link once the URL is ready
  useEffect(() => {
    if (status === 'done' && downloadUrl && downloadRef.current) {
      downloadRef.current.click()
    }
  }, [status, downloadUrl])

  function handleClose() {
    if (status === 'loading' || status === 'processing') return
    reset()
    onClose()
  }

  function handleCancel() {
    cancel()
    onClose()
  }

  if (!isOpen) return null

  const isRunning = status === 'loading' || status === 'processing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-6 py-6 mx-5 max-w-sm w-full shadow-2xl">

        {/* ── LOADING / PROCESSING ── */}
        {isRunning && (
          <>
            <div className="flex justify-center mb-4">
              {/* Spinner */}
              <svg className="animate-spin" width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="#2a2a2a" strokeWidth="4"/>
                <path d="M20 4 A16 16 0 0 1 36 20" stroke="#e87040" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>

            <p className="text-white text-sm font-semibold text-center mb-1">{t('export.exporting_title')}</p>
            <p className="text-[#666] text-xs text-center mb-4 min-h-[16px]">{phase}</p>

            {/* Progress bar */}
            <div className="w-full bg-[#1f1f1f] rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                className="bg-[#e87040] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-[#444] text-center tabular-nums">{progress}%</p>

            <p className="text-[9px] text-[#333] text-center mt-4 leading-relaxed whitespace-pre-line">
              {t('export.processing_hint')}
            </p>

            <button
              onClick={handleCancel}
              className="mt-4 w-full py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#555] hover:text-[#aaa] hover:border-[#444] transition-colors"
            >
              {t('export.cancel_btn')}
            </button>
          </>
        )}

        {/* ── DONE ── */}
        {status === 'done' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#0a2010] border border-[#2a6a3a] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M4 11l5 5 9-9" stroke="#4aaa6a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <p className="text-white text-sm font-semibold text-center mb-1">{t('export.done_title')}</p>
            <p className="text-[#666] text-xs text-center mb-5">
              {t('export.done_hint')}
            </p>

            {/* Hidden auto-download link */}
            {downloadUrl && (
              <a
                ref={downloadRef}
                href={downloadUrl}
                download="2minclip-export.mp4"
                className="hidden"
                aria-hidden="true"
              />
            )}

            {/* Pre-download ad — solo visible cuando ADS_ENABLED = true */}
            <AdSlot variant="pre-download" />

            {/* Manual download button */}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download="2minclip-export.mp4"
                className="block w-full py-2.5 rounded-lg bg-[#e87040] text-black text-xs font-bold text-center hover:opacity-90 transition-opacity mb-3"
              >
                {t('export.download')}
              </a>
            )}

            <button
              onClick={handleClose}
              className="w-full py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors"
            >
              {t('export.close')}
            </button>
          </>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#2a0808] border border-[#e87040] border-opacity-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L10 11" stroke="#e87040" strokeWidth="2.2" strokeLinecap="round"/>
                  <circle cx="10" cy="15.5" r="1.5" fill="#e87040"/>
                </svg>
              </div>
            </div>

            <p className="text-white text-sm font-semibold text-center mb-2">{t('export.error_title')}</p>
            <p className="text-[#888] text-xs text-center mb-5 leading-relaxed px-1">{errorMsg}</p>

            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors"
              >
                {t('export.close')}
              </button>
              <button
                onClick={() => {
                  reset()
                  startedRef.current = false
                  exportVideo({ clips, audioTracks, overlays, texts, ratio })
                }}
                className="flex-1 py-2 rounded-lg bg-[#e87040] text-black text-xs font-bold hover:opacity-90 transition-opacity"
              >
                {t('export.retry')}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
