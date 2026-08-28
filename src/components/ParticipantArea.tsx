import React, { useState } from 'react';
import {
  Search,
  User,
  Ticket,
  Calendar,
  Layers,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Participant } from '../types';
import { api } from '../services/api';

export const ParticipantArea: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Participant[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setError('Informe ao menos 3 caracteres (CPF, Nome ou ID) para buscar.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.searchParticipants(searchQuery);
      setResults(res.participants);
      setSearched(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar busca.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-slate-100">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
            <Ticket className="w-3.5 h-3.5" />
            Consulta Pública de Participação
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Consulte Seus Números da Sorte & Grupos
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2">
            Localize suas participações confirmadas pelo CPF, nome ou ID de participante. Seus dados cadastrais sensíveis são protegidos por máscara de privacidade.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mt-6">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Digite seu CPF (ex: 123.456.789-00) ou Nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Pesquisando...' : 'Buscar Participações'}
            </button>
          </div>
          {error && (
            <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Resultados */}
      {searched && results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-slate-200">
              Participações Encontradas ({results.length})
            </h3>
            <span className="text-xs text-slate-400">
              Busca: &ldquo;{searchQuery}&rdquo;
            </span>
          </div>

          {results.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
              <Ticket className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <h4 className="font-bold text-slate-300">Nenhuma participação confirmada encontrada</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Verifique se o pagamento já foi aprovado pelo gateway Pix ou certifique-se de digitar o CPF correto.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((p) => (
                <div
                  key={p.participantId}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
                          {p.groupId}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-white">Grupo {p.groupId}</span>
                          <span className="block text-[11px] text-slate-400 font-mono">
                            Seq. #{p.sequenceNumber}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        CONFIRMADO
                      </span>
                    </div>

                    {/* Número da Sorte */}
                    <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 text-center my-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Número de Participação
                      </span>
                      <span className="font-mono text-3xl font-extrabold text-emerald-400 tracking-widest block my-1">
                        {p.number}
                      </span>
                    </div>

                    {/* Detalhes */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Nome:
                        </span>
                        <span className="font-semibold text-slate-200">{p.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> CPF:
                        </span>
                        <span className="font-mono text-slate-300">{p.maskedCpf}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> Confirmado em:
                        </span>
                        <span className="font-mono text-slate-300">
                          {new Date(p.confirmedAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ID */}
                  <div className="pt-3 mt-3 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono truncate">
                    ID: {p.participantId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
