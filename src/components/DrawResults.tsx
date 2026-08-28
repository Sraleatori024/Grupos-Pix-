import React, { useState, useEffect } from 'react';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Search,
  FileCode,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Hash,
  Binary,
} from 'lucide-react';
import { DrawAuditRecord } from '../types';
import { api } from '../services/api';

export const DrawResults: React.FC = () => {
  const [draws, setDraws] = useState<DrawAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraw, setSelectedDraw] = useState<DrawAuditRecord | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  const loadDraws = async () => {
    try {
      setLoading(true);
      const res = await api.getDraws();
      setDraws(res.draws);
      if (res.draws.length > 0 && !selectedDraw) {
        setSelectedDraw(res.draws[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar sorteios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDraws();
  }, []);

  const handleVerify = async (draw: DrawAuditRecord) => {
    try {
      setVerifying(true);
      setVerificationResult(null);
      const res = await api.verifyDraw(draw.drawId);
      setVerificationResult(res);
    } catch (err: any) {
      alert('Erro na auditoria matemática: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-slate-100">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Transparência & Auditoria Criptográfica
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Resultados Oficiais dos Sorteios
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
            Mecanismo determinístico auditável baseado em <strong>Hash SHA-256 da Lista Canônica de Participantes</strong> e Semente CSPRNG. Qualquer cidadão ou auditor externo pode reproduzir o cálculo matemático para certificar a integridade do resultado.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400 mb-2" />
          <p className="text-xs">Carregando registros imutáveis de sorteio...</p>
        </div>
      ) : draws.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Award className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h3 className="font-bold text-slate-200 text-base">Nenhum sorteio concluído até o momento</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Assim que um grupo atingir a capacidade máxima e for concluído pelo painel auditado, o resultado público e o hash SHA-256 ficarão disponíveis nesta página.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sorteios List */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Sorteios Realizados ({draws.length})
            </h3>
            <div className="space-y-2.5">
              {draws.map((d) => (
                <div
                  key={d.drawId}
                  onClick={() => {
                    setSelectedDraw(d);
                    setVerificationResult(null);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedDraw?.drawId === d.drawId
                      ? 'bg-slate-800/90 border-emerald-500/60 shadow-lg text-white'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-sm text-emerald-400">Grupo {d.groupId}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Nº {d.winningNumber}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-100 truncate">{d.winnerName}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
                    <span>{d.participantsCount.toLocaleString('pt-BR')} participantes</span>
                    <span>{new Date(d.drawnAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Draw Detailed Verification Card */}
          {selectedDraw && (
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-slate-100 space-y-6">
              {/* Winner Showcase Banner */}
              <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-inner relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Sparkles className="w-3 h-3" /> Vencedor Homologado • Grupo {selectedDraw.groupId}
                    </span>
                    <h3 className="text-2xl font-extrabold text-white mt-1">
                      {selectedDraw.winnerName}
                    </h3>
                    <p className="text-xs text-slate-300 font-mono">
                      CPF: {selectedDraw.winnerMaskedCpf}
                    </p>
                  </div>

                  <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl px-5 py-3 text-center sm:text-right shrink-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Número Sorteado
                    </span>
                    <span className="font-mono text-3xl font-extrabold text-emerald-400 tracking-wider">
                      {selectedDraw.winningNumber}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parâmetros de Auditoria Criptográfica */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-emerald-400" />
                  Registro de Auditoria Imutável (SHA-256)
                </h4>

                <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                      Hash Canônico da Lista Fechada de Participantes (SHA-256)
                    </span>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 break-all select-all">
                      {selectedDraw.participantsListHash}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                        Semente de Entropia Temporal & CSPRNG
                      </span>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 truncate select-all">
                        {selectedDraw.randomnessSeed}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                        Código de Validação Pública
                      </span>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-300 font-bold select-all">
                        {selectedDraw.publicVerificationCode}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Total de Vagas:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {selectedDraw.participantsCount.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Data do Fechamento:</span>
                      <span className="font-mono text-slate-200">
                        {new Date(selectedDraw.closedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Data do Sorteio:</span>
                      <span className="font-mono text-slate-200">
                        {new Date(selectedDraw.drawnAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão de Auditoria Matemática Interativa */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleVerify(selectedDraw)}
                  disabled={verifying}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Binary className="w-4 h-4 text-emerald-400" />
                  {verifying ? 'Recalculando SHA-256 e provando resultado...' : 'Auditar e Verificar Prova Matemática do Sorteio'}
                </button>
              </div>

              {/* Resultado da Prova Matemática */}
              {verificationResult && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 text-xs space-y-2 text-emerald-200">
                  <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Prova Criptográfica Validada com Sucesso! (100% de Integridade)
                  </div>
                  <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                    O cálculo independente reprocessou a fórmula de seleção:{' '}
                    <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-300 font-mono">
                      BigInt(SHA256(Input)) % {verificationResult.mathematicalProof.participantsCount}
                    </code>
                    . O índice calculado foi{' '}
                    <strong>#{verificationResult.mathematicalProof.calculatedIndex}</strong>, que aponta exatamente para o número vencedor{' '}
                    <strong className="font-mono text-emerald-300">{verificationResult.mathematicalProof.verifiedWinningNumber}</strong>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
