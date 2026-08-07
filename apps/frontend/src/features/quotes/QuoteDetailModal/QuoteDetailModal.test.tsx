import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuoteDetailModal from './QuoteDetailModal'
import type { TimelineQuote } from '../../../api/quote'

const quote: TimelineQuote = {
  id: 1,
  paragraphId: 45,
  pageNumber: 9,
  volumeId: 1,
  selectedText: 'Il y avait déjà bien des années',
  tags: [{ id: 1, name: 'Combray' }],
  createdAt: '2026-08-07T11:09:15.787282Z',
}

describe('QuoteDetailModal', () => {
  it('renders nothing visible when there is no open quote', () => {
    render(<QuoteDetailModal quote={null} volumeTitle={undefined} onClose={vi.fn()} />)
    expect(screen.queryByText(quote.selectedText)).not.toBeInTheDocument()
  })

  it('shows the full quote, tags and volume/page metadata when a quote is open', () => {
    render(<QuoteDetailModal quote={quote} volumeTitle="Du Côté de Chez Swann" onClose={vi.fn()} />)

    expect(screen.getByText(quote.selectedText)).toBeInTheDocument()
    expect(screen.getByText('Combray')).toBeInTheDocument()
    expect(screen.getByText(/Du Côté de Chez Swann — page 9/)).toBeInTheDocument()
  })

  it('does not show any delete or tag-management action (read-only)', () => {
    render(<QuoteDetailModal quote={quote} volumeTitle="Du Côté de Chez Swann" onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
