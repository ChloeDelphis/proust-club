import { useTranslation } from 'react-i18next'
import styles from './Spinner.module.css'

export default function Spinner() {
  const { t } = useTranslation()
  return <div className={styles.root} role="status" aria-label={t('components.spinner.loadingLabel')} />
}
