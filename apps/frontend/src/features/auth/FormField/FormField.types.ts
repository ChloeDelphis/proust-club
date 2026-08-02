import type { InputHTMLAttributes } from 'react'

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}
