import { render, screen, act } from '@testing-library/react'
import ToastProvider from './ToastProvider'
import { useToast } from './useToast'

function TriggerButton({ message }: { message: string }) {
  const showToast = useToast()
  return (
    <button type="button" onClick={() => showToast(message)}>
      trigger
    </button>
  )
}

describe('ToastProvider / useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a toast when showToast is called', async () => {
    render(
      <ToastProvider>
        <TriggerButton message="Citation enregistrée" />
      </ToastProvider>,
    )

    await act(async () => {
      screen.getByText('trigger').click()
    })

    expect(screen.getByRole('status')).toHaveTextContent('Citation enregistrée')
  })

  it('dismisses the toast automatically after the display duration', async () => {
    render(
      <ToastProvider>
        <TriggerButton message="Citation enregistrée" />
      </ToastProvider>,
    )

    await act(async () => {
      screen.getByText('trigger').click()
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stacks multiple toasts independently', async () => {
    render(
      <ToastProvider>
        <TriggerButton message="Première" />
      </ToastProvider>,
    )

    await act(async () => {
      screen.getByText('trigger').click()
      screen.getByText('trigger').click()
    })

    expect(screen.getAllByRole('status')).toHaveLength(2)
  })
})

describe('useToast outside a provider', () => {
  it('throws a clear error', () => {
    function Broken() {
      useToast()
      return null
    }

    expect(() => render(<Broken />)).toThrow('useToast must be used within a ToastProvider')
  })
})
