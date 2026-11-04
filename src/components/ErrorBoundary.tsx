import { Component, type ReactNode } from 'react'
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <main className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="my-4">
          Reload the page to try again. Your saved plans are still in your account.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload page
        </button>
      </main>
    ) : (
      this.props.children
    )
  }
}
