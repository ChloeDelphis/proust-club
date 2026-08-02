import styles from './Spinner.module.css'

export default function Spinner() {
  return <div className={styles.root} role="status" aria-label="Chargement" />
}
