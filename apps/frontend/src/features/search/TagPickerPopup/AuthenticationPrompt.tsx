import { Dialog } from '@base-ui/react/dialog'
import { useTranslation } from 'react-i18next'
import styles from './TagPickerPopup.module.css'

interface AuthenticationPromptProps {
  onRegister: () => void
  onLogin: () => void
  onCancel: () => void
}

export default function AuthenticationPrompt({ onRegister, onLogin, onCancel }: AuthenticationPromptProps) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} aria-label={t('quoteSelection.authenticationPromptTitle')}>
          <Dialog.Close className={styles.closeButton} aria-label={t('tagPicker.close')}>×</Dialog.Close>
          <h2>{t('quoteSelection.authenticationPromptTitle')}</h2>
          <p>{t('quoteSelection.authenticationPromptMessage')}</p>
          <button type="button" className={styles.promptButton} onClick={onRegister}>
            {t('quoteSelection.registerButton')}
          </button>
          <button type="button" className={styles.promptButtonSecondary} onClick={onLogin}>
            {t('quoteSelection.loginButton')}
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
