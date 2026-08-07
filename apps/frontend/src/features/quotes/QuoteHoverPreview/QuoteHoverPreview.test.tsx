import { render, screen } from '@testing-library/react'
import QuoteHoverPreview from './QuoteHoverPreview'

describe('QuoteHoverPreview', () => {
  it('shows the full text when short enough', () => {
    render(<QuoteHoverPreview text="Il y avait déjà bien des années" />)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Il y avait déjà bien des années')
  })

  it('truncates long text with an ellipsis', () => {
    const longText = 'a'.repeat(200)
    render(<QuoteHoverPreview text={longText} />)
    const content = screen.getByRole('tooltip').textContent ?? ''
    expect(content.endsWith('…')).toBe(true)
    expect(content.length).toBeLessThan(longText.length)
  })
})
