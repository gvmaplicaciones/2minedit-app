import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const EDITOR_EDIT_PATHS = ['/video-editor/edit', '/en/video-editor/edit']

export default function SessionWarningBar() {
  const { t } = useTranslation()
  const location = useLocation()
  if (!EDITOR_EDIT_PATHS.some(p => location.pathname === p)) return null
  return (
    <div style={{
      width: '100%',
      backgroundColor: '#1a0d05',
      borderBottom: '1px solid #2e1a09',
      padding: '6px 16px',
      textAlign: 'center',
    }}>
      <p style={{ color: '#c4623a', fontSize: 12 }}>{t('editor.session_warning')}</p>
    </div>
  )
}
