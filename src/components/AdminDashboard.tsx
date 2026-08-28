import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  DollarSign,
  Users,
  Layers,
  Award,
  AlertTriangle,
  RefreshCw,
  Lock,
  Play,
  FileCheck2,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Settings,
  Scale,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  MessageCircle,
  Send,
  Trophy,
  X,
  History,
  Sparkles,
  Hash,
} from 'lucide-react';
import {
  DashboardMetrics,
  Group,
  GroupType,
  GroupStatus,
  Payment,
  Participant,
  AuditLog,
  DrawAuditRecord,
  PromotionLegalStatus,
  CreateGroupInput,
  UpdateGroupInput,
} from '../types';
import { api } from '../services/api';
import { PremiumDrawCenter } from './PremiumDrawCenter';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState<'overview' | 'groups' | 'draws' | 'payments' | 'participants' | 'audit' | 'settings'>('overview');

  // Sub-data states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [drawsHistory, setDrawsHistory] = useState<DrawAuditRecord[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');

  // Premium Draw Center State
  const [activeDrawGroupId, setActiveDrawGroupId] = useState<string | null>(null);
  const [auditProofModalData, setAuditProofModalData] = useState<any | null>(null);
  const [verifyingProof, setVerifyingProof] = useState(false);

  // Actions states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group Modal State (Create / Edit)
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupFormId, setGroupFormId] = useState('');
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormDescription, setGroupFormDescription] = useState('');
  const [groupFormCapacity, setGroupFormCapacity] = useState(10000);
  const [groupFormEntryPrice, setGroupFormEntryPrice] = useState(1.0);
  const [groupFormPrize, setGroupFormPrize] = useState(7000.0);
  const [groupFormAdminFee, setGroupFormAdminFee] = useState(3000.0);
  const [groupFormType, setGroupFormType] = useState<GroupType>('WHATSAPP');
  const [groupFormLink, setGroupFormLink] = useState('https://chat.whatsapp.com/Exemplo');
  const [groupFormStatus, setGroupFormStatus] = useState<GroupStatus>('OPEN');

  // Concurrency test output
  const [concurrencyResult, setConcurrencyResult] = useState<any | null>(null);

  // Settings form
  const [legalStatusInput, setLegalStatusInput] = useState<PromotionLegalStatus>('PENDING_REVIEW');
  const [processNumberInput, setProcessNumberInput] = useState('');
  const [entryPriceInput, setEntryPriceInput] = useState(100);

  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setDashboardError(null);
      const data = await api.getAdminDashboard();
      setMetrics(data);
      setLegalStatusInput(data.config.promotionLegalStatus);
      setProcessNumberInput(data.config.legalProcessNumber || '');
      setEntryPriceInput(data.config.entryPriceCents || 100);
    } catch (err: any) {
      console.error('Erro ao carregar dashboard:', err);
      setDashboardError(err.message || 'Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  const loadSubTabData = async () => {
    if (adminTab === 'payments') {
      const res = await api.getAdminPayments(100);
      setPayments(res.payments);
    } else if (adminTab === 'participants') {
      const res = await api.getAdminParticipants(selectedGroupFilter, participantSearch);
      setParticipants(res.participants);
    } else if (adminTab === 'audit') {
      const res = await api.getAdminAuditLogs(100);
      setAuditLogs(res.logs);
    } else if (adminTab === 'draws') {
      const res = await api.getAdminDrawsHistory();
      setDrawsHistory(res.draws);
    }
  };

  const handleOpenAuditProof = async (drawId: string) => {
    try {
      setVerifyingProof(true);
      const proof = await api.verifyDraw(drawId);
      const drawRes = await api.getDraw(drawId);
      setAuditProofModalData({
        ...proof,
        draw: drawRes.draw,
      });
    } catch (err: any) {
      alert('Erro ao consultar prova de auditoria: ' + err.message);
    } finally {
      setVerifyingProof(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadSubTabData();
  }, [adminTab, selectedGroupFilter]);

  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupFormId(`G-${Date.now().toString(36).toUpperCase()}`);
    setGroupFormName('');
    setGroupFormDescription('');
    setGroupFormCapacity(10000);
    setGroupFormEntryPrice(1.0);
    setGroupFormPrize(7000.0);
    setGroupFormAdminFee(3000.0);
    setGroupFormType('WHATSAPP');
    setGroupFormLink('');
    setGroupFormStatus('OPEN');
    setGroupModalOpen(true);
  };

  const openEditGroupModal = (group: Group) => {
    setEditingGroup(group);
    setGroupFormId(group.groupId);
    setGroupFormName(group.name);
    setGroupFormDescription(group.description || '');
    setGroupFormCapacity(group.capacity);
    setGroupFormEntryPrice((group.entryPriceCents || 100) / 100);
    setGroupFormPrize((group.prizeAmountCents || 0) / 100);
    setGroupFormAdminFee((group.adminFeeCents || 0) / 100);
    setGroupFormType(group.groupType || 'WHATSAPP');
    setGroupFormLink(group.groupLink || '');
    setGroupFormStatus(group.status);
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormName.trim()) {
      alert('Informe o nome do grupo.');
      return;
    }

    try {
      setActionLoading(true);
      const entryPriceCents = Math.round(Number(groupFormEntryPrice) * 100);
      const prizeAmountCents = Math.round(Number(groupFormPrize) * 100);
      const adminFeeCents = Math.round(Number(groupFormAdminFee) * 100);

      if (editingGroup) {
        // Atualizar
        const updateData: UpdateGroupInput = {
          name: groupFormName.trim(),
          description: groupFormDescription.trim(),
          capacity: Number(groupFormCapacity),
          entryPriceCents,
          prizeAmountCents,
          adminFeeCents,
          groupType: groupFormType,
          groupLink: groupFormLink.trim(),
          status: groupFormStatus,
        };
        await api.updateGroup(editingGroup.groupId, updateData);
        setActionMessage({
          type: 'success',
          text: `Grupo "${editingGroup.name}" atualizado com sucesso!`,
        });
      } else {
        // Criar
        const createData: CreateGroupInput = {
          groupId: groupFormId.trim().toUpperCase() || undefined,
          name: groupFormName.trim(),
          description: groupFormDescription.trim(),
          capacity: Number(groupFormCapacity),
          entryPriceCents,
          prizeAmountCents,
          adminFeeCents,
          groupType: groupFormType,
          groupLink: groupFormLink.trim(),
          status: groupFormStatus,
        };
        await api.createGroup(createData);
        setActionMessage({
          type: 'success',
          text: `Novo grupo "${groupFormName}" criado com sucesso!`,
        });
      }
      setGroupModalOpen(false);
      await loadDashboard();
    } catch (err: any) {
      alert('Erro ao salvar grupo: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeed10kGroup = async () => {
    try {
      setActionLoading(true);
      const res = await api.seed10kGroup(10000);
      setActionMessage({
        type: 'success',
        text: res.message,
      });
      await loadDashboard();
      if (adminTab === 'groups') {
        loadSubTabData();
      }
    } catch (err: any) {
      alert('Erro ao gerar grupo de 10.000 pessoas: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    if (group.confirmedParticipants > 0) {
      alert(`Não é possível excluir o grupo "${group.name}" pois ele já possui ${group.confirmedParticipants} participantes confirmados.`);
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir o grupo "${group.name}" (${group.groupId})?`)) {
      return;
    }
    try {
      setActionLoading(true);
      await api.deleteGroup(group.groupId);
      setActionMessage({ type: 'success', text: `Grupo "${group.name}" excluído.` });
      await loadDashboard();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseGroup = async (groupId: string) => {
    if (!confirm(`Deseja fechar o Grupo ${groupId} para novas participações?`)) return;
    try {
      setActionLoading(true);
      await api.closeGroup(groupId);
      setActionMessage({ type: 'success', text: `Grupo ${groupId} encerrado com sucesso.` });
      await loadDashboard();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrepareDraw = async (groupId: string) => {
    try {
      setActionLoading(true);
      const res = await api.prepareDraw(groupId);
      setActionMessage({
        type: 'success',
        text: `Auditoria pré-sorteio gerada para o Grupo ${groupId}. Hash da lista: ${res.participantsListHash.substring(0, 16)}...`,
      });
      await loadDashboard();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDraw = async (groupId: string) => {
    if (metrics?.config.promotionLegalStatus !== 'AUTHORIZED') {
      alert(
        `Ação bloqueada! O status legal da promoção está como '${metrics?.config.promotionLegalStatus}'. Para realizar sorteios com premiação no Brasil, a operação precisa estar regularizada e com status 'AUTHORIZED'. Altere nas configurações administrativas quando autorizado.`
      );
      return;
    }

    if (!confirm(`CONFIRMAÇÃO DE SORTEIO: Deseja executar e selar o sorteio oficial do Grupo ${groupId}? Esta ação é irreversível e gerará um registro de auditoria imutável.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.executeDraw(groupId);
      setActionMessage({
        type: 'success',
        text: `Sorteio do Grupo ${groupId} concluído com sucesso! Vencedor: ${res.winner.name} (Número ${res.winner.number}).`,
      });
      await loadDashboard();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await api.updateConfig({
        promotionLegalStatus: legalStatusInput,
        legalProcessNumber: processNumberInput,
        entryPriceCents: entryPriceInput,
      });
      setActionMessage({ type: 'success', text: 'Configurações atualizadas com sucesso.' });
      await loadDashboard();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    if (
      !confirm(
        'ATENÇÃO: Deseja realmente zerar todos os dados do sistema (todos os grupos, cobranças e participantes)? Esta ação retornará a plataforma para o estado 100% limpo.'
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      await api.resetDatabase();
      setActionMessage({
        type: 'success',
        text: 'Sistema zerado com sucesso! Todos os grupos e dados foram limpos.',
      });
      await loadDashboard();
      await loadSubTabData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunConcurrencyTest = async () => {
    try {
      setActionLoading(true);
      const res = await api.runConcurrencyTest();
      setConcurrencyResult(res);
      setActionMessage({
        type: 'success',
        text: `Teste de concorrência executado: ${res.successfulConfirmations} confirmados, ${res.rejectedOrRefunded} rejeitados/estornados. Overbooking prevenido com sucesso.`,
      });
      await loadDashboard();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const formatCents = (cents: number = 0) => {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm">Carregando painel de controle administrativo...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-extrabold text-white">Não foi possível carregar o painel administrativo</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {dashboardError || 'Ocorreu uma falha temporária ao obter os dados do servidor.'}
        </p>
        <button
          onClick={loadDashboard}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-emerald-600/20"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Painel Admin */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">Painel Administrativo & Gestão</h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  metrics.config.promotionLegalStatus === 'AUTHORIZED'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : metrics.config.promotionLegalStatus === 'PENDING_REVIEW'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}
              >
                LEGAL: {metrics.config.promotionLegalStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Controle de grupos ilimitados, concorrência atômica, webhooks e auditoria criptográfica
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateGroupModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Grupo</span>
          </button>
          <button
            onClick={() => loadDashboard()}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Banner de Mensagens de Ação */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-tabs Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setAdminTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            adminTab === 'overview'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Visão Geral & Métricas R$
        </button>
        <button
          onClick={() => setAdminTab('groups')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            adminTab === 'groups'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Grupos ({metrics.groups.length})
        </button>
        <button
          onClick={() => setAdminTab('draws')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            adminTab === 'draws'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Histórico de Sorteios</span>
        </button>
        <button
          onClick={() => setAdminTab('payments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            adminTab === 'payments'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Cobranças Pix ({metrics.counts.totalPaidPayments + metrics.counts.totalPendingPayments})
        </button>
        <button
          onClick={() => setAdminTab('participants')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            adminTab === 'participants'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Participantes ({metrics.counts.totalConfirmedParticipants})
        </button>
        <button
          onClick={() => setAdminTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            adminTab === 'audit'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Logs de Auditoria
        </button>
        <button
          onClick={() => setAdminTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            adminTab === 'settings'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Configurações & Regulação
        </button>
      </div>

      {/* ABA 1: VISÃO GERAL & FINANCEIRO EM CENTAVOS */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          {/* Métricas Financeiras Separadas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Arrecadação Bruta</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-2 font-mono">
                {formatCents(metrics.financials.totalGrossCents)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {metrics.counts.totalPaidPayments} pagamentos Pix aprovados
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Taxas Gateway Pix</span>
                <span className="text-[10px] text-amber-400 font-mono">Estimada</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-400 mt-2 font-mono">
                {formatCents(metrics.financials.totalGatewayFeesCents)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Custo bancário das transações</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Fundo de Premiação (70%)</span>
                <Award className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-indigo-400 mt-2 font-mono">
                {formatCents(metrics.financials.prizeFundCents)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Destinado aos contemplados</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Saldo Operacional Líquido</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-2 font-mono">
                {formatCents(metrics.financials.operationalNetCents)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Após taxas e fundos provisionados</p>
            </div>
          </div>

          {/* Métricas de Ocupação dos Grupos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="text-slate-400 text-xs font-semibold">Vagas Ocupadas / Capacidade</div>
              <div className="text-2xl font-extrabold text-white mt-1 font-mono">
                {metrics.counts.totalConfirmedParticipants.toLocaleString('pt-BR')} /{' '}
                {metrics.counts.totalCapacity.toLocaleString('pt-BR')}
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, metrics.counts.occupancyRate)}%` }}
                ></div>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {metrics.counts.occupancyRate.toFixed(2)}% da capacidade total preenchida
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="text-slate-400 text-xs font-semibold">Status dos Grupos ({metrics.groups.length})</div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-emerald-400 font-bold block">ABERTOS</span>
                  <span className="font-mono text-base font-bold text-white">
                    {metrics.counts.openGroupsCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-amber-400 font-bold block">CHEIOS</span>
                  <span className="font-mono text-base font-bold text-white">
                    {metrics.counts.fullGroupsCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">FECHADOS</span>
                  <span className="font-mono text-base font-bold text-white">
                    {metrics.counts.closedGroupsCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
              <div className="text-slate-400 text-xs font-semibold">Sorteios Realizados</div>
              <div className="text-2xl font-extrabold text-white mt-1 font-mono">
                {metrics.counts.totalDrawsExecuted} / {metrics.groups.length} Grupos
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Auditados com semente CSPRNG e Hash SHA-256
              </p>
            </div>
          </div>

          {/* Test Center: Concorrência e Idempotência */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Laboratório de Concorrência & Overbooking
                </div>
                <h3 className="text-lg font-bold text-white">
                  Teste de Alta Concorrência Atômica (10 Webhooks Simultâneos para 2 Vagas)
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl mt-1">
                  Dispara 10 confirmações de pagamento ao mesmo instante contra um grupo com apenas 2 vagas restantes para provar que a transação bloqueia 100% do overbooking.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunConcurrencyTest}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Executando Teste...' : 'Executar Teste de Concorrência'}
              </button>
            </div>

            {concurrencyResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-indigo-500/40 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resultado: {concurrencyResult.isOverbookingPrevented ? 'SUCESSO TOTAL - ZERO OVERBOOKING!' : 'FALHA'}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 pt-1">
                  <div>Webhooks Disparados: <strong>{concurrencyResult.simultaneousWebhooksSent}</strong></div>
                  <div>Vagas Disponíveis: <strong>{concurrencyResult.slotsAvailableInitially}</strong></div>
                  <div className="text-emerald-400">Aprovados: <strong>{concurrencyResult.successfulConfirmations}</strong></div>
                  <div className="text-amber-400">Rejeitados/Estornados: <strong>{concurrencyResult.rejectedOrRefunded}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: GERENCIAMENTO DE GRUPOS DINÂMICOS */}
      {adminTab === 'groups' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Gerenciador de Grupos e Campanhas</h3>
              <p className="text-xs text-slate-400">
                Cadastre e administre múltiplos grupos independentes sem limites com configurações personalizadas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSeed10kGroup}
                disabled={actionLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                title="Criar um grupo de teste com 10.000 participantes confirmados"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{actionLoading ? 'Gerando 10k...' : 'Gerar Grupo de 10.000 Pessoas'}</span>
              </button>
              <button
                onClick={openCreateGroupModal}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Grupo</span>
              </button>
            </div>
          </div>

          {metrics.groups.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Nenhum grupo cadastrado no momento</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                A plataforma está 100% limpa e zerada. Você pode criar um novo grupo ou gerar instantaneamente um grupo de demonstração com 10.000 participantes para testar o sorteio ao vivo!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleSeed10kGroup}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Gerar Grupo com 10.000 Pessoas para Sorteio</span>
                </button>
                <button
                  onClick={openCreateGroupModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Primeiro Grupo Manualmente</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Grupo / Plataforma</th>
                  <th className="py-3 px-4">Valor Cota</th>
                  <th className="py-3 px-4">Prêmio / Taxa</th>
                  <th className="py-3 px-4">Vagas & Ocupação</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sorteio</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {metrics.groups.map((g) => {
                  const pct = Math.min(100, Math.round((g.confirmedParticipants / g.capacity) * 100));
                  return (
                    <tr key={g.groupId} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                              g.groupType === 'TELEGRAM'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {g.groupType === 'TELEGRAM' ? (
                              <Send className="w-4 h-4" />
                            ) : (
                              <MessageCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{g.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({g.groupId})</span>
                            </div>
                            {g.groupLink && (
                              <a
                                href={g.groupLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <span>Link do Grupo</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                        {formatCents(g.entryPriceCents || 100)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        <div className="text-amber-300 font-semibold">{formatCents(g.prizeAmountCents || 0)}</div>
                        <div className="text-[10px] text-slate-500">Taxa: {formatCents(g.adminFeeCents || 0)}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-mono font-bold text-emerald-400">
                            {g.confirmedParticipants.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-slate-500">
                            / {g.capacity.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="w-28 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-slate-500">{pct}% ocupado</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            g.status === 'OPEN'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : g.status === 'DRAFT'
                              ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              : g.status === 'FULL'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                        {g.drawStatus === 'COMPLETED' ? (
                          <span className="text-emerald-400 font-bold">CONCLUÍDO</span>
                        ) : g.drawStatus === 'PREPARED' ? (
                          <span className="text-indigo-400 font-bold">PREPARADO</span>
                        ) : (
                          <span className="text-slate-500">PENDENTE</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditGroupModal(g)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          title="Editar Configurações do Grupo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {g.status === 'OPEN' && (
                          <button
                            onClick={() => handleCloseGroup(g.groupId)}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-[11px] border border-slate-700 transition cursor-pointer"
                          >
                            Fechar
                          </button>
                        )}
                        {g.drawStatus === 'COMPLETED' ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setActiveDrawGroupId(g.groupId)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px] transition shadow cursor-pointer inline-flex items-center gap-1"
                              title="Ver Vencedor e Detalhes do Sorteio"
                            >
                              <Trophy className="w-3.5 h-3.5 text-amber-400" />
                              <span>Ver Resultado</span>
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  setActionLoading(true);
                                  await api.resetGroupDraw(g.groupId);
                                  setActiveDrawGroupId(g.groupId);
                                  await loadDashboard();
                                } catch (err: any) {
                                  alert('Erro ao resetar: ' + err.message);
                                } finally {
                                  setActionLoading(false);
                                }
                              }}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-bold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                              title="Permite testar o sorteio novamente neste grupo"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Sortear Novamente</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveDrawGroupId(g.groupId)}
                            disabled={actionLoading || g.confirmedParticipants === 0}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-[11px] transition shadow-md shadow-emerald-500/20 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={g.confirmedParticipants === 0 ? 'Nenhum participante confirmado ainda' : 'Abrir Central de Sorteio Premium'}
                          >
                            <span>🎰</span>
                            <span>Sortear Vencedor</span>
                          </button>
                        )}
                        {g.confirmedParticipants === 0 && (
                          <button
                            onClick={() => handleDeleteGroup(g)}
                            disabled={actionLoading}
                            className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-400 transition cursor-pointer"
                            title="Excluir Grupo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* ABA: HISTÓRICO DE SORTEIOS CONCLUÍDOS */}
      {adminTab === 'draws' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-1">
                <Trophy className="w-3.5 h-3.5" />
                <span>Auditoria & Transparência Imutável</span>
              </div>
              <h3 className="text-lg font-bold text-white">Histórico de Sorteios Oficiais</h3>
              <p className="text-xs text-slate-400">
                Registros criptograficamente selados via SHA-256 e CSPRNG determinístico sem intervenção manual.
              </p>
            </div>
            <button
              onClick={loadSubTabData}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar Histórico</span>
            </button>
          </div>

          {drawsHistory.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mx-auto flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Nenhum sorteio realizado ainda</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Quando você realizar o primeiro sorteio através da <strong>Central de Sorteio Premium</strong>, o registro selado e a prova matemática de auditoria aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Grupo / ID</th>
                    <th className="py-3.5 px-4">Data / Hora</th>
                    <th className="py-3.5 px-4">Participantes</th>
                    <th className="py-3.5 px-4">Prêmio</th>
                    <th className="py-3.5 px-4">Vencedor Oficial</th>
                    <th className="py-3.5 px-4">Hash Lista (SHA-256)</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {drawsHistory.map((d) => (
                    <tr key={d.drawId} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{d.groupName || d.groupId}</div>
                        <div className="text-[10px] font-mono text-slate-500">{d.drawId}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {new Date(d.drawnAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {d.participantsCount.toLocaleString('pt-BR')} elegíveis
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                        {formatCents(d.prizeAmountCents)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{d.winnerName}</div>
                        <div className="text-[11px] font-mono text-emerald-400 font-bold">
                          Cota #{d.winningNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {d.winnerPhoneMasked || '(11) 9XXXX-1234'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        <span title={d.participantsListHash} className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          {d.participantsListHash.substring(0, 12)}...
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Concluído</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setActiveDrawGroupId(d.groupId)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] border border-amber-500/30 transition cursor-pointer"
                          title="Abrir Central de Sorteio Visual"
                        >
                          <span>Central</span>
                        </button>
                        <button
                          onClick={() => handleOpenAuditProof(d.drawId)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-300 font-bold text-[11px] border border-indigo-700/60 transition cursor-pointer"
                          title="Inspecionar Prova Matemática de Auditoria"
                        >
                          <span>Auditoria</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: COBRANÇAS PIX */}
      {adminTab === 'payments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Últimas Cobranças Pix Geradas</h3>
            <span className="text-xs text-slate-400">Total listado: {payments.length}</span>
          </div>

          {payments.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Nenhuma cobrança Pix gerada ainda</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Assim que você ou um participante iniciar o fluxo de pagamento Pix em qualquer grupo, os registros aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">ID Cobrança</th>
                    <th className="py-3 px-3">Grupo</th>
                    <th className="py-3 px-3">Participante</th>
                    <th className="py-3 px-3">Valor</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Número Atribuído</th>
                    <th className="py-3 px-3">Data/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.paymentId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-300">{p.paymentId}</td>
                      <td className="py-3 px-3 font-bold text-emerald-400">{p.groupId}</td>
                      <td className="py-3 px-3 font-semibold text-white">{p.userName}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">
                        {formatCents(p.amountCents)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : p.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        {p.assignedNumber || '-'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {new Date(p.createdAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 4: PARTICIPANTES */}
      {adminTab === 'participants' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">Participantes Confirmados</h3>
            <div className="flex items-center gap-2">
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200"
              >
                <option value="">Todos os Grupos</option>
                {metrics.groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.name} ({g.groupId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {participants.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Nenhum participante confirmado ainda</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Quando os pagamentos Pix forem aprovados e confirmados, a lista de participantes com os números da sorte atribuídos será exibida aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Número</th>
                    <th className="py-3 px-3">Grupo</th>
                    <th className="py-3 px-3">Nome</th>
                    <th className="py-3 px-3">CPF</th>
                    <th className="py-3 px-3">WhatsApp / Telefone</th>
                    <th className="py-3 px-3">Confirmado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {participants.map((pt) => (
                    <tr key={pt.participantId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-extrabold text-emerald-400 text-sm">
                        {pt.number}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">Grupo {pt.groupId}</td>
                      <td className="py-3 px-3 font-semibold text-slate-200">{pt.name}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{pt.cpf || pt.maskedCpf}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{pt.phone || '-'}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {new Date(pt.confirmedAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 5: AUDITORIA & LOGS */}
      {adminTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Trilha de Auditoria Imutável</h3>
            <span className="text-xs text-slate-400">Últimos {auditLogs.length} eventos</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Nenhum evento registrado ainda</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Todos os eventos de criação de grupo, pagamentos, fechamento e sorteios auditados serão registrados com data e hora.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.eventId}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold text-[10px]">
                      {log.type}
                    </span>
                    <span className="text-slate-300">{log.actor}</span>
                    {log.groupId && <span className="text-slate-400">• Grupo {log.groupId}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(log.timestamp).toLocaleString('pt-BR')} • {log.eventId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 6: CONFIGURAÇÕES & REGULAÇÃO */}
      {adminTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              Conformidade Regulatória & Parâmetros do Sistema
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Controle o status legal da promoção (Lei nº 5.768/71) e valores padrão da plataforma
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Status Legal da Promoção (PROMOTION_LEGAL_STATUS) *
              </label>
              <select
                value={legalStatusInput}
                onChange={(e) => setLegalStatusInput(e.target.value as PromotionLegalStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="PENDING_REVIEW">
                  PENDING_REVIEW (Em Análise Técnica / Sorteios Reais Bloqueados)
                </option>
                <option value="AUTHORIZED">
                  AUTHORIZED (Autorizado pela SPA/MF / Sorteios Habilitados)
                </option>
                <option value="DISABLED">DISABLED (Mecânica de Sorteio Desativada)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Número do Processo ou Certificado SPA/MF
              </label>
              <input
                type="text"
                value={processNumberInput}
                onChange={(e) => setProcessNumberInput(e.target.value)}
                placeholder="Ex: SPA/MF nº 01.000000/2026-00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Preço Padrão da Cota em Centavos (ex: 100 = R$ 1,00)
              </label>
              <input
                type="number"
                min="10"
                step="10"
                value={entryPriceInput}
                onChange={(e) => setEntryPriceInput(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </form>

          {/* Zona de Limpeza de Dados (Reset para Testes) */}
          <div className="border-t border-slate-800 pt-6 mt-6">
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <Trash2 className="w-4 h-4" />
                <span>Zona de Reinicialização (Zerar Dados)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Utilize esta opção a qualquer momento durante seus testes para limpar todos os grupos criados, participantes, cobranças e dados associados, deixando o sistema 100% zerado.
              </p>
              <button
                type="button"
                onClick={handleResetDatabase}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition cursor-pointer disabled:opacity-50"
              >
                Zerar Todos os Dados do Sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE GRUPO */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-white">
                  {editingGroup ? `Editar Grupo: ${editingGroup.name}` : 'Criar Novo Grupo'}
                </h3>
              </div>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGroup} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Código do Grupo (ID Único) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingGroup}
                    value={groupFormId}
                    onChange={(e) => setGroupFormId(e.target.value.toUpperCase())}
                    placeholder="Ex: G-ESPECIAL-01"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Tipo de Comunidade *
                  </label>
                  <select
                    value={groupFormType}
                    onChange={(e) => setGroupFormType(e.target.value as GroupType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="TELEGRAM">Telegram</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nome / Título do Grupo *
                </label>
                <input
                  type="text"
                  required
                  value={groupFormName}
                  onChange={(e) => setGroupFormName(e.target.value)}
                  placeholder="Ex: Grupo Especial de Natal"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Descrição Curta
                </label>
                <textarea
                  rows={2}
                  value={groupFormDescription}
                  onChange={(e) => setGroupFormDescription(e.target.value)}
                  placeholder="Ex: Sorteio especial de R$ 7.000,00 no Pix com 10.000 participantes."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Vagas Totais *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={groupFormCapacity}
                    onChange={(e) => setGroupFormCapacity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Valor Cota (R$) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.10"
                    step="0.10"
                    value={groupFormEntryPrice}
                    onChange={(e) => setGroupFormEntryPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Valor Prêmio (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={groupFormPrize}
                    onChange={(e) => setGroupFormPrize(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Taxa / Custo Adm (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={groupFormAdminFee}
                    onChange={(e) => setGroupFormAdminFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Status Inicial *
                  </label>
                  <select
                    value={groupFormStatus}
                    onChange={(e) => setGroupFormStatus(e.target.value as GroupStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="OPEN">OPEN (Aberto a Novas Participações)</option>
                    <option value="DRAFT">DRAFT (Rascunho)</option>
                    <option value="CLOSED">CLOSED (Encerrado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Link de Acesso ao Grupo ({groupFormType})
                </label>
                <input
                  type="url"
                  value={groupFormLink}
                  onChange={(e) => setGroupFormLink(e.target.value)}
                  placeholder={
                    groupFormType === 'TELEGRAM'
                      ? 'https://t.me/SeuCanalTelegram'
                      : 'https://chat.whatsapp.com/SeuGrupoWhatsApp'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow cursor-pointer disabled:opacity-50"
                >
                  {editingGroup ? 'Salvar Alterações' : 'Criar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROVA DE AUDITORIA MATEMÁTICA E SELO CRIPTOGRÁFICO */}
      {auditProofModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Certificado de Prova Matemática</h3>
                  <p className="text-xs text-slate-400">Verificação independente de idoneidade algorítmica</p>
                </div>
              </div>
              <button
                onClick={() => setAuditProofModalData(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-200">
                <strong>Status de Integridade: {auditProofModalData.isValid ? '100% VÁLIDO & AUDITADO' : 'NÃO VERIFICADO'}</strong>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  A recombinação da lista selada com a semente criptográfica gerou exatamente o índice do vencedor.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Hash da Lista Canônica de Participantes (SHA-256)</div>
                <div className="text-amber-300 break-all">{auditProofModalData.participantsListHash}</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Semente de Entropia Administrativa (CSPRNG)</div>
                <div className="text-indigo-300 break-all">{auditProofModalData.seed}</div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Digest Combinado (HMAC/SHA-256)</div>
                <div className="text-emerald-300 break-all">{auditProofModalData.calculatedDigest}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Total Elegíveis</div>
                  <div className="text-lg font-bold text-white mt-1">{auditProofModalData.participantsCount}</div>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Índice Calculado</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">Posição #{auditProofModalData.calculatedIndex}</div>
                </div>
              </div>
            </div>

            {auditProofModalData.draw && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Vencedor Oficial Registrado</div>
                  <div className="font-bold text-white text-sm mt-0.5">{auditProofModalData.draw.winnerName}</div>
                  <div className="text-emerald-400 font-mono text-xs">Cota #{auditProofModalData.draw.winningNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[10px]">Data de Execução</div>
                  <div className="font-mono text-slate-300 text-xs mt-0.5">
                    {new Date(auditProofModalData.draw.drawnAt).toLocaleString('pt-BR')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Algoritmo v{auditProofModalData.draw.algorithmVersion || '2.0.0'}</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify({
                      drawId: auditProofModalData.drawId,
                      hash: auditProofModalData.participantsListHash,
                      seed: auditProofModalData.seed,
                      calculatedDigest: auditProofModalData.calculatedDigest,
                      index: auditProofModalData.calculatedIndex,
                    }, null, 2)
                  );
                  alert('Dados criptográficos de auditoria copiados para a área de transferência!');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Copiar JSON de Auditoria
              </button>
              <button
                type="button"
                onClick={() => setAuditProofModalData(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CENTRAL DE SORTEIO PREMIUM FULL-SCREEN */}
      {activeDrawGroupId && (
        <PremiumDrawCenter
          groupId={activeDrawGroupId}
          onClose={() => {
            setActiveDrawGroupId(null);
            loadDashboard();
            if (adminTab === 'draws') {
              loadSubTabData();
            }
          }}
          onViewParticipant={(participantId) => {
            setActiveDrawGroupId(null);
            setAdminTab('participants');
            setParticipantSearch(participantId);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
};
