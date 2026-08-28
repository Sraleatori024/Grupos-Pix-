import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Lock,
  Award,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  Send,
  Trophy,
  Search,
} from 'lucide-react';
import { Group, Payment, Participant } from '../types';
import { PixCheckoutModal } from './PixCheckoutModal';

interface GroupSelectorProps {
  groups: Group[];
  entryPriceCents: number;
  onRefresh: () => void;
  onSelectMyNumbers: () => void;
  onOpenAdmin?: () => void;
}

export const GroupSelector: React.FC<GroupSelectorProps> = ({
  groups,
  entryPriceCents,
  onRefresh,
  onSelectMyNumbers,
  onOpenAdmin,
}) => {
  const [selectedGroupForCheckout, setSelectedGroupForCheckout] = useState<Group | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'OPEN' | 'FULL' | 'COMPLETED'>('ALL');
  const [lastConfirmedNumber, setLastConfirmedNumber] = useState<{
    groupName: string;
    number: string;
    name: string;
  } | null>(null);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // Status filter
      if (filterType === 'OPEN' && (g.status !== 'OPEN' || g.confirmedParticipants >= g.capacity)) return false;
      if (filterType === 'FULL' && g.status !== 'FULL' && g.confirmedParticipants < g.capacity) return false;
      if (filterType === 'COMPLETED' && g.status !== 'DRAW_COMPLETED' && g.drawStatus !== 'COMPLETED') return false;

      // Text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          g.name.toLowerCase().includes(term) ||
          (g.description && g.description.toLowerCase().includes(term)) ||
          g.groupId.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [groups, filterType, searchTerm]);

  const getStatusBadge = (status: Group['status'], confirmed: number, capacity: number) => {
    if (status === 'OPEN' && confirmed >= capacity) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          ESGOTADO
        </span>
      );
    }
    switch (status) {
      case 'OPEN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ABERTO
          </span>
        );
      case 'DRAFT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            RASCUNHO
          </span>
        );
      case 'FULL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            CHEIO
          </span>
        );
      case 'CLOSED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            ENCERRADO
          </span>
        );
      case 'DRAW_READY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            PRONTO P/ SORTEIO
          </span>
        );
      case 'DRAW_COMPLETED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            SORTEIO REALIZADO
          </span>
        );
      default:
        return null;
    }
  };

  const handleCheckoutSuccess = (payment: Payment, participant: Participant) => {
    const matchedGroup = groups.find((g) => g.groupId === participant.groupId);
    setLastConfirmedNumber({
      groupName: matchedGroup ? matchedGroup.name : `Grupo ${participant.groupId}`,
      number: participant.number,
      name: participant.name,
    });
    onRefresh();
  };

  return (
    <div className="space-y-8">
      {/* Toast de Confirmação Recente */}
      {lastConfirmedNumber && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4 text-slate-100 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                Participação Registrada com Sucesso!
              </p>
              <p className="text-sm font-bold">
                {lastConfirmedNumber.name} garantiu o número{' '}
                <span className="font-mono text-emerald-300 text-base">
                  {lastConfirmedNumber.number}
                </span>{' '}
                no {lastConfirmedNumber.groupName}.
              </p>
            </div>
          </div>
          <button
            onClick={onSelectMyNumbers}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all whitespace-nowrap cursor-pointer"
          >
            Ver Meus Números →
          </button>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Plataforma de Grupos e Participações Oficiais
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Selecione um Grupo e Garanta seu Número da Sorte via Pix
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Arquitetura segura com <strong>concorrência atômica</strong> (bloqueio de overbooking), validação estrita por{' '}
            <strong>webhook do gateway Pix</strong> e sorteios auditados com hash criptográfico SHA-256.
          </p>
          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conformidade Legal & LGPD</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Sorteio Criptográfico Auditável</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome do grupo ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'ALL', label: 'Todos' },
              { id: 'OPEN', label: 'Disponíveis' },
              { id: 'FULL', label: 'Cheios' },
              { id: 'COMPLETED', label: 'Sorteados' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Grupos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">
            Grupos ({filteredGroups.length} {filteredGroups.length === 1 ? 'grupo' : 'grupos'})
          </h2>
        </div>

        {groups.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nenhum grupo cadastrado no momento</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                A plataforma está 100% zerada e pronta para você criar seus próprios grupos (WhatsApp / Telegram) e testar cada um passo a passo.
              </p>
            </div>
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <span>Acessar Painel & Criar Primeiro Grupo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
            <p className="text-sm text-slate-400">Nenhum grupo encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGroups.map((group) => {
              const priceCents = group.entryPriceCents || entryPriceCents || 100;
              const formattedGroupPrice = `R$ ${(priceCents / 100).toFixed(2).replace('.', ',')}`;
              const formattedPrize = group.prizeAmountCents
                ? `R$ ${(group.prizeAmountCents / 100).toFixed(2).replace('.', ',')}`
                : null;

              const percentage = Math.min(
                100,
                Math.round((group.confirmedParticipants / group.capacity) * 100)
              );
              const isAvailable = group.status === 'OPEN' && group.confirmedParticipants < group.capacity;

              return (
                <div
                  key={group.groupId}
                  id={`group-card-${group.groupId}`}
                  className={`relative bg-slate-900 border rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between ${
                    isAvailable
                      ? 'border-slate-800 hover:border-emerald-500/50 hover:shadow-emerald-500/5'
                      : 'border-slate-800/60 opacity-85'
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm border ${
                            group.groupType === 'TELEGRAM'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {group.groupType === 'TELEGRAM' ? (
                            <Send className="w-5 h-5" />
                          ) : (
                            <MessageCircle className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-white line-clamp-1">{group.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                            <span>{group.groupType === 'TELEGRAM' ? 'Telegram' : 'WhatsApp'}</span>
                            <span>•</span>
                            <span>{group.capacity.toLocaleString('pt-BR')} vagas</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(group.status, group.confirmedParticipants, group.capacity)}
                    </div>

                    {/* Descrição */}
                    {group.description && (
                      <p className="text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed">
                        {group.description}
                      </p>
                    )}

                    {/* Destaque de Prêmio */}
                    {formattedPrize && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                        <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          Prêmio do Grupo
                        </span>
                        <span className="font-bold font-mono text-amber-300 text-sm">{formattedPrize}</span>
                      </div>
                    )}

                    {/* Progress Bar & Counters */}
                    <div className="space-y-2 my-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          Vagas Preenchidas
                        </span>
                        <span className="font-bold font-mono text-slate-200">
                          {group.confirmedParticipants.toLocaleString('pt-BR')} /{' '}
                          {group.capacity.toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percentage >= 100
                              ? 'bg-amber-500'
                              : percentage > 75
                              ? 'bg-emerald-400'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(2, percentage)}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span>{percentage}% preenchido</span>
                        <span>
                          {Math.max(0, group.capacity - group.confirmedParticipants).toLocaleString('pt-BR')} vagas
                          restantes
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Valor da Cota
                      </span>
                      <span className="text-base font-extrabold text-white font-mono">
                        {formattedGroupPrice}
                      </span>
                    </div>

                    {isAvailable ? (
                      <button
                        id={`btn-participate-group-${group.groupId}`}
                        onClick={() => setSelectedGroupForCheckout(group)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <span>Participar via Pix</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-500 font-semibold text-xs cursor-not-allowed border border-slate-700/50"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {group.confirmedParticipants >= group.capacity ? 'Esgotado' : 'Indisponível'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Checkout Pix */}
      {selectedGroupForCheckout && (
        <PixCheckoutModal
          group={selectedGroupForCheckout}
          entryPriceCents={selectedGroupForCheckout.entryPriceCents || entryPriceCents}
          onClose={() => setSelectedGroupForCheckout(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
};

