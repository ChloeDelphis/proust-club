export interface ChangePasswordFormProps {
  onSubmit: (params: { currentPassword: string; newPassword: string }) => void
}
