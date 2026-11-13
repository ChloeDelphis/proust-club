import type { KeyboardEvent } from 'react'

export function activateOnEnterOrSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate()
    }
  }
}
