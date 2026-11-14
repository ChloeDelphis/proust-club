import { Dialog } from '@base-ui/react/dialog'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './AuthenticationPrompt.module.css'

interface AuthenticationPromptProps {
  onRegister: () => void
  onLogin: () => void
  onCancel: () => void
  title?: string
  message?: string
  registerLabel?: string
  dimBackground?: boolean
}

export default function AuthenticationPrompt({
  onRegister,
  onLogin,
  onCancel,
  title,
  message,
  registerLabel,
  dimBackground = true,
}: AuthenticationPromptProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const messageId = useId()
  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dimBackground ? styles.backdrop : styles.transparentBackdrop} />
        <Dialog.Popup className={styles.popup} aria-labelledby={titleId} aria-describedby={messageId}>
          <Dialog.Close className={styles.closeButton} aria-label={t('tagPicker.close')}>×</Dialog.Close>
          <div className={styles.copy}>
            <h2 id={titleId} className={styles.title}>
              {title ?? t('quoteSelection.authenticationPromptTitle')}
            </h2>
            <p id={messageId} className={styles.message}>
              {message ?? t('quoteSelection.authenticationPromptMessage')}
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.promptButton} onClick={onRegister}>
              {registerLabel ?? t('quoteSelection.registerButton')}
            </button>
            <button type="button" className={styles.promptButtonSecondary} onClick={onLogin}>
              {t('quoteSelection.loginButton')}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
