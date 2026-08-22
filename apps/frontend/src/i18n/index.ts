import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from '../locales/fr.json'

// No backend/detector plugin — resources are passed inline below, so init() completes
// synchronously. Any module that imports this file (directly or transitively) can safely call
// i18n.t(...) as soon as its own top-level code runs, including at module scope. If a backend or
// language-detector plugin is ever added (see activation-multilingue ticket), that guarantee goes
// away and eager module-scope calls to t() would need to move inside a function body instead.
i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false, // React already escapes rendered values
  },
})

export default i18next
