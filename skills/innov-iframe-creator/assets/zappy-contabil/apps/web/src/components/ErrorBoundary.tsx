import { Component, type ReactNode } from 'react'
import { ErrorAlert } from './ErrorAlert.tsx'

type Props = { onError: (error: Error, clientErrorId: string) => void; children: ReactNode }

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error, crypto.randomUUID())
  }

  render() {
    if (this.state.failed) {
      return (
        <ErrorAlert title="Algo deu errado" error={null} onRetry={() => window.location.reload()} />
      )
    }
    return this.props.children
  }
}
