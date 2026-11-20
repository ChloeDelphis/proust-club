import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { getAdminDashboard, updateAdminNotifications } from '../../api/admin'
import type { AdminNotificationPreferences } from '../../api/admin'
import { logout } from '../../api/auth'
import { useCurrentUser } from '../auth/useCurrentUser'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AdminDashboardPage.module.css'

const DASHBOARD_QUERY_KEY = ['admin', 'dashboard']

export default function AdminDashboardPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const userQuery = useCurrentUser()
  const dashboardQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: ({ signal }) => getAdminDashboard(signal),
    enabled: userQuery.data?.role === 'ADMIN',
    retry: false,
  })
  const updateMutation = useMutation({
    mutationFn: (preferences: AdminNotificationPreferences) => updateAdminNotifications(preferences),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY }),
  })
  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => { queryClient.clear(); window.location.assign('/admin/login') },
  })

  if (userQuery.isPending) return <main className={styles.loading}>{t('adminDashboard.loading')}</main>
  if (!userQuery.data || userQuery.data.role !== 'ADMIN') return <Navigate to="/admin/login" replace />
  if (dashboardQuery.isPending) return <main className={styles.loading}>{t('adminDashboard.loading')}</main>
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <main className={styles.root}><ErrorMessage message={t('adminDashboard.loadError')} /></main>
  }

  const dashboard = dashboardQuery.data
  const preferences = dashboard.notifications
  const metricRows = [...dashboard.dailyMetrics].reverse()

  function savePreferences(next: AdminNotificationPreferences) {
    updateMutation.mutate(next)
  }

  return (
    <main className={styles.root}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>{t('adminDashboard.eyebrow')}</p>
          <h1 className={styles.title}>{t('adminDashboard.title')}</h1>
        </div>
        <button className={styles.logout} type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
          {t('adminDashboard.logout')}
        </button>
      </header>

      <section className={styles.stats} aria-label={t('adminDashboard.statsLabel')}>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>{t('adminDashboard.registeredUsers')}</span>
          <strong>{dashboard.registeredUsers.toLocaleString()}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>{t('adminDashboard.savedQuotes')}</span>
          <strong>{dashboard.savedQuotes.toLocaleString()}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>{t('adminDashboard.tags')}</span>
          <strong>{dashboard.tags.toLocaleString()}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>{t('adminDashboard.activityTitle')}</h2>
            <p>{t('adminDashboard.activityRange', {
              start: new Date(`${dashboard.rangeStart}T00:00:00`).toLocaleDateString(),
              end: new Date(`${dashboard.rangeEnd}T00:00:00`).toLocaleDateString(),
            })}</p>
          </div>
        </div>
        {metricRows.length === 0 ? <p className={styles.empty}>{t('adminDashboard.noActivity')}</p> : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>{t('adminDashboard.dateColumn')}</th><th>{t('adminDashboard.registrationsColumn')}</th><th>{t('adminDashboard.deletionsColumn')}</th></tr></thead>
              <tbody>{metricRows.map(metric => (
                <tr key={metric.date}>
                  <th scope="row">{new Date(`${metric.date}T00:00:00`).toLocaleDateString()}</th>
                  <td>{metric.registrations.toLocaleString()}</td>
                  <td>{metric.deletions.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>{t('adminDashboard.notificationsTitle')}</h2>
            <p>{t('adminDashboard.notificationsDescription')}</p>
          </div>
        </div>
        <div className={styles.preferences}>
          <label><input type="checkbox" checked={preferences.registrationsEnabled} disabled={updateMutation.isPending}
            onChange={event => savePreferences({ ...dashboard.notifications, registrationsEnabled: event.target.checked })} />
            <span>{t('adminDashboard.registrationNotifications')}</span></label>
          <label><input type="checkbox" checked={preferences.deletionsEnabled} disabled={updateMutation.isPending}
            onChange={event => savePreferences({ ...dashboard.notifications, deletionsEnabled: event.target.checked })} />
            <span>{t('adminDashboard.deletionNotifications')}</span></label>
        </div>
        {updateMutation.isError && <ErrorMessage message={t('adminDashboard.saveError')} />}
      </section>
    </main>
  )
}
