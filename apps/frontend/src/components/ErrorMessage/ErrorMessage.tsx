import styles from './ErrorMessage.module.css'

interface ErrorMessageProps {
  message: string
  title?: string
  detail?: string
  plain?: boolean
}

export default function ErrorMessage({ message, title, detail, plain = false }: ErrorMessageProps) {
  if (title || detail) {
    return (
      <div className={`${styles.root}${plain ? ` ${styles.plain}` : ''}`} role="alert">
        {title && <p className={styles.title}>{title}</p>}
        <p className={styles.message}>{message}</p>
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
    )
  }

  return <p className={styles.root} role="alert">{message}</p>
}
