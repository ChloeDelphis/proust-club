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

  it('exposes its active state visually and through aria-pressed', () => {
    const { rerender } = render(<FilterButton active={false} onClick={vi.fn()}>Tous</FilterButton>)
    const button = screen.getByRole('button', { name: 'Tous' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.className).not.toMatch(/isActive/)

    rerender(<FilterButton active onClick={vi.fn()}>Tous</FilterButton>)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.className).toMatch(/isActive/)
  })

  it('defaults to the pill variant, and switches shape with variant="list"', () => {
    const { rerender } = render(<FilterButton active={false} onClick={vi.fn()}>Tous</FilterButton>)
    expect(screen.getByRole('button', { name: 'Tous' }).className).toMatch(/pill/)

    rerender(<FilterButton active={false} variant="list" onClick={vi.fn()}>Tous</FilterButton>)
    expect(screen.getByRole('button', { name: 'Tous' }).className).toMatch(/list/)
  })
})
