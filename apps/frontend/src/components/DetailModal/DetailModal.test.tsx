import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import DetailModal from './DetailModal'
import * as paragraphApi from '../../api/paragraph'

vi.mock('../../api/paragraph')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const baseResponse: paragraphApi.ParagraphContextResponse = {
  paragraphId: 42,
  before: [],
  after: [],
  hasMoreBefore: false,
  hasMoreAfter: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DetailModal', () => {
  it('renders nothing visible when paragraphId is null', () => {
    vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue(baseResponse)
    render(
      <DetailModal paragraphId={null} centerContent="Le texte principal" sideContent="Actions" ariaLabel="Détail" onOpenChange={vi.fn()} />,
      { wrapper },
    )

    expect(screen.queryByText('Le texte principal')).not.toBeInTheDocument()
  })

  it('shows the center and side content once open', async () => {
    vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue(baseResponse)
    render(
      <DetailModal paragraphId={42} centerContent="Le texte principal" sideContent="Actions" ariaLabel="Détail" onOpenChange={vi.fn()} />,
      { wrapper },
    )

    expect(screen.getByText('Le texte principal')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('disables both context arrows when there is nothing more in either direction', async () => {
    vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue(baseResponse)
    render(
      <DetailModal paragraphId={42} centerContent="Texte" sideContent="Actions" ariaLabel="Détail" onOpenChange={vi.fn()} />,
      { wrapper },
    )

    expect(await screen.findByRole('button', { name: 'Afficher le paragraphe précédent' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Afficher le paragraphe suivant' })).toBeDisabled()
  })

  it('shows fetched context paragraphs and keeps the arrow enabled while more exist', async () => {
    vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue({
      ...baseResponse,
      after: [{ paragraphId: 43, text: 'Paragraphe suivant', pageNumber: 10 }],
      hasMoreAfter: true,
    })
    render(
      <DetailModal paragraphId={42} centerContent="Texte" sideContent="Actions" ariaLabel="Détail" onOpenChange={vi.fn()} />,
      { wrapper },
    )

    expect(await screen.findByText('Paragraphe suivant')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Afficher le paragraphe suivant' })).not.toBeDisabled()
  })

  it('clicking the after arrow requests one more paragraph of context', async () => {
    vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue({
      ...baseResponse,
      after: [{ paragraphId: 43, text: 'Paragraphe suivant', pageNumber: 10 }],
      hasMoreAfter: true,
    })
    const user = userEvent.setup()
    render(
      <DetailModal paragraphId={42} centerContent="Texte" sideContent="Actions" ariaLabel="Détail" onOpenChange={vi.fn()} />,
      { wrapper },
    )

    await user.click(await screen.findByRole('button', { name: 'Afficher le paragraphe suivant' }))

    expect(paragraphApi.getParagraphContext).toHaveBeenLastCalledWith(42, { before: 0, after: 1 }, expect.anything())
  })

  it('resets the context window when a different paragraph opens', async () => {
    vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue({
      ...baseResponse,
      after: [{ paragraphId: 43, text: 'Paragraphe suivant', pageNumber: 10 }],
      hasMoreAfter: true,
    })
    const user = userEvent.setup()
    const { rerender } = render(
      <DetailModal paragraphId={42} centerContent="Texte 1" sideContent="Actions" ariaLabel="Détail" onOpenChange={vi.fn()} />,
      { wrapper },
    )
    await user.click(await screen.findByRole('button', { name: 'Afficher le paragraphe suivant' }))

    rerender(<DetailModal paragraphId={99} centerContent="Texte 2" sideContent="Actions" ariaLabel="Détail" onOpenChange={vi.fn()} />)

    expect(paragraphApi.getParagraphContext).toHaveBeenLastCalledWith(99, { before: 0, after: 0 }, expect.anything())
  })

  it('calls onOpenChange when the close button is pressed', async () => {
    vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue(baseResponse)
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DetailModal paragraphId={42} centerContent="Texte" sideContent="Actions" ariaLabel="Détail" onOpenChange={onOpenChange} />,
      { wrapper },
    )

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })
})
