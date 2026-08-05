import { useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useClickOutside } from './useClickOutside'

function TestBox({ onClickOutside }: { onClickOutside: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClickOutside)
  return (
    <>
      <div ref={ref} data-testid="inside">inside</div>
      <button type="button">outside</button>
    </>
  )
}

describe('useClickOutside', () => {
  it('calls the handler when clicking outside the ref', () => {
    const onClickOutside = vi.fn()
    render(<TestBox onClickOutside={onClickOutside} />)

    fireEvent.mouseDown(screen.getByText('outside'))

    expect(onClickOutside).toHaveBeenCalledTimes(1)
  })

  it('does not call the handler when clicking inside the ref', () => {
    const onClickOutside = vi.fn()
    render(<TestBox onClickOutside={onClickOutside} />)

    fireEvent.mouseDown(screen.getByTestId('inside'))

    expect(onClickOutside).not.toHaveBeenCalled()
  })
})
