import { useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormFieldProps } from './FormField.types'
import styles from './FormField.module.css'

export default function FormField({ label, hint, hintStatus, isAccountField = false, 'aria-describedby': describedBy, ...inputProps }: FormFieldProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isPasswordField = inputProps.type === 'password'
  const hintStatusClass = hintStatus === 'success'
    ? styles.hintStatusSuccess
    : hintStatus === 'invalid'
      ? styles.hintStatusInvalid
      : styles.hintStatusIdle
  // Merged, not overridden — but only for aria-describedby: this diff is what makes FormField
  // start setting it (for the hint), so a caller already passing their own would otherwise be
  // silently clobbered by a risk this same change introduces. className has no such new risk
  // (FormField has always set it unconditionally) and no caller needs to extend it today — YAGNI
  // until one does, rather than merging preemptively.
  const mergedDescribedBy = [describedBy, hint ? hintId : undefined].filter(Boolean).join(' ') || undefined
  const input = (
    <input
      {...inputProps}
      id={inputId}
      type={isPasswordField && isPasswordVisible ? 'text' : inputProps.type}
      className={`${styles.input}${isPasswordField ? ` ${styles.passwordInput}` : ''}`}
      aria-describedby={mergedDescribedBy}
    />
  )

  return (
    <div className={`${styles.field}${isAccountField ? ` ${styles.accountField}` : ''}`}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      {isPasswordField ? (
        <div className={styles.passwordControl}>
          {input}
          <button
            className={styles.visibilityToggle}
            type="button"
            aria-label={t(isPasswordVisible ? 'formField.hidePassword' : 'formField.showPassword')}
            onClick={() => setIsPasswordVisible(visible => !visible)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {isPasswordVisible && <path d="m3 3 18 18" />}
            </svg>
          </button>
        </div>
      ) : input}
      {/* A sibling of the label, not nested inside it — text inside a wrapping <label> is folded
          into the input's accessible NAME (always announced on every focus), not its
          DESCRIPTION. aria-describedby above is what actually associates it as a description. */}
      {hint && (
        <span
          id={hintId}
          className={`${styles.hint}${hintStatus ? ` ${styles.hintWithStatus}` : ''}`}
        >
          <span className={styles.hintText}>{hint}</span>
          {hintStatus && (
            <>
              <svg className={`${styles.hintStatusIcon} ${hintStatusClass}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                {hintStatus === 'success'
                  ? <path d="m3 8 3.2 3.2L13 4.8" />
                  : <path d="m4 4 8 8M12 4l-8 8" />}
              </svg>
              <span className={styles.visuallyHidden} aria-live="polite">
                {hintStatus === 'idle'
                  ? ''
                  : t(hintStatus === 'success'
                    ? 'passwordValidation.lengthSatisfied'
                    : 'passwordValidation.lengthInsufficient')}
              </span>
            </>
          )}
        </span>
      )}
    </div>
  )
}
