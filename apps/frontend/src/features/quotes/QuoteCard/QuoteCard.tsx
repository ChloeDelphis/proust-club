import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { deleteQuote } from '../../../api/quote'
import { useToast } from '../../../components/Toast/useToast'
import type { QuoteCardProps } from './QuoteCard.types'
import styles from './QuoteCard.module.css'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function QuoteCard({ quote }: QuoteCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToast()

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
      <p className={styles.text}>{quote.selectedText}</p>
      <footer className={styles.footer}>
        {quote.tags.length > 0 && (
          <ul className={styles.tags}>
            {quote.tags.map(tag => (
              <li key={tag.id} className={styles.tag}>{tag.name}</li>
            ))}
          </ul>
        )}
        <span className={styles.date}>{dateFormatter.format(new Date(quote.createdAt))}</span>
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
