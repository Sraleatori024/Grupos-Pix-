import React from 'react';
import {
  Scale,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { PromotionLegalStatus } from '../types';

interface ComplianceViewProps {
  legalStatus: PromotionLegalStatus;
  processNumber: string;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  legalStatus,
  processNumber,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
          <Scale className="w-3.5 h-3.5" />
          Conformidade Jurídica & Regulação Brasileira
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Marco Regulatório de Promoções Comerciais & Sorteios
        </h2>
        <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
          Esta plataforma foi concebida sob rigorosos padrões de segurança técnica, integridade de dados e aderência estrita à legislação brasileira vigente que rege a distribuição gratuita de prêmios e promoções comerciais.
        </p>
      </div>

      {/* Status Atual do Sistema */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Status Legal da Aplicação
        </h3>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
              Parâmetro: PROMOTION_LEGAL_STATUS
            </span>
            <span className="font-mono text-base font-bold text-amber-400">
              {legalStatus}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Processo / Certificado de Autorização:{' '}
              <strong className="text-slate-200 font-mono">{processNumber || 'Em Tramitação'}</strong>
            </p>
          </div>

          <div className="text-xs text-right">
            {legalStatus === 'AUTHORIZED' ? (
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                Sorteios Reais Habilitados
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                Sorteios Reais Bloqueados (Apenas Testes Técnicos)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Diretrizes Legais Fundamentais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-white">Lei Federal nº 5.768/1971</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dispõe sobre a distribuição gratuita de prêmios mediante sorteio, vale-brinde ou concurso, a título de propaganda comercial. A realização de promoções com premiação exige autorização prévia governamental.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
            <Scale className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-white">Secretaria de Prêmios e Apostas (SPA/MF)</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Órgão do Ministério da Fazenda competente para autorizar, normatizar, fiscalizar e homologar promoções comerciais e sorteios auditados em todo o território nacional.
          </p>
        </div>
      </div>

      {/* Princípios de Prevenção a Fraudes e Não-Exploração de Rifa Ilegal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-emerald-400" />
          Salvaguardas Técnicas e Arquiteturais Implementadas
        </h3>

        <ul className="space-y-2.5 text-xs text-slate-300">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Trava de Autorização Regulatória:</strong> O backend bloqueia categoricamente a execução de qualquer sorteio com premiação quando o status legal for diferente de <code>AUTHORIZED</code>.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Determinismo Auditável (SHA-256):</strong> Proibição de geradores aleatórios voláteis (como <code>Math.random()</code>). O sorteio gera um hash criptográfico da lista selada de participantes para verificação pública independente.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Concorrência Atômica & Zero Overbooking:</strong> Transações com mutex que impedem a venda ou alocação de mais de 10.000 cotas por grupo, garantindo a integridade dos limites anunciados.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Confirmação Estrita por Webhook:</strong> Nenhuma cota é confirmada por simples clique do usuário; apenas eventos assinados do gateway bancário Pix têm autoridade para efetivar a inscrição.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
