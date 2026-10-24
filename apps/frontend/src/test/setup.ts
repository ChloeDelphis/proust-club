import '@testing-library/jest-dom'
import '../i18n'
import { vi } from 'vitest'

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
})
