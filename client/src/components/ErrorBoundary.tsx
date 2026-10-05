import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Evita la pantalla en blanco: si una vista falla, se muestra el error y se puede volver a la ciudad. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Error de interfaz:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Al cambiar de vista se vuelve a intentar renderizar.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="view">
        <section className="card" role="alert">
          <h2>Esta vista tuvo un error</h2>
          <p className="muted">Tu progreso está a salvo en el servidor. Detalle técnico para depurar:</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{this.state.error.message}</pre>
          <button className="btn" onClick={() => this.props.onReset?.()}>Volver a la ciudad</button>{' '}
          <button className="btn ghost" onClick={() => location.reload()}>Recargar</button>
        </section>
      </div>
    );
  }
}
