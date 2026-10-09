import { useId } from 'react'
import type { FormFieldProps } from './FormField.types'
import styles from './FormField.module.css'

export default function FormField({ label, hint, 'aria-describedby': describedBy, ...inputProps }: FormFieldProps) {
  const inputId = useId()
  const hintId = `${inputId}-hint`
  // Merged, not overridden — but only for aria-describedby: this diff is what makes FormField
  // start setting it (for the hint), so a caller already passing their own would otherwise be
  // silently clobbered by a risk this same change introduces. className has no such new risk
  // (FormField has always set it unconditionally) and no caller needs to extend it today — YAGNI
  // until one does, rather than merging preemptively.
  const mergedDescribedBy = [describedBy, hint ? hintId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      <input {...inputProps} id={inputId} className={styles.input} aria-describedby={mergedDescribedBy} />
      {/* A sibling of the label, not nested inside it — text inside a wrapping <label> is folded
          into the input's accessible NAME (always announced on every focus), not its
          DESCRIPTION. aria-describedby above is what actually associates it as a description. */}
      {hint && <span id={hintId} className={styles.hint}>{hint}</span>}
    </div>
  )
}
