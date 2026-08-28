# Plataforma Técnica de Grupos de Participantes, Cobranças Pix e Sorteios Auditáveis

Sistema robusto, seguro e em conformidade com a legislação brasileira (Lei nº 5.768/1971 e regulamentações SPA/MF) para gestão de 10 grupos (A até J) com até 10.000 participantes por grupo (totalizando 100.000 vagas), concorrência atômica, webhooks Pix idempotentes e motor de sorteio determinístico criptográfico.

---

## 🏗️ 1. Arquitetura do Sistema

```
[ Usuário / Participante ]   [ Gateway Pix (Webhook) ]   [ Administrador / Auditor ]
          │                           │                            │
          ▼                           ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Frontend: React 19 + Tailwind CSS                     │
│  - Seleção de Grupos (A-J)          - Checkout Pix Copia e Cola / QR Code   │
│  - Área do Participante (Busca)     - Auditoria Pública SHA-256             │
│  - Dashboard Admin com Métricas R$  - Alerta de Conformidade Legal SPA/MF   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ REST API / Webhooks
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                    Backend: Node.js + Express (TypeScript)                  │
│  ├── /server/routes.ts        -> Endpoints REST, Auth & Webhooks            │
│  ├── /server/db.ts            -> Camada Transacional + Mutex Anti-Overbook  │
│  ├── /server/pix.ts           -> Gerador EMV BACEN BR Code & QR Code        │
│  ├── /server/drawEngine.ts    -> Motor Criptográfico Determinístico SHA-256 │
│  └── /server/audit.ts         -> Registro Imutável de Eventos e Auditoria   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚖️ 2. Conformidade Legal Brasileira (Promoções Comerciais)

Antes de habilitar sorteios com pagamento no Brasil:
- **Marco Legal**: A distribuição gratuita de prêmios por meio de sorteio, vale-brinde ou concurso com fins promocionais requer autorização prévia da **Secretaria de Prêmios e Apostas do Ministério da Fazenda (SPA/MF)**, nos termos da Lei nº 5.768/1971 e do Decreto nº 70.951/1972.
- **Parâmetro `PROMOTION_LEGAL_STATUS`**:
  - `PENDING_REVIEW`: Status padrão. Sorteios reais bloqueados no backend. Exibe aviso de conformidade.
  - `DISABLED`: Mecânica de premiação totalmente desabilitada.
  - `AUTHORIZED`: Habilitada somente após inserção do número de certificado de autorização SPA/MF.

---

## 🚀 3. Guia de Configuração e Execução

### 3.1. Configuração do Gateway Pix
1. Obtenha sua Chave Pix (E-mail, CNPJ ou Aleatória) no seu provedor (Mercado Pago, EFI/Gerencianet, Asaas, etc.).
2. Cadastre o Webhook no painel do gateway apontando para:
   `https://seu-dominio.com.br/api/webhooks/payment`
3. Configure o segredo do webhook no arquivo `.env`:
   `PIX_WEBHOOK_SECRET=seu_segredo_aqui`

### 3.2. Idempotência e Tratamento de Concorrência
- O backend verifica o `rawEventId` e o `gatewayTransactionId`. Repetições do mesmo webhook retornam HTTP 200 sem duplicar ingressos nem gerar novos números.
- Cada grupo possui um **Lock de Mutex Transacional**. Se chegarem 10 webhooks simultâneos para apenas 2 vagas restantes, exatamente 2 serão confirmados (com números sequenciais `09999` e `10000`) e os outros 8 serão rejeitados/estornados como `REFUNDED`, impedindo 100% de overbooking.

### 3.3. Execução dos Testes Automatizados
```bash
npm test
```
A suíte roda testes de:
1. Cálculos financeiros e precisão em centavos inteiros.
2. Idempotência estrita do webhook.
3. Concorrência atômica anti-overbooking (10 requisições simultâneas para 2 vagas).
4. Determinismo e auditoria matemática do motor de sorteio SHA-256.

---

## 🔒 4. Regras de Segurança do Firestore (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Grupos: Leitura pública, escrita apenas por backend/admin
    match /groups/{groupId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
    
    // Participantes: Leitura apenas de dados não-sensíveis, escrita proibida para clientes
    match /participants/{participantId} {
      allow read: if true;
      allow write: if false; // Apenas backend via Firebase Admin SDK
    }
    
    // Cobranças: Leitura pelo criador, alteração proibida para clientes
    match /payments/{paymentId} {
      allow read: if request.auth != null && (request.auth.uid == resource.data.userId || request.auth.token.role == 'admin');
      allow write: if false; // Apenas backend após webhook
    }
    
    // Sorteios: Leitura pública, gravação única imutável
    match /draws/{drawId} {
      allow read: if true;
      allow create: if request.auth != null && request.auth.token.role == 'admin' && !exists(/databases/$(database)/documents/draws/$(drawId));
      allow update, delete: if false; // Imutável
    }
    
    // Logs de auditoria: Leitura exclusiva de administradores, inserção apenas pelo backend
    match /auditLogs/{logId} {
      allow read: if request.auth != null && request.auth.token.role == 'admin';
      allow write: if false;
    }
  }
}
```
