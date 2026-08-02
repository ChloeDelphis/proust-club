import styles from './EmptyState.module.css'

interface EmptyStateProps {
  message: string
}

export default function EmptyState({ message }: EmptyStateProps) {
  return <p className={styles.root}>{message}</p>
}
