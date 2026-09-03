import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Group, Payment, Participant } from '../types';
import { api } from '../services/api';

interface PixCheckoutModalProps {
  group: Group;
  entryPriceCents?: number;
  onClose: () => void;
  onSuccess: (payment: Payment, participant: Participant) => void;
}

export const PixCheckoutModal: React.FC<PixCheckoutModalProps> = ({
  group,
  entryPriceCents,
  onClose,
  onSuccess,
}) => {
  // Form State
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  // Payment Flow State
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [confirmedParticipant, setConfirmedParticipant] = useState<Participant | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Group price in cents
  const actualPriceCents = group.entryPriceCents || entryPriceCents || 100;
  const formattedPrice = `R$ ${(actualPriceCents / 100).toFixed(2).replace('.', ',')}`;

  // CPF Mask (000.000.000-00)
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    if (val.length > 9) {
      val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else if (val.length > 6) {
      val = val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (val.length > 3) {
      val = val.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    setCpf(val);
  };

  // Phone Mask ((00) 00000-0000)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    if (val.length > 10) {
      val = val.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (val.length > 6) {
      val = val.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (val.length > 2) {
      val = val.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    setPhone(val);
  };

  // Handle Form Submission -> Create Pix Payment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 3) {
      setFormError('Por favor, informe seu nome completo (mínimo 3 caracteres).');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      setFormError('Informe um WhatsApp / Celular brasileiro válido com DDD (ex: 11 99999-8888).');
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setFormError('Informe um CPF brasileiro válido com 11 dígitos.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.createPixPayment({
        groupId: group.groupId,
        userName: cleanName,
        userCpf: cleanCpf,
        userEmail: email.trim() || `${cleanPhone}@participante.plataforma.com`,
        userPhone: cleanPhone,
      });
      setPayment(res.payment);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao gerar cobrança Pix.');
    } finally {
      setLoading(false);
    }
  };

  // Polling para detecção automática do webhook do gateway
  useEffect(() => {
    if (!payment || payment.status === 'PAID') return;

    const interval = setInterval(async () => {
      try {
        setPollCount((prev) => prev + 1);
        const res = await api.getPaymentStatus(payment.paymentId);
        if (res.payment.status === 'PAID' && res.participant) {
          setPayment(res.payment);
          setConfirmedParticipant(res.participant);
          onSuccess(res.payment, res.participant);
          clearInterval(interval);
        }
      } catch (err) {
        console.warn('Erro durante polling do Pix:', err);
      }
    }, 2500);

    pollingRef.current = interval;
    return () => clearInterval(interval);
  }, [payment, onSuccess]);

  // Copiar código Pix
  const handleCopyPix = () => {
    if (!payment?.pixCopiaECola) return;
    navigator.clipboard.writeText(payment.pixCopiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Copiar link do grupo
  const handleCopyGroupLink = () => {
    if (!group.groupLink) return;
    navigator.clipboard.writeText(group.groupLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-base">
              {group.groupType === 'TELEGRAM' ? (
                <Send className="w-5 h-5 text-sky-400" />
              ) : (
                <MessageCircle className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base line-clamp-1">
                {group.name}
              </h3>
              <p className="text-xs text-slate-400">
                Valor: <span className="font-bold text-emerald-400">{formattedPrice}</span> • Vagas:{' '}
                {group.confirmedParticipants.toLocaleString('pt-BR')} /{' '}
                {group.capacity.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* ESTADO 1: FORMULÁRIO DE DADOS */}
          {!payment && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 text-xs text-slate-300 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  Seus dados garantem a emissão oficial da cobrança Pix e a atribuição imediata do seu{' '}
                  <strong className="text-emerald-300">número da sorte</strong> após confirmação bancária.
                </div>
              </div>

              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo da Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    WhatsApp / Celular *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    CPF *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  E-mail (Opcional)
                </label>
                <input
                  type="email"
                  placeholder="seuemail@exemplo.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gerando Cobrança Pix BACEN...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      Gerar QR Code Pix ({formattedPrice})
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ESTADO 2: AGUARDANDO PAGAMENTO PIX */}
          {payment && payment.status !== 'PAID' && (
            <div className="space-y-5">
              {/* QR Code Canvas */}
              <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl shadow-inner border border-slate-200">
                {payment.pixQrCode ? (
                  <img
                    src={payment.pixQrCode}
                    alt="QR Code Pix"
                    className="w-52 h-52 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-52 h-52 bg-slate-100 flex items-center justify-center text-slate-400">
                    Carregando QR Code...
                  </div>
                )}
                <div className="mt-3 text-center">
                  <span className="inline-block font-mono font-extrabold text-slate-900 text-xl">
                    {formattedPrice}
                  </span>
                  <p className="text-xs text-slate-500">Escaneie com o aplicativo do seu banco</p>
                </div>
              </div>

              {/* Pix Copia e Cola */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Código Pix Copia e Cola</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Padrão BACEN BR Code</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={payment.pixCopiaECola || ''}
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-300 select-all truncate"
                  />
                  <button
                    onClick={handleCopyPix}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      copied
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status de Polling Oficial */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative"></span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      Aguardando confirmação bancária
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Webhook oficial ativo • Consulta #{pollCount}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>30 min</span>
                </div>
              </div>
            </div>
          )}

          {/* ESTADO 3: PAGAMENTO CONFIRMADO & NÚMERO ATRIBUÍDO & LINK DO GRUPO */}
          {payment && payment.status === 'PAID' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Check className="w-8 h-8 font-bold" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Pagamento Confirmado via Webhook
                </span>
                <h4 className="text-2xl font-extrabold text-white">
                  Participação Confirmada!
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Parabéns, <strong>{payment.userName}</strong>! Seu número foi gerado no{' '}
                  <strong className="text-emerald-300">{group.name}</strong>.
                </p>
              </div>

              {/* Card de Número de Participação */}
              <div className="p-5 bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-emerald-500/40 rounded-2xl shadow-xl">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Seu Número da Sorte
                </p>
                <div className="text-4xl sm:text-5xl font-extrabold font-mono text-emerald-400 tracking-widest my-3">
                  {confirmedParticipant?.number || payment.assignedNumber || '00001'}
                </div>
                <div className="grid grid-cols-2 gap-2 text-left pt-3 border-t border-slate-700/60 text-xs text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">ID de Participante:</span>
                    <span className="font-mono text-[11px] truncate block text-slate-200">
                      {confirmedParticipant?.participantId || payment.participantId}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Data/Hora Confirmação:</span>
                    <span className="font-mono text-[11px] text-slate-200">
                      {new Date(payment.paidAt || Date.now()).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Link do Grupo WhatsApp / Telegram */}
              {group.groupLink && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {group.groupType === 'TELEGRAM' ? (
                        <Send className="w-5 h-5 text-sky-400" />
                      ) : (
                        <MessageCircle className="w-5 h-5 text-emerald-400" />
                      )}
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Comunidade Oficial do Grupo ({group.groupType})
                      </span>
                    </div>
                    <button
                      onClick={handleCopyGroupLink}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Link copiado!' : 'Copiar link'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-300">
                    Acesse o grupo oficial para acompanhar avisos em tempo real, fechamento de cotas e o sorteio auditado:
                  </p>
                  <a
                    href={group.groupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all ${
                      group.groupType === 'TELEGRAM'
                        ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }`}
                  >
                    <span>Entrar no {group.groupType === 'TELEGRAM' ? 'Canal do Telegram' : 'Grupo do WhatsApp'}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-all cursor-pointer"
                >
                  Concluir e Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

