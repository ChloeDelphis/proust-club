export interface ChangePasswordFormProps {
  username: string | null
  email: string
  isSubmitting: boolean
  isAccountForm?: boolean
  onCancel: () => void
  onSubmit: (params: { currentPassword: string; newPassword: string }) => void
}
