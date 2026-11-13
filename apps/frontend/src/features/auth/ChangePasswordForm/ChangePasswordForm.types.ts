export interface ChangePasswordFormProps {
  username: string | null
  email: string
  onSubmit: (params: { currentPassword: string; newPassword: string }) => void
}
