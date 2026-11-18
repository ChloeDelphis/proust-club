import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { deleteQuote } from '../../../api/quote'
import { useToast } from '../../../components/Toast/useToast'
import type { QuoteCardProps } from './QuoteCard.types'
import styles from './QuoteCard.module.css'

export default function QuoteCard({ quote, onOpenDetail }: QuoteCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToast()
  const locationLabel = t('searchPage.resultLocation', { volume: quote.location.volume, part: quote.location.part })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => {
      showToast(t('quoteCard.deleteErrorToast'))
    },
  })

  function handleDelete() {
    if (!window.confirm(t('quoteCard.deleteConfirm'))) return
    deleteMutation.mutate(quote.id)
  }

  return (
    <article className={styles.root}>
      <header className={styles.header}>
        <span className={styles.location}>{locationLabel}</span>
      </header>
      <button type="button" className={styles.text} onClick={() => onOpenDetail(quote)}>{quote.selectedText}</button>
      <footer className={styles.footer}>
        {quote.tags.length > 0 && (
          <ul className={styles.tags}>
            {quote.tags.map(tag => (
              <li key={tag.id} className={styles.tag}>{tag.name}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={styles.deleteButton}
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {t('quoteCard.deleteButton')}
        </button>
      </footer>
    </article>
  )
}
