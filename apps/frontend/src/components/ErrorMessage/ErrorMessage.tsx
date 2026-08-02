import styles from './ErrorMessage.module.css'

interface ErrorMessageProps {
  message: string
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return <p className={styles.root} role="alert">{message}</p>
}
