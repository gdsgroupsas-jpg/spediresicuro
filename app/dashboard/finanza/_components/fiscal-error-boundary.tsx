'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class FiscalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Fiscal Control Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-900 text-white p-10 flex items-center justify-center">
          <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-red-500/30">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-red-500/10 p-3 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Errore di Sistema</h2>
                <p className="text-slate-400 text-sm mt-1">Finance Control Room</p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
              <p className="text-slate-300 leading-relaxed">
                Si è verificato un errore durante il caricamento dei dati fiscali. Riprova più tardi
                o contatta il supporto tecnico.
              </p>
              {this.state.error && (
                <details className="mt-4">
                  <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
                    Dettagli tecnici
                  </summary>
                  <pre className="text-xs text-red-400 mt-2 overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Ricarica Pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
