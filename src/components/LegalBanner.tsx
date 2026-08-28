import React from 'react';
import { AlertTriangle, ShieldCheck, Scale, Info, CheckCircle2 } from 'lucide-react';
import { PromotionLegalStatus } from '../types';

interface LegalBannerProps {
  status: PromotionLegalStatus;
  processNumber?: string;
  onOpenComplianceTab?: () => void;
}

export const LegalBanner: React.FC<LegalBannerProps> = ({
  status,
  processNumber,
  onOpenComplianceTab,
}) => {
  if (status === 'AUTHORIZED') {
    return (
      <div className="bg-emerald-950/40 border-y border-emerald-500/30 px-4 py-3 text-emerald-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-emerald-300">
                Operação Promocional Autorizada:
              </span>{' '}
              Sorteios e premiações em conformidade com a Lei nº 5.768/71 (Processo:{' '}
              <span className="font-mono text-emerald-200 font-bold">{processNumber || 'SPA/MF nº 01.000000/2026'}</span>).
            </div>
          </div>
          <button
            onClick={onOpenComplianceTab}
            className="text-emerald-400 hover:text-emerald-300 underline font-medium text-xs whitespace-nowrap cursor-pointer"
          >
            Ver Certificado & Regulamento →
          </button>
        </div>
      </div>
    );
  }

  if (status === 'DISABLED') {
    return (
      <div className="bg-rose-950/40 border-y border-rose-500/30 px-4 py-3 text-rose-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-semibold text-rose-300">
                Mecânica de Sorteio Desabilitada:
              </span>{' '}
              Por diretriz administrativa, sorteios com premiação estão desativados no sistema.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-950/50 border-y border-amber-500/30 px-4 py-3.5 text-amber-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-start sm:items-center gap-3">
          <Scale className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="font-bold text-amber-300 flex items-center gap-2">
              <span>AVISO DE CONFORMIDADE COM A LEGISLAÇÃO BRASILEIRA</span>
              <span className="px-2 py-0.5 text-[11px] rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-mono">
                Status: Análise Técnica (Pending Review)
              </span>
            </div>
            <p className="text-amber-200/90 mt-0.5 leading-relaxed">
              Esta plataforma atua estritamente como solução técnica para controle de grupos, cotas Pix e sorteios auditáveis. Em conformidade com a <strong>Lei nº 5.768/1971</strong> e regulamentações do <strong>Ministério da Fazenda (SPA/MF)</strong>, a execução de sorteios reais e premiações está bloqueada até a concessão formal do Certificado de Autorização.
            </p>
          </div>
        </div>
        {onOpenComplianceTab && (
          <button
            onClick={onOpenComplianceTab}
            className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer self-end md:self-center"
          >
            Diretrizes Jurídicas & SPA/MF
          </button>
        )}
      </div>
    </div>
  );
};
