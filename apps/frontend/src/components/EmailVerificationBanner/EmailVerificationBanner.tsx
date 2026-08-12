import { useCurrentUser } from '../../features/auth/useCurrentUser'
import styles from './EmailVerificationBanner.module.css'

export default function EmailVerificationBanner() {
  const { data: user, isSuccess } = useCurrentUser()

  if (!isSuccess || user.emailVerified) {
    return null
  }

  return (
    <div className={styles.root} role="status">
      Confirmez votre adresse email pour finaliser votre inscription — consultez votre boîte de réception.
    </div>
  )
}
