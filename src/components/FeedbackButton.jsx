import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const FORMSPREE_URL = 'https://formspree.io/f/mykbwewd'

export default function FeedbackButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | success
  const textareaRef = useRef(null)

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        setOpen(false)
        setStatus('idle')
        setMessage('')
        setType('bug')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [status])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('sending')
    try {
      await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tipo: type, mensaje: message }),
      })
      setStatus('success')
    } catch {
      setStatus('idle')
    }
  }

  const types = [
    { value: 'bug',  label: t('editor.feedback_type_bug') },
    { value: 'idea', label: t('editor.feedback_type_idea') },
    { value: 'other',label: t('editor.feedback_type_other') },
  ]

  return (
    <>
      {/* Botón fijo esquina superior derecha, bajo la nav */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-14 right-3 z-40 text-[10px] text-[#555] bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1 hover:border-[#444] transition-colors"
      >
        {t('editor.feedback_btn')}
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
          onClick={() => { if (status !== 'sending') setOpen(false) }}
        >
          <div
            className="relative bg-[#111] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cerrar */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-[#555] hover:text-[#999] transition-colors text-lg leading-none"
              aria-label="Cerrar"
              disabled={status === 'sending'}
            >
              ×
            </button>

            {status === 'success' ? (
              <p className="text-sm text-white text-center py-6">{t('editor.feedback_success')}</p>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="text-sm font-semibold text-white mb-4">
                  {t('editor.feedback_title')}
                </h2>

                {/* Selector de tipo */}
                <div className="flex gap-2 mb-4">
                  {types.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      className={`flex-1 text-[10px] rounded-md px-2 py-1.5 border transition-colors leading-tight ${
                        type === value
                          ? 'bg-[#e87040] border-[#e87040] text-white font-medium'
                          : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666] hover:border-[#444]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Texto libre */}
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('editor.feedback_placeholder')}
                  rows={4}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] resize-none focus:outline-none focus:border-[#444] mb-4"
                />

                {/* Botón enviar */}
                <button
                  type="submit"
                  disabled={!message.trim() || status === 'sending'}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? t('editor.feedback_sending') : t('editor.feedback_send')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
