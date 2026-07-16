import { Component, type ReactNode } from 'react'

/**
 * Catches render/use() failures (e.g. a deleted or corrupt bundle on the
 * replay screen) and shows the fallback instead of a white window. Wraps
 * Suspense bodies that read hostile disk data.
 */
export class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
