import { Component } from 'react';

/*
 * Last line of defence: if any screen throws (an unusual data shape from a
 * real recording, a bad transcript, anything unforeseen), the user must never
 * be left staring at an unresponsive dark screen with no way forward. This
 * shows what happened and gives a way to continue instead of freezing silently.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0A0A0B', color: '#EDEDEF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <p style={{ letterSpacing: 2, fontSize: 11, color: '#C6A15B', textTransform: 'uppercase', marginBottom: 14 }}>Something went sideways</p>
            <p style={{ color: '#a0a0a0', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              ORATOR hit an unexpected snag rendering this screen. Your progress is saved.
            </p>
            <button
              type="button"
              onClick={() => { window.location.hash = '#/home'; window.location.reload(); }}
              style={{ background: '#C6A15B', color: '#0A0A0B', border: 'none', padding: '12px 26px', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Continue to home
            </button>
            <p style={{ color: '#555', fontSize: 10.5, marginTop: 22, fontFamily: 'monospace' }}>{String(this.state.error?.message || this.state.error)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
