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

  // 400 is deliberately left out of the map: several distinct backend validation failures share
  // that status (blank/invalid fields, password too short, password matching the identifier), and
  // the frontend never reads the ProblemDetail body — only the status — so a specific message here
  // would risk misdiagnosing the real cause. RegisterForm's own client-side checks already cover
  // the common cases with an accurate message before any request is sent.
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
