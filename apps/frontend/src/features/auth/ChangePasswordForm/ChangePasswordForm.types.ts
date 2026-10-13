export interface ChangePasswordFormProps {
  username: string
  email: string
  onSubmit: (params: { currentPassword: string; newPassword: string }) => void
}
