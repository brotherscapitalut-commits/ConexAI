// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("🚨 NEXUS CRITICAL ERROR:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0a0a0a] p-6 text-white font-mono">
          <div className="max-w-md w-full space-y-6 text-center border border-red-500/30 bg-red-500/5 p-8 rounded-2xl backdrop-blur-xl">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-black uppercase tracking-tighter text-red-500">Sistema Interrompido</h1>
              <p className="text-white/40 text-xs leading-relaxed">
                Um erro crítico impediu o carregamento deste módulo. 
                O Nexus Pulse foi isolado para evitar corrupção de dados.
              </p>
            </div>

            <div className="p-4 bg-black/40 rounded-lg border border-white/5 text-left overflow-auto max-h-32">
              <code className="text-[10px] text-red-400/80">
                {this.state.error?.message || "Unknown Runtime Exception"}
              </code>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => window.location.reload()}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                REINICIALIZAR NEXUS
              </Button>
              <Button 
                variant="ghost"
                onClick={() => window.location.href = "/"}
                className="w-full text-white/40 hover:text-white"
              >
                <Home className="w-4 h-4 mr-2" />
                VOLTAR AO INÍCIO
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
