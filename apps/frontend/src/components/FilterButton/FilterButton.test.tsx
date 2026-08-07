import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterButton from './FilterButton'

describe('FilterButton', () => {
  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<FilterButton active={false} onClick={onClick}>Tous</FilterButton>)

    await user.click(screen.getByRole('button', { name: 'Tous' }))

    expect(onClick).toHaveBeenCalled()
  })

  it('reflects the active state in its accessible pressed styling class', () => {
    const { rerender } = render(<FilterButton active={false} onClick={vi.fn()}>Tous</FilterButton>)
    expect(screen.getByRole('button', { name: 'Tous' }).className).not.toMatch(/isActive/)

    rerender(<FilterButton active onClick={vi.fn()}>Tous</FilterButton>)
    expect(screen.getByRole('button', { name: 'Tous' }).className).toMatch(/isActive/)
  })
})
