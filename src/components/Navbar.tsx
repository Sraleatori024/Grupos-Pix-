import React from 'react';
import {
  Layers,
  QrCode,
  Search,
  Award,
  ShieldCheck,
  Activity,
  FileCheck2,
} from 'lucide-react';
import { PromotionLegalStatus } from '../types';

interface NavbarProps {
  activeTab: 'groups' | 'my-numbers' | 'draws' | 'admin' | 'compliance';
  setActiveTab: (tab: 'groups' | 'my-numbers' | 'draws' | 'admin' | 'compliance') => void;
  legalStatus?: PromotionLegalStatus;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  legalStatus = 'PENDING_REVIEW',
}) => {
  const getStatusBadge = () => {
    switch (legalStatus) {
      case 'AUTHORIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SPA/MF Autorizado
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Sorteios Desabilitados
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Conformidade: Em Análise
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('groups')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Layers className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  Grupos Pix & Sorteios
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  100k Vagas
                </span>
              </div>
              <p className="text-xs text-slate-400">10 Grupos A-J • Concorrência Atômica</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              id="nav-tab-groups"
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'groups'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Grupos & Pix
            </button>

            <button
              id="nav-tab-my-numbers"
              onClick={() => setActiveTab('my-numbers')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'my-numbers'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              Consultar Participação
            </button>

            <button
              id="nav-tab-draws"
              onClick={() => setActiveTab('draws')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'draws'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Award className="w-4 h-4" />
              Sorteios & Auditoria
            </button>

            <button
              id="nav-tab-compliance"
              onClick={() => setActiveTab('compliance')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'compliance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              Legislação BR
            </button>

            <button
              id="nav-tab-admin"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'admin'
                  ? 'bg-slate-700 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Painel Admin
            </button>
          </nav>

          {/* Status Indicator */}
          <div className="hidden lg:flex items-center gap-3">
            {getStatusBadge()}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-between py-2.5 border-t border-slate-800 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'groups' ? 'bg-emerald-600 text-white' : 'text-slate-300 bg-slate-800/60'
            }`}
          >
            Grupos
          </button>
          <button
            onClick={() => setActiveTab('my-numbers')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'my-numbers' ? 'bg-emerald-600 text-white' : 'text-slate-300 bg-slate-800/60'
            }`}
          >
            Consulta
          </button>
          <button
            onClick={() => setActiveTab('draws')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'draws' ? 'bg-emerald-600 text-white' : 'text-slate-300 bg-slate-800/60'
            }`}
          >
            Sorteios
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'admin' ? 'bg-slate-700 text-emerald-400' : 'text-slate-300 bg-slate-800/60'
            }`}
          >
            Admin
          </button>
        </div>
      </div>
    </header>
  );
};
