import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { register } from '../../api/auth'
import type { RegisterParams } from '../../api/auth'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
import { apiErrorMessage } from './apiErrorMessage'
import RegisterForm from './RegisterForm/RegisterForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (params: RegisterParams) => register(params),
    onSuccess: user => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      navigate('/')
    },
  })

  // 400 stays out of the status map because it covers several validation failures. The one
  // password-identifier policy error carries a stable machine-readable code, so it can receive an
  // accurate message without guessing from the status or parsing ProblemDetail.detail.
  //
  // 422 is its own status (distinct from the 400s above) specifically so the breach-check failure
  // can get an accurate, non-alarming message here — "found in a data breach" would be scary and
  // confusing to a non-technical user, so this reframes it as commonness instead.
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          409: t('registerPage.identifierTakenError'),
          422: t('auth.passwordCompromisedError'),
        },
        t('registerPage.genericError'),
        { password_matches_identifier: t('passwordIdentifierValidation.matchesIdentifierError') },
      )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('registerPage.title')}</h1>
      <RegisterForm onSubmit={params => mutation.mutate(params)} />
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <p className={styles.switch}>
        {t('registerPage.alreadyAccountPrompt')} <Link to="/login">{t('registerPage.loginLink')}</Link>
      </p>
    </main>
  )
}
