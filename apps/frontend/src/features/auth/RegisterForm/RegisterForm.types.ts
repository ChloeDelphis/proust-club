import type { RegisterParams } from '../../../api/auth'

export interface RegisterFormProps {
  onSubmit: (params: RegisterParams) => void
}
