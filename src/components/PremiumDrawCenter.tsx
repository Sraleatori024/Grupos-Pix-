import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Users,
  Award,
  CheckCircle2,
  Lock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Hash,
} from 'lucide-react';
import { DrawAuditRecord, Group } from '../types';
import { api } from '../services/api';

interface PremiumDrawCenterProps {
  groupId: string;
  onClose: () => void;
  onDrawCompleted?: (drawRecord: DrawAuditRecord) => void;
  onViewParticipant?: (participantId: string) => void;
  onViewAuditProof?: (drawId: string) => void;
}

type DrawState =
  | 'LOADING'
  | 'IDLE'
  | 'CONFIRMING'
  | 'REQUESTING'
  | 'COUNTDOWN'
  | 'SPINNING'
  | 'DECELERATING'
  | 'REVEALED'
  | 'ERROR';

// --- Sintetizador Web Audio API Nativo ---
class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playLever() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Som mecânico de catraca / alavanca
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio seguro
    }
  }

  playTick(pitchMod = 1.0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480 * pitchMod, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Audio seguro
    }
  }

  playCountdown(count: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const freq = count === 1 ? 880 : count === 2 ? 660 : 440;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio seguro
    }
  }

  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // Acorde Maior C5, E5, G5, C6
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0.15, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.9);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.95);
      });
    } catch {
      // Audio seguro
    }
  }
}

const sfx = new SoundEffects();

