import {
  Group,
  Payment,
  Participant,
  DrawAuditRecord,
  AuditLog,
  DashboardMetrics,
  SystemConfig,
} from '../types';

const BASE_URL = '/api';

export const api = {
  // Grupos
  async getGroups(): Promise<{ groups: Group[]; config: Partial<SystemConfig> }> {
    const res = await fetch(`${BASE_URL}/groups`);
    if (!res.ok) throw new Error('Falha ao carregar grupos.');
    return res.json();
  },

  async getGroup(groupId: string): Promise<{ group: Group }> {
    const res = await fetch(`${BASE_URL}/groups/${groupId}`);
    if (!res.ok) throw new Error('Falha ao carregar grupo.');
    return res.json();
  },

  async createGroup(groupData: import('../types').CreateGroupInput): Promise<{ group: Group }> {
    const res = await fetch(`${BASE_URL}/admin/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao criar grupo.');
    return json;
  },

  async updateGroup(groupId: string, groupData: import('../types').UpdateGroupInput): Promise<{ group: Group }> {
    const res = await fetch(`${BASE_URL}/admin/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao atualizar grupo.');
    return json;
  },

  async deleteGroup(groupId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/admin/groups/${groupId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao excluir grupo.');
    return json;
  },

  // Pagamentos Pix
  async createPixPayment(data: {
    groupId: string;
    userName: string;
    userCpf: string;
    userEmail: string;
    userPhone: string;
  }): Promise<{ payment: Payment }> {
    const res = await fetch(`${BASE_URL}/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao gerar Pix.');
    return json;
  },

  async getPaymentStatus(paymentId: string): Promise<{ payment: Payment; participant: Participant | null }> {
    const res = await fetch(`${BASE_URL}/payments/${paymentId}`);
    if (!res.ok) throw new Error('Falha ao consultar status de pagamento.');
    return res.json();
  },

  // Participantes
  async searchParticipants(query: string): Promise<{ participants: Participant[] }> {
    const res = await fetch(`${BASE_URL}/participants/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Erro ao pesquisar participantes.');
    }
    return res.json();
  },

  // Sorteios e Auditoria Pública
  async getDraws(): Promise<{ draws: DrawAuditRecord[] }> {
    const res = await fetch(`${BASE_URL}/draws`);
    if (!res.ok) throw new Error('Falha ao carregar sorteios.');
    return res.json();
  },

  async getDraw(drawId: string): Promise<{ draw: DrawAuditRecord }> {
    const res = await fetch(`${BASE_URL}/draws/${drawId}`);
    if (!res.ok) throw new Error('Falha ao consultar sorteio.');
    return res.json();
  },

  async verifyDraw(drawId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/draws/${drawId}/verify`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Falha ao verificar matemática do sorteio.');
    return res.json();
  },

  // Painel Administrativo
  async getAdminDashboard(): Promise<DashboardMetrics> {
    const res = await fetch(`${BASE_URL}/admin/dashboard`);
    if (!res.ok) throw new Error('Falha ao carregar métricas administrativas.');
    return res.json();
  },

  async getAdminPayments(limit = 100): Promise<{ payments: Payment[] }> {
    const res = await fetch(`${BASE_URL}/admin/payments?limit=${limit}`);
    if (!res.ok) throw new Error('Falha ao carregar pagamentos.');
    return res.json();
  },

  async getAdminParticipants(groupId?: string, q?: string): Promise<{ participants: Participant[] }> {
    const params = new URLSearchParams();
    if (groupId) params.append('groupId', groupId);
    if (q) params.append('q', q);
    const res = await fetch(`${BASE_URL}/admin/participants?${params.toString()}`);
    if (!res.ok) throw new Error('Falha ao carregar participantes.');
    return res.json();
  },

  async getAdminAuditLogs(limit = 100, type?: string, groupId?: string): Promise<{ logs: AuditLog[] }> {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (type) params.append('type', type);
    if (groupId) params.append('groupId', groupId);
    const res = await fetch(`${BASE_URL}/admin/audit-logs?${params.toString()}`);
    if (!res.ok) throw new Error('Falha ao carregar logs de auditoria.');
    return res.json();
  },

  async updateGroupCapacity(groupId: string, capacity: number): Promise<{ group: Group }> {
    const res = await fetch(`${BASE_URL}/admin/groups/${groupId}/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao alterar capacidade.');
    return json;
  },

  async getEligibleDrawData(groupId: string): Promise<{
    groupId: string;
    groupName: string;
    capacity: number;
    entryPriceCents: number;
    prizeAmountCents: number;
    status: string;
    drawStatus: string;
    alreadyDrawn: boolean;
    eligibleParticipantsCount: number;
    existingDraw: DrawAuditRecord | null;
    sampleNames: string[];
    promotionLegalStatus: string;
  }> {
    const res = await fetch(`${BASE_URL}/admin/draws/${groupId}/eligible`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao carregar dados do sorteio.');
    return json;
  },

  async getAdminDrawsHistory(): Promise<{ draws: DrawAuditRecord[] }> {
    const res = await fetch(`${BASE_URL}/admin/draws/history`);
    if (!res.ok) throw new Error('Falha ao carregar histórico de sorteios.');
    return res.json();
  },

  async closeGroup(groupId: string): Promise<{ group: Group }> {
    const res = await fetch(`${BASE_URL}/admin/groups/${groupId}/close`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao fechar grupo.');
    return json;
  },

  async prepareDraw(groupId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/draws/${groupId}/prepare`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao preparar sorteio.');
    return json;
  },

  async executeDraw(groupId: string, entropySeed?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/draws/${groupId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entropySeed }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao executar sorteio.');
    return json;
  },

  async updateConfig(config: Partial<SystemConfig>): Promise<{ config: SystemConfig }> {
    const res = await fetch(`${BASE_URL}/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro ao atualizar configurações.');
    return json;
  },

  async simulateWebhookPayment(paymentId: string, repeatTimes = 1): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/simulate-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, repeatTimes }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro na simulação do webhook.');
    return json;
  },

  async runConcurrencyTest(): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/test-concurrency`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro no teste de concorrência.');
    return json;
  },

  async resetDatabase(): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/reset`, {
      method: 'POST',
    });
    return res.json();
  },
};
