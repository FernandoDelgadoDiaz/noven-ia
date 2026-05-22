import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full border border-gray-800">
            <p className="text-white font-semibold text-lg mb-2">Algo salió mal.</p>
            <p className="text-gray-400 text-sm mb-6">Tocá para reintentar.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-500 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