export const PremiumDrawCenter: React.FC<PremiumDrawCenterProps> = ({
  groupId,
  onClose,
  onDrawCompleted,
  onViewParticipant,
  onViewAuditProof,
}) => {
  const [state, setState] = useState<DrawState>('LOADING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [leverPulled, setLeverPulled] = useState<boolean>(false);

  // Dados do backend
  const [groupData, setGroupData] = useState<{
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
  } | null>(null);

  // Vencedor oficial vindo do servidor
  const [officialWinner, setOfficialWinner] = useState<{
    name: string;
    number: string;
    participantId: string;
    phoneMasked: string;
    maskedCpf: string;
  } | null>(null);

  const [officialDrawRecord, setOfficialDrawRecord] = useState<DrawAuditRecord | null>(null);

  // Estado da contagem e da animação do caça-níquel
  const [countdown, setCountdown] = useState<number>(3);
  const [displayedSlot, setDisplayedSlot] = useState<{
    prev: string;
    curr: string;
    next: string;
    num: string;
  }>({
    prev: '...',
    curr: 'Carregando...',
    next: '...',
    num: '-----',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationTimerRef = useRef<any>(null);
  const confettiParticles = useRef<any[]>([]);

  // Preferência de redução de movimento do sistema
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Carregar dados de elegibilidade pré-sorteio
  const loadEligibility = useCallback(async () => {
    try {
      setState('LOADING');
      setErrorMsg(null);
      const data = await api.getEligibleDrawData(groupId);
      setGroupData(data);

      if (data.alreadyDrawn && data.existingDraw) {
        setOfficialDrawRecord(data.existingDraw);
        setOfficialWinner({
          name: data.existingDraw.winnerName,
          number: data.existingDraw.winningNumber,
          participantId: data.existingDraw.winningParticipantId,
          phoneMasked: data.existingDraw.winnerPhoneMasked || '(11) 9XXXX-1234',
          maskedCpf: data.existingDraw.winnerMaskedCpf,
        });
        setDisplayedSlot({
          prev: 'Sorteio Oficial',
          curr: data.existingDraw.winnerName,
          next: `Cota #${data.existingDraw.winningNumber}`,
          num: data.existingDraw.winningNumber,
        });
        setState('REVEALED');
      } else {
        const pool = data.sampleNames.length > 0 ? data.sampleNames : ['Participante Oficial'];
        setDisplayedSlot({
          prev: pool[pool.length - 1] || '...',
          curr: pool[0] || 'Aguardando Sorteio',
          next: pool[1] || '...',
          num: '-----',
        });
        setState('IDLE');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados do grupo para sorteio.');
      setState('ERROR');
    }
  }, [groupId]);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state === 'IDLE' || state === 'REVEALED' || state === 'ERROR') {
          onClose();
        } else if (state === 'CONFIRMING') {
          setState('IDLE');
        }
      } else if (e.key === ' ' && state === 'IDLE') {
        e.preventDefault();
        handleTriggerLever();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, onClose]);

  // Sincronizar estado de som
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    sfx.enabled = next;
  };

  // Efeito de partículas de celebração (Canvas)
  const triggerConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#fbbf24', '#38bdf8', '#ffffff'];
    const particles: any[] = [];
    const count = prefersReducedMotion ? 25 : 120;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width * 0.5 + (Math.random() - 0.5) * 100,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 1.2) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        decay: Math.random() * 0.008 + 0.005,
      });
    }

    confettiParticles.current = particles;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;

      confettiParticles.current.forEach((p) => {
        if (p.opacity > 0.01) {
          alive++;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.35; // gravidade
          p.vx *= 0.98; // atrito
          p.rotation += p.rotSpeed;
          p.opacity -= p.decay;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive > 0) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    render();
  }, [prefersReducedMotion]);

  // Alavanca puxada pelo usuário
  const handleTriggerLever = () => {
    if (state !== 'IDLE') return;
    if (!groupData || groupData.eligibleParticipantsCount === 0) {
      setErrorMsg('Não é possível realizar sorteio sem participantes confirmados.');
      return;
    }
    sfx.playLever();
    setLeverPulled(true);
    setTimeout(() => setLeverPulled(false), 600);
    setState('CONFIRMING');
  };

  // Confirmar início do sorteio
  const handleConfirmDraw = async () => {
    setState('REQUESTING');
    setErrorMsg(null);

    try {
      // 1. O BACKEND DETERMINA O VENCEDOR DE FORMA SEGURA E AUDITÁVEL (CSPRNG)
      const res = await api.executeDraw(groupId);
      if (!res || !res.draw || !res.winner) {
        throw new Error('Servidor não retornou dados do vencedor.');
      }

      const winnerData = {
        name: res.winner.name,
        number: res.winner.number,
        participantId: res.winner.participantId,
        phoneMasked: res.winner.phoneMasked || res.draw.winnerPhoneMasked || '(11) 9XXXX-1234',
        maskedCpf: res.winner.maskedCpf || res.draw.winnerMaskedCpf,
      };

      setOfficialWinner(winnerData);
      setOfficialDrawRecord(res.draw);

      if (onDrawCompleted) {
        onDrawCompleted(res.draw);
      }

      // Se o usuário prefere redução de movimento, pular contagem longa
      if (prefersReducedMotion) {
        setState('REVEALED');
        sfx.playVictory();
        triggerConfetti();
        return;
      }

      // 2. INICIAR CONTAGEM REGRESSIVA VISUAL (3, 2, 1)
      setState('COUNTDOWN');
      setCountdown(3);
      sfx.playCountdown(3);

      setTimeout(() => {
        setCountdown(2);
        sfx.playCountdown(2);
      }, 1000);

      setTimeout(() => {
        setCountdown(1);
        sfx.playCountdown(1);
      }, 2000);

      // 3. INICIAR ROTAÇÃO VISUAL DO CAÇA-NÍQUEL (3 segundos de alta velocidade)
      setTimeout(() => {
        startSlotMachineAnimation(winnerData);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao processar sorteio no servidor.');
      setState('ERROR');
    }
  };

  // Motor da animação de caça-níquel (Puramente visual - o vencedor já é conhecido)
  const startSlotMachineAnimation = (winner: {
    name: string;
    number: string;
    participantId: string;
  }) => {
    setState('SPINNING');

    const pool =
      groupData?.sampleNames && groupData.sampleNames.length > 5
        ? groupData.sampleNames
        : [
            'MARIA SILVA',
            'CARLOS OLIVEIRA',
            'JOÃO SANTOS',
            'ANA PAULA',
            'PEDRO LIMA',
            'LUCAS FERREIRA',
            'JULIANA COSTA',
            'BRUNO ALMEIDA',
            'CAMILA SOUZA',
            'RODRIGO MARTINS',
          ];

    let speed = 40; // milissegundos por frame (muito rápido)
    let poolIndex = 0;
    const startTime = Date.now();
    const spinDuration = 3200; // 3.2s de rotação rápida
    const decelerateDuration = 2200; // 2.2s de desaceleração

    const spinStep = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed < spinDuration) {
        // Fase 1: Rotação Acelerada Máxima
        poolIndex = (poolIndex + 1) % pool.length;
        const prev = pool[(poolIndex + pool.length - 1) % pool.length];
        const curr = pool[poolIndex];
        const next = pool[(poolIndex + 1) % pool.length];
        const randomNum = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(5, '0');

        setDisplayedSlot({ prev, curr, next, num: randomNum });
        sfx.playTick(1.2);
        animationTimerRef.current = setTimeout(spinStep, speed);
      } else if (elapsed < spinDuration + decelerateDuration) {
        // Fase 2: Desaceleração Física Progressiva (Easing Exponencial)
        setState('DECELERATING');
        const decelProgress = (elapsed - spinDuration) / decelerateDuration;
        speed = 40 + Math.pow(decelProgress, 2.5) * 350; // De 40ms até ~390ms

        poolIndex = (poolIndex + 1) % pool.length;
        const prev = pool[(poolIndex + pool.length - 1) % pool.length];
        const curr = pool[poolIndex];
        const next = pool[(poolIndex + 1) % pool.length];
        const randomNum = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(5, '0');

        setDisplayedSlot({ prev, curr, next, num: randomNum });
        sfx.playTick(1.0 - decelProgress * 0.4);
        animationTimerRef.current = setTimeout(spinStep, speed);
      } else {
        // Fase 3: Parada Exata no Vencedor Oficial Selecionado pelo Servidor
        setDisplayedSlot({
          prev: pool[0] || 'Participante Confirmado',
          curr: winner.name,
          next: `Cota #${winner.number}`,
          num: winner.number,
        });

        setState('REVEALED');
        sfx.playVictory();
        triggerConfetti();
      }
    };

    spinStep();
  };

  // Limpeza de timers
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const formatCents = (cents?: number) => {
    if (!cents) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl text-slate-100 overflow-y-auto p-3 sm:p-6 animate-in fade-in duration-300">
      {/* Canvas de Partículas / Confetti */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-40"
      />

      {/* Caixa Principal da Central de Sorteio */}
      <div className="relative z-30 w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-slate-700/60 rounded-3xl shadow-[0_0_80px_rgba(16,185,129,0.15)] overflow-hidden flex flex-col my-auto">
        
        {/* Header Superior estilo Broadcast / Transmissão Oficial */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Central de Sorteio Premium
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  • Auditado SHA-256
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {groupData?.groupName || `Grupo ${groupId}`}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                soundOn
                  ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
              title={soundOn ? 'Desativar som' : 'Ativar som'}
              aria-label={soundOn ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {(state === 'IDLE' || state === 'REVEALED' || state === 'ERROR') && (
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
                title="Fechar (Esc)"
                aria-label="Fechar Central de Sorteio"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Corpo Principal da Central */}
        <div className="p-5 sm:p-8 space-y-6">
          
          {/* Mensagem de Erro se houver */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-3">
              <span>{errorMsg}</span>
              <button
                onClick={loadEligibility}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>
            </div>
          )}

          {/* Cards de Métricas Pré-Sorteio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Participantes Elegíveis</div>
                <div className="text-lg font-mono font-extrabold text-white">
                  {groupData?.eligibleParticipantsCount.toLocaleString('pt-BR') || 0}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Prêmio Principal</div>
                <div className="text-lg font-mono font-extrabold text-amber-400">
                  {formatCents(groupData?.prizeAmountCents)}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Integridade & CSPRNG</div>
                <div className="text-xs font-semibold text-cyan-300">
                  {groupData?.alreadyDrawn ? '✓ Sorteio Concluído' : 'Semente Criptográfica'}
                </div>
              </div>
            </div>
          </div>

          {/* PALCO CENTRAL - CAÇA-NÍQUEL / ROLETA FUTURISTA */}
          <div className="relative rounded-3xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-slate-800 p-6 sm:p-10 shadow-2xl overflow-hidden">
            {/* Linhas de grade e iluminação de fundo */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              
              {/* DISPLAY DA ROLETA / CAÇA-NÍQUEL */}
              <div className="w-full flex-1">
                
                {/* Se estiver no estado de contagem regressiva */}
                {state === 'COUNTDOWN' && (
                  <div className="py-12 text-center animate-in zoom-in duration-300">
                    <div className="inline-block text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 font-mono tracking-tighter drop-shadow-[0_0_35px_rgba(16,185,129,0.5)]">
                      {countdown}
                    </div>
                    <div className="text-xs sm:text-sm uppercase tracking-widest text-emerald-400 font-bold mt-2">
                      Iniciando Sorteio Auditado...
                    </div>
                  </div>
                )}

                {/* Se estiver no estado de Vencedor Revelado */}
                {state === 'REVEALED' && officialWinner && (
                  <div className="py-6 text-center space-y-4 animate-in zoom-in-90 duration-500">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                      <Sparkles className="w-4 h-4" />
                      <span>Vencedor Oficial Selecionado</span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-md">
                        {officialWinner.name}
                      </div>
                      <div className="text-sm sm:text-base font-mono font-bold text-slate-300">
                        {officialWinner.phoneMasked}
                      </div>
                    </div>

                    <div className="inline-block p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 shadow-inner">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Cota Vencedora Atribuída</div>
                      <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 tracking-wider">
                        #{officialWinner.number}
                      </div>
                    </div>

                    {officialDrawRecord && (
                      <div className="text-[11px] font-mono text-slate-400">
                        Hash SHA-256: <span className="text-emerald-400">{officialDrawRecord.participantsListHash.substring(0, 16)}...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Se estiver girando, desacelerando ou aguardando */}
                {(state === 'IDLE' || state === 'CONFIRMING' || state === 'REQUESTING' || state === 'SPINNING' || state === 'DECELERATING') && (
                  <div className="space-y-3">
                    <div className="text-[11px] text-center text-slate-400 uppercase tracking-wider font-semibold">
                      {state === 'SPINNING'
                        ? '🎰 Sorteando Vencedor...'
                        : state === 'DECELERATING'
                        ? '⏳ Desacelerando e Selando Resultado...'
                        : state === 'REQUESTING'
                        ? '🔒 Congelando Lista & Selecionando Vencedor no Servidor...'
                        : 'Aguardando Acionamento da Alavanca'}
                    </div>

                    {/* Janela Central Estilo Slot Machine */}
                    <div className="relative rounded-2xl bg-slate-950 border-2 border-slate-800 p-4 shadow-inner overflow-hidden">
                      {/* Linhas de leitura do centro */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-14 bg-emerald-500/10 border-y border-emerald-500/30 pointer-events-none" />

                      {/* Slot Top (anterior) */}
                      <div className="text-center py-1 text-xs text-slate-600 font-mono blur-[0.5px] truncate">
                        {displayedSlot.prev}
                      </div>

                      {/* Slot Center (Destaque Central) */}
                      <div className="text-center py-3">
                        <div className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight truncate px-2">
                          {displayedSlot.curr}
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          {displayedSlot.num !== '-----' ? `Cota #${displayedSlot.num}` : '-----'}
                        </div>
                      </div>

                      {/* Slot Bottom (próximo) */}
                      <div className="text-center py-1 text-xs text-slate-600 font-mono blur-[0.5px] truncate">
                        {displayedSlot.next}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* ÁREA DA ALAVANCA MECÂNICA / BOTÃO DE DISPARO */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 min-w-[200px]">
                
                {state === 'IDLE' && (
                  <div className="text-center space-y-3">
                    {/* Alavanca Visual 3D Interativa */}
                    <button
                      type="button"
                      onClick={handleTriggerLever}
                      className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
                      aria-label="Puxar alavanca para sortear"
                    >
                      {/* Manopla da Alavanca */}
                      <div
                        className={`w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 border-2 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center text-slate-950 font-black transition-transform duration-300 group-hover:scale-105 ${
                          leverPulled ? 'translate-y-12' : ''
                        }`}
                      >
                        <Trophy className="w-7 h-7 text-slate-950" />
                      </div>

                      {/* Eixo Metálico da Alavanca */}
                      <div
                        className={`w-3.5 h-16 bg-gradient-to-b from-slate-400 via-slate-600 to-slate-800 rounded-full border border-slate-500 shadow-md transition-all duration-300 ${
                          leverPulled ? 'h-8' : 'h-16'
                        }`}
                      />

                      {/* Base da Alavanca */}
                      <div className="w-16 h-6 rounded-lg bg-slate-800 border border-slate-700 shadow-inner" />
                    </button>

                    <div>
                      <button
                        onClick={handleTriggerLever}
                        className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                      >
                        Puxar Alavanca
                      </button>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        ou pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[9px]">Espaço</kbd>
                      </span>
                    </div>
                  </div>
                )}

                {(state === 'REQUESTING' || state === 'COUNTDOWN' || state === 'SPINNING' || state === 'DECELERATING') && (
                  <div className="text-center space-y-3 py-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto animate-spin">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Processando...
                    </div>
                  </div>
                )}

                {state === 'REVEALED' && (
                  <div className="text-center space-y-2 py-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="text-xs font-bold text-white uppercase">
                      Sorteio Concluído
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Resultado selado e gravado
                    </span>
                  </div>
                )}

              </div>

            </div>
          </div>

          {/* Modal / Diálogo de Confirmação Pré-Sorteio */}
          {state === 'CONFIRMING' && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>Pronto para sortear?</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Você está prestes a realizar o sorteio oficial para o grupo{' '}
                <strong className="text-white font-bold">{groupData?.groupName}</strong> com{' '}
                <strong className="text-emerald-400 font-bold">
                  {groupData?.eligibleParticipantsCount} participantes elegíveis
                </strong>{' '}
                e premiação de{' '}
                <strong className="text-amber-400 font-bold">
                  {formatCents(groupData?.prizeAmountCents)}
                </strong>.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                ⚠️ <strong>Atenção:</strong> O vencedor será determinado aleatoriamente pelo servidor via CSPRNG de alta entropia. O resultado será imediatamente congelado e registrado na auditoria, não podendo ser alterado.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setState('IDLE')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDraw}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Confirmar Sorteio</span>
                </button>
              </div>
            </div>
          )}

          {/* Ações Administrativas Pós-Sorteio */}
          {state === 'REVEALED' && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Resultado oficial e auditável com selo criptográfico.</span>
              </div>

              <div className="flex items-center gap-2">
                {officialWinner && onViewParticipant && (
                  <button
                    onClick={() => onViewParticipant(officialWinner.participantId)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Ver Participante</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {officialDrawRecord && onViewAuditProof && (
                  <button
                    onClick={() => onViewAuditProof(officialDrawRecord.drawId)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs border border-emerald-500/30 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>Detalhes do Sorteio</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Voltar ao Painel
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
