export interface RegisterFormProps {
  onSubmit: (params: { username: string; email: string; password: string }) => void
}
