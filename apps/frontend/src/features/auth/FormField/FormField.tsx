import type { FormFieldProps } from './FormField.types'
import styles from './FormField.module.css'

export default function FormField({ label, ...inputProps }: FormFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} {...inputProps} />
    </label>
  )
}
