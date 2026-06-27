import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-6 text-center animate-fade-in">
            {/* Error Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mx-auto">
              <AlertTriangle className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-950">Une erreur est survenue</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                L'application a rencontré un problème inattendu lors de l'affichage de cette page.
              </p>
            </div>

            {/* Error Details Accordion */}
            {this.state.error && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left font-mono text-xs text-rose-600 break-all max-h-40 overflow-y-auto leading-relaxed select-all">
                <span className="font-bold block uppercase tracking-wider text-slate-400 text-[10px] mb-1">Détail de l'erreur</span>
                {this.state.error.toString()}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-all active:scale-98 cursor-pointer text-sm shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
              <button
                onClick={() => { window.location.reload(); }}
                className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all active:scale-98 cursor-pointer text-sm"
              >
                <Home className="w-4 h-4" />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
