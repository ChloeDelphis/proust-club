import { useId } from 'react'
import type { FormFieldProps } from './FormField.types'
import styles from './FormField.module.css'

export default function FormField({ label, hint, className, 'aria-describedby': describedBy, ...inputProps }: FormFieldProps) {
  const inputId = useId()
  const hintId = `${inputId}-hint`
  // Merged, not overridden: a caller legitimately extending the input (an error-state class, an
  // aria-describedby pointing at a live validation message) shouldn't have that silently dropped
  // just because this component also needs to set its own class/description.
  const mergedClassName = className ? `${styles.input} ${className}` : styles.input
  const mergedDescribedBy = [describedBy, hint ? hintId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      <input {...inputProps} id={inputId} className={mergedClassName} aria-describedby={mergedDescribedBy} />
      {/* A sibling of the label, not nested inside it — text inside a wrapping <label> is folded
          into the input's accessible NAME (always announced on every focus), not its
          DESCRIPTION. aria-describedby above is what actually associates it as a description. */}
      {hint && <span id={hintId} className={styles.hint}>{hint}</span>}
    </div>
  )
}
