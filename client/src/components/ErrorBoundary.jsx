import { Component } from 'react';
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="container page-section"><h1>Something went wrong.</h1><p>Please reload the page to try again.</p><button className="button button-primary" onClick={() => window.location.reload()}>Reload page</button></main>;
    return this.props.children;
  }
}
