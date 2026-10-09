import { useId } from 'react'
import type { FormFieldProps } from './FormField.types'
import styles from './FormField.module.css'

export default function FormField({ label, hint, ...inputProps }: FormFieldProps) {
  const inputId = useId()
  const hintId = `${inputId}-hint`
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      {/* inputProps spread first, id/className/aria-describedby after: FormFieldProps extends
          InputHTMLAttributes, so a caller could otherwise pass id/className/aria-describedby and
          silently detach the label/hint association this component exists to guarantee. */}
      <input {...inputProps} id={inputId} className={styles.input} aria-describedby={hint ? hintId : undefined} />
      {/* A sibling of the label, not nested inside it — text inside a wrapping <label> is folded
          into the input's accessible NAME (always announced on every focus), not its
          DESCRIPTION. aria-describedby above is what actually associates it as a description. */}
      {hint && <span id={hintId} className={styles.hint}>{hint}</span>}
    </div>
  )
}
