import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Navbar } from './components/Navbar';
import { LegalBanner } from './components/LegalBanner';
import { GroupSelector } from './components/GroupSelector';
import { ParticipantArea } from './components/ParticipantArea';
import { DrawResults } from './components/DrawResults';
import { AdminDashboard } from './components/AdminDashboard';
import { ComplianceView } from './components/ComplianceView';
import { Group, SystemConfig } from './types';
import { api } from './services/api';
import { RefreshCw, Layers, ShieldCheck, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto my-12 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-extrabold text-white">Ocorreu um erro ao carregar esta seção</h3>
          <p className="text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-xl border border-slate-800 break-all text-left">
            {this.state.error?.message || 'Erro inesperado na renderização.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recarregar Página</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const getInitialTab = (): 'groups' | 'my-numbers' | 'draws' | 'admin' | 'compliance' => {
    if (typeof window === 'undefined') return 'groups';
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase().replace('#', '');
    
    if (path.includes('/admin') || path.includes('/dashboard') || path.includes('/administrativo') || hash === 'admin' || hash === 'dashboard') {
      return 'admin';
    }
    if (path.includes('/my-numbers') || path.includes('/meus-numeros') || path.includes('/participante') || hash === 'my-numbers' || hash === 'meus-numeros') {
      return 'my-numbers';
    }
    if (path.includes('/draws') || path.includes('/sorteios') || hash === 'draws' || hash === 'sorteios') {
      return 'draws';
    }
    if (path.includes('/compliance') || path.includes('/legal') || hash === 'compliance' || hash === 'legal') {
      return 'compliance';
    }
    return 'groups';
  };

  const [activeTab, setActiveTabState] = useState<'groups' | 'my-numbers' | 'draws' | 'admin' | 'compliance'>(getInitialTab);

  const setActiveTab = (tab: 'groups' | 'my-numbers' | 'draws' | 'admin' | 'compliance') => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const targetHash = tab === 'groups' ? '' : `#${tab}`;
      const newUrl = `${window.location.pathname}${targetHash}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', newUrl || window.location.pathname);
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);
  const [groups, setGroups] = useState<Group[]>([]);
  const [config, setConfig] = useState<Partial<SystemConfig>>({
    entryPriceCents: 100,
    promotionLegalStatus: 'PENDING_REVIEW',
    legalProcessNumber: 'SPA/MF nº 01.000000/2026-00',
  });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getGroups();
      setGroups(res.groups);
      if (res.config) {
        setConfig(res.config);
      }
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        legalStatus={config.promotionLegalStatus}
      />

      {/* Legal & Regulatory Compliance Banner */}
      <LegalBanner
        status={config.promotionLegalStatus || 'PENDING_REVIEW'}
        processNumber={config.legalProcessNumber}
        onOpenComplianceTab={() => setActiveTab('compliance')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
            <p className="text-sm font-medium">Carregando grupos e parâmetros Pix...</p>
          </div>
        ) : (
          <ErrorBoundary>
            {activeTab === 'groups' && (
              <GroupSelector
                groups={groups}
                entryPriceCents={config.entryPriceCents || 100}
                onRefresh={loadData}
                onSelectMyNumbers={() => setActiveTab('my-numbers')}
                onOpenAdmin={() => setActiveTab('admin')}
              />
            )}

            {activeTab === 'my-numbers' && <ParticipantArea />}

            {activeTab === 'draws' && <DrawResults />}

            {activeTab === 'admin' && <AdminDashboard />}

            {activeTab === 'compliance' && (
              <ComplianceView
                legalStatus={config.promotionLegalStatus || 'PENDING_REVIEW'}
                processNumber={config.legalProcessNumber || ''}
              />
            )}
          </ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span>Plataforma Técnica de Gestão de Grupos Pix & Sorteios Auditáveis</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-500">
            <span>Concorrência Atômica</span>
            <span>•</span>
            <span>Idempotência Estrita</span>
            <span>•</span>
            <span>SHA-256 Determinístico</span>
            <span>•</span>
            <button
              onClick={() => setActiveTab('compliance')}
              className="text-emerald-500 hover:text-emerald-400 underline cursor-pointer"
            >
              Lei nº 5.768/71 (SPA/MF)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
