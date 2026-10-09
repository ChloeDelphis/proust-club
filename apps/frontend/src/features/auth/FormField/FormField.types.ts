import type { InputHTMLAttributes } from 'react'

// `id` excluded, not just overridden at runtime: FormField always owns the label/input
// association itself (generated via useId), so there's no legitimate caller-supplied id — this
// way a mistaken attempt is a compile error instead of a silently discarded prop.
export interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
}
