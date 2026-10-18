import { Dialog } from '@base-ui/react/dialog'
import { useTranslation } from 'react-i18next'
import TagPickerContent from './TagPickerContent'
import type { TagPickerPopupProps } from './TagPickerPopup.types'
import styles from './TagPickerPopup.module.css'

export default function TagPickerPopup({ onSave, onCancel, isSaving, initialNewListName, errorMessage }: TagPickerPopupProps) {
  const { t } = useTranslation()

  return (
    // While a save is in flight, every dismiss path (Escape, backdrop, ×) is ignored rather than
    // routed to onCancel: the request has already been sent and can't actually be aborted, so
    // "cancelling" here would only desync the UI from a save that's still going to complete —
    // resetting to idle now, then having the response arrive afterwards, either saves a citation
    // the user believes they cancelled (on success) or resurrects the "Sauvegarder" menu out of
    // nowhere for a selection the user already dismissed (on error).
    <Dialog.Root open onOpenChange={open => { if (!open && !isSaving) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} data-testid="tag-picker-backdrop" />
        <Dialog.Popup className={styles.popup} aria-label={t('tagPicker.ariaLabel')}>
          <Dialog.Close className={styles.closeButton} aria-label={t('tagPicker.close')} disabled={isSaving}>×</Dialog.Close>
          <TagPickerContent onSave={onSave} isSaving={isSaving} initialNewListName={initialNewListName} errorMessage={errorMessage} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
