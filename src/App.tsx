import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LegalBanner } from './components/LegalBanner';
import { GroupSelector } from './components/GroupSelector';
import { ParticipantArea } from './components/ParticipantArea';
import { DrawResults } from './components/DrawResults';
import { AdminDashboard } from './components/AdminDashboard';
import { ComplianceView } from './components/ComplianceView';
import { Group, SystemConfig } from './types';
import { api } from './services/api';
import { RefreshCw, Layers, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'groups' | 'my-numbers' | 'draws' | 'admin' | 'compliance'>('groups');
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
          <>
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
          </>
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
