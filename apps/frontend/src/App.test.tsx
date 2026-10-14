import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./features/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: undefined,
    isError: true,
    isPending: false,
    isSuccess: false,
  }),
}))

describe('App session error notice', () => {
  it('announces a current-user request failure once in the shared shell', () => {
    render(<App />)

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getAllByText('Une erreur est survenue. Veuillez réessayer.')).toHaveLength(1)
  })
})
