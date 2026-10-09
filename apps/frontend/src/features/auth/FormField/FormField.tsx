import { useId } from 'react'
import type { FormFieldProps } from './FormField.types'
import styles from './FormField.module.css'

export default function FormField({ label, hint, ...inputProps }: FormFieldProps) {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      <input id={inputId} className={styles.input} aria-describedby={hint ? hintId : undefined} {...inputProps} />
      {/* A sibling of the label, not nested inside it — text inside a wrapping <label> is folded
          into the input's accessible NAME (always announced on every focus), not its
          DESCRIPTION. aria-describedby above is what actually associates it as a description. */}
      {hint && <span id={hintId} className={styles.hint}>{hint}</span>}
    </div>
  )
}
