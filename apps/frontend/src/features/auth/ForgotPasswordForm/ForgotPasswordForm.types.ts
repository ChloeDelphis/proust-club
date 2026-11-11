export interface ForgotPasswordFormProps {
  onSubmit: (params: { email: string }) => void
  isSubmitting?: boolean
}
