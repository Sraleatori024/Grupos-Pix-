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

async function requestJson<T>(url: string, options?: RequestInit, retries = 1): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    let data: any;
    if (contentType.includes('application/json') || (text.startsWith('{') || text.startsWith('['))) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || `Resposta inválida do servidor (${res.status})` };
      }
    } else {
      data = { error: text || `Erro no servidor (${res.status}: ${res.statusText})` };
    }

    if (!res.ok) {
      const errorMessage = data?.error || data?.message || `Erro na requisição (${res.status})`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (err: any) {
    if (retries > 0 && (!err?.message || err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
      await new Promise((r) => setTimeout(r, 400));
      return requestJson<T>(url, options, retries - 1);
    }
    throw err;
  }
}

export const api = {
  // Grupos
  async getGroups(): Promise<{ groups: Group[]; config: Partial<SystemConfig> }> {
    return requestJson<{ groups: Group[]; config: Partial<SystemConfig> }>(`${BASE_URL}/groups`);
  },

  async getGroup(groupId: string): Promise<{ group: Group }> {
    return requestJson<{ group: Group }>(`${BASE_URL}/groups/${groupId}`);
  },

  async createGroup(groupData: import('../types').CreateGroupInput): Promise<{ group: Group }> {
    return requestJson<{ group: Group }>(`${BASE_URL}/admin/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupData),
    });
  },

  async updateGroup(groupId: string, groupData: import('../types').UpdateGroupInput): Promise<{ group: Group }> {
    return requestJson<{ group: Group }>(`${BASE_URL}/admin/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupData),
    });
  },

  async deleteGroup(groupId: string): Promise<{ success: boolean; message: string }> {
    return requestJson<{ success: boolean; message: string }>(`${BASE_URL}/admin/groups/${groupId}`, {
      method: 'DELETE',
    });
  },

  // Pagamentos Pix
  async createPixPayment(data: {
    groupId: string;
    userName: string;
    userCpf: string;
    userEmail: string;
    userPhone: string;
  }): Promise<{ payment: Payment }> {
    return requestJson<{ payment: Payment }>(`${BASE_URL}/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async getPaymentStatus(paymentId: string): Promise<{ payment: Payment; participant: Participant | null }> {
    return requestJson<{ payment: Payment; participant: Participant | null }>(`${BASE_URL}/payments/${paymentId}`);
  },

  // Participantes
  async searchParticipants(query: string): Promise<{ participants: Participant[] }> {
    return requestJson<{ participants: Participant[] }>(`${BASE_URL}/participants/search?q=${encodeURIComponent(query)}`);
  },

  // Sorteios e Auditoria Pública
  async getDraws(): Promise<{ draws: DrawAuditRecord[] }> {
    return requestJson<{ draws: DrawAuditRecord[] }>(`${BASE_URL}/draws`);
  },

  async getDraw(drawId: string): Promise<{ draw: DrawAuditRecord }> {
    return requestJson<{ draw: DrawAuditRecord }>(`${BASE_URL}/draws/${drawId}`);
  },

  async verifyDraw(drawId: string): Promise<any> {
    return requestJson<any>(`${BASE_URL}/draws/${drawId}/verify`, {
      method: 'POST',
    });
  },

  // Painel Administrativo
  async getAdminDashboard(): Promise<DashboardMetrics> {
    return requestJson<DashboardMetrics>(`${BASE_URL}/admin/dashboard`);
  },

  async getAdminPayments(limit = 100): Promise<{ payments: Payment[] }> {
    return requestJson<{ payments: Payment[] }>(`${BASE_URL}/admin/payments?limit=${limit}`);
  },

  async getAdminParticipants(groupId?: string, q?: string): Promise<{ participants: Participant[] }> {
    const params = new URLSearchParams();
    if (groupId) params.append('groupId', groupId);
    if (q) params.append('q', q);
    return requestJson<{ participants: Participant[] }>(`${BASE_URL}/admin/participants?${params.toString()}`);
  },

  async getAdminAuditLogs(limit = 100, type?: string, groupId?: string): Promise<{ logs: AuditLog[] }> {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (type) params.append('type', type);
    if (groupId) params.append('groupId', groupId);
    return requestJson<{ logs: AuditLog[] }>(`${BASE_URL}/admin/audit-logs?${params.toString()}`);
  },

  async updateGroupCapacity(groupId: string, capacity: number): Promise<{ group: Group }> {
    return requestJson<{ group: Group }>(`${BASE_URL}/admin/groups/${groupId}/capacity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity }),
    });
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
    return requestJson<{
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
    }>(`${BASE_URL}/admin/draws/${groupId}/eligible`);
  },

  async getAdminDrawsHistory(): Promise<{ draws: DrawAuditRecord[] }> {
    return requestJson<{ draws: DrawAuditRecord[] }>(`${BASE_URL}/admin/draws/history`);
  },

  async closeGroup(groupId: string): Promise<{ group: Group }> {
    return requestJson<{ group: Group }>(`${BASE_URL}/admin/groups/${groupId}/close`, {
      method: 'POST',
    });
  },

  async prepareDraw(groupId: string): Promise<any> {
    return requestJson<any>(`${BASE_URL}/admin/draws/${groupId}/prepare`, {
      method: 'POST',
    });
  },

  async executeDraw(groupId: string, entropySeed?: string, forceRedraw = false): Promise<any> {
    return requestJson<any>(`${BASE_URL}/admin/draws/${groupId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entropySeed, forceRedraw }),
    });
  },

  async resetGroupDraw(groupId: string): Promise<{ success: boolean; message: string }> {
    return requestJson<{ success: boolean; message: string }>(`${BASE_URL}/admin/draws/${groupId}/reset`, {
      method: 'POST',
    });
  },

  async updateConfig(config: Partial<SystemConfig>): Promise<{ config: SystemConfig }> {
    return requestJson<{ config: SystemConfig }>(`${BASE_URL}/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  async simulateWebhookPayment(paymentId: string, repeatTimes = 1): Promise<any> {
    return requestJson<any>(`${BASE_URL}/admin/simulate-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, repeatTimes }),
    });
  },

  async runConcurrencyTest(): Promise<any> {
    return requestJson<any>(`${BASE_URL}/admin/test-concurrency`, {
      method: 'POST',
    });
  },

  async seed10kGroup(count = 10000): Promise<{ success: boolean; message: string; group: Group }> {
    return requestJson<{ success: boolean; message: string; group: Group }>(`${BASE_URL}/admin/seed-10k`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
  },

  async resetDatabase(): Promise<any> {
    return requestJson<any>(`${BASE_URL}/admin/reset`, {
      method: 'POST',
    });
  },
};
