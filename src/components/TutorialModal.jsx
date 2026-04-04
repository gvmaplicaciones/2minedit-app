import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const SLIDE_ICONS = [
  // 1: Welcome — play triangle in circle
  <svg key="s1" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="13" stroke="#e87040" strokeWidth="2"/>
    <polygon points="13,10 13,22 24,16" fill="#e87040"/>
  </svg>,
  // 2: Upload clips — arrow up with baseline
  <svg key="s2" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 22V10M10 16l6-6 6 6" stroke="#e87040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="6" y="24" width="20" height="2.5" rx="1.25" fill="#e87040"/>
  </svg>,
  // 3: Timeline zoom — magnifying glass with + inside
  <svg key="s3" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="14" cy="14" r="8" stroke="#e87040" strokeWidth="2"/>
    <path d="M20.5 20.5l5 5" stroke="#e87040" strokeWidth="2" strokeLinecap="round"/>
    <path d="M11 14h6M14 11v6" stroke="#e87040" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>,
  // 4: Edit clips — scissors
  <svg key="s4" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="10" cy="10" r="3.5" stroke="#e87040" strokeWidth="2"/>
    <circle cx="10" cy="22" r="3.5" stroke="#e87040" strokeWidth="2"/>
    <path d="M13.2 10.8L26 17M13.2 21.2L26 15" stroke="#e87040" strokeWidth="2" strokeLinecap="round"/>
  </svg>,
  // 5: Layers — three stacked rectangles
  <svg key="s5" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="19" width="22" height="6" rx="1.5" stroke="#e87040" strokeWidth="2"/>
    <rect x="5" y="12" width="22" height="6" rx="1.5" stroke="#e87040" strokeWidth="2"/>
    <rect x="5" y="5"  width="22" height="6" rx="1.5" stroke="#e87040" strokeWidth="2"/>
  </svg>,
  // 6: Export — download arrow with baseline
  <svg key="s6" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 6v16M10 16l6 6 6-6" stroke="#e87040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="6" y="24" width="20" height="2.5" rx="1.25" fill="#e87040"/>
  </svg>,
]

export function TutorialModal({ isOpen, onClose }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)

  const total = SLIDE_ICONS.length
  const isFirst = current === 0
  const isLast  = current === total - 1

  function handleClose() {
    setCurrent(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
      onClick={handleClose}
    >
      <div
        className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-6 py-6 mx-5 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Slide icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[#1f0e05] border border-[#e87040] border-opacity-30 flex items-center justify-center">
            {SLIDE_ICONS[current]}
          </div>
        </div>

        {/* Slide title */}
        <p className="text-white text-sm font-semibold text-center mb-2">
          {t(`tutorial.s${current + 1}_title`)}
        </p>

        {/* Slide body */}
        <p className="text-[#888] text-xs text-center leading-relaxed mb-5 px-1" style={{ minHeight: 52 }}>
          {t(`tutorial.s${current + 1}_body`)}
        </p>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 mb-3">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current
                  ? 'w-4 h-1.5 bg-[#e87040]'
                  : 'w-1.5 h-1.5 bg-[#333] hover:bg-[#555]'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Counter */}
        <p className="text-[10px] text-[#333] text-center tabular-nums mb-4">
          {current + 1} {t('tutorial.of')} {total}
        </p>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          {isFirst ? (
            <button
              onClick={handleClose}
              className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors"
            >
              {t('tutorial.skip')}
            </button>
          ) : (
            <button
              onClick={() => setCurrent((c) => c - 1)}
              className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors"
            >
              {t('tutorial.prev')}
            </button>
          )}

          {isLast ? (
            <button
              onClick={handleClose}
              className="flex-1 py-2 rounded-lg bg-[#e87040] text-black text-xs font-bold hover:opacity-90 transition-opacity"
            >
              {t('tutorial.done')}
            </button>
          ) : (
            <button
              onClick={() => setCurrent((c) => c + 1)}
              className="flex-1 py-2 rounded-lg bg-[#e87040] text-black text-xs font-bold hover:opacity-90 transition-opacity"
            >
              {t('tutorial.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
