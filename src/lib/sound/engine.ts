'use client';

import { useSoundStore } from './store';
import type { SoundChannel, SoundPreset, ToneStep } from './types';

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const PRESET_CHANNEL: Record<SoundPreset, SoundChannel> = {
  'order-new': 'alerts',
  'order-ready': 'alerts',
  'ui-tap': 'ui',
  'ui-success': 'ui',
  'ui-error': 'ui',
  'call-ring': 'call',
};

/** รูปแบบเสียงสังเคราะห์ภายในระบบ (Zero external audio files) */
const PRESET_TONES: Record<SoundPreset, readonly ToneStep[]> = {
  'order-new': [
    { freq: 587.33, type: 'triangle', offsetSec: 0, durationSec: 0.14, gain: 0.8 },
    { freq: 880.0, type: 'triangle', offsetSec: 0.12, durationSec: 0.22, gain: 0.9 },
  ],
  'order-ready': [
    { freq: 523.25, type: 'sine', offsetSec: 0, durationSec: 0.12, gain: 0.7 },
    { freq: 659.25, type: 'sine', offsetSec: 0.1, durationSec: 0.12, gain: 0.75 },
    { freq: 783.99, type: 'sine', offsetSec: 0.2, durationSec: 0.22, gain: 0.85 },
  ],
  'ui-tap': [
    { freq: 640, type: 'sine', offsetSec: 0, durationSec: 0.045, gain: 0.35 },
  ],
  'ui-success': [
    { freq: 523.25, type: 'sine', offsetSec: 0, durationSec: 0.09, gain: 0.5 },
    { freq: 783.99, type: 'sine', offsetSec: 0.08, durationSec: 0.16, gain: 0.6 },
  ],
  'ui-error': [
    { freq: 320, type: 'sawtooth', offsetSec: 0, durationSec: 0.11, gain: 0.35 },
    { freq: 240, type: 'sawtooth', offsetSec: 0.1, durationSec: 0.16, gain: 0.35 },
  ],
  'call-ring': [
    { freq: 440, type: 'sine', offsetSec: 0, durationSec: 0.25, gain: 0.65 },
    { freq: 480, type: 'sine', offsetSec: 0.02, durationSec: 0.25, gain: 0.55 },
  ],
};

/**
 * Multi-Channel Sound Engine ทำงานบน Native Web Audio API 100%
 * Graph: Oscillator/Source -> Channel Gain -> DynamicsCompressor -> Master Gain -> Destination
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private channels: Partial<Record<SoundChannel, GainNode>> = {};
  private unsubscribeStore: (() => void) | null = null;

  private getAudioContextCtor(): typeof AudioContext | null {
    if (typeof window === 'undefined') return null;
    return window.AudioContext ?? (window as WebkitWindow).webkitAudioContext ?? null;
  }

  private ensureGraph(): AudioContext | null {
    if (this.ctx && this.ctx.state !== 'closed') {
      return this.ctx;
    }

    const Ctor = this.getAudioContextCtor();
    if (!Ctor) {
      useSoundStore.getState().setEngineStatus('unsupported');
      return null;
    }

    const ctx = new Ctor();
    const masterGain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();

    // ป้องกันเสียงแตกเมื่อมีแจ้งเตือนหลายเหตุการณ์พร้อมกัน
    compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    compressor.knee.setValueAtTime(18, ctx.currentTime);
    compressor.ratio.setValueAtTime(6, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    const alertsGain = ctx.createGain();
    const uiGain = ctx.createGain();
    const callGain = ctx.createGain();

    alertsGain.connect(compressor);
    uiGain.connect(compressor);
    callGain.connect(compressor);

    this.ctx = ctx;
    this.masterGain = masterGain;
    this.compressor = compressor;
    this.channels = {
      alerts: alertsGain,
      ui: uiGain,
      call: callGain,
    };

    ctx.onstatechange = () => {
      const store = useSoundStore.getState();
      store.setEngineStatus(ctx.state);
      if (ctx.state === 'running') {
        store.setNeedsUnlock(false);
      }
    };

    this.syncGains();
    if (!this.unsubscribeStore) {
      this.unsubscribeStore = useSoundStore.subscribe(() => {
        this.syncGains();
      });
    }

    useSoundStore.getState().setEngineStatus(ctx.state);
    return ctx;
  }

  private syncGains(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;

    const { enabled, volumes, muted } = useSoundStore.getState();
    const now = ctx.currentTime;

    this.masterGain?.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.015);

    (['alerts', 'ui', 'call'] as const).forEach((ch) => {
      const node = this.channels[ch];
      if (!node) return;
      const target = enabled && !muted[ch] ? volumes[ch] : 0;
      node.gain.setTargetAtTime(target, now, 0.015);
    });
  }

  /** คืนค่า AudioContext ปัจจุบัน (สร้าง Graph หากยังไม่เคยสร้าง) */
  getContext(): AudioContext | null {
    return this.ensureGraph();
  }

  /** คืนค่า Channel GainNode สำหรับต่อยอดโมดูลอื่น (เช่น AudioWorklet ใน Ticket 2) */
  getChannelNode(channel: SoundChannel): GainNode | null {
    this.ensureGraph();
    return this.channels[channel] ?? null;
  }

  /** ปลดล็อก AudioContext จาก User Gesture (Autoplay Policy) */
  async unlock(): Promise<boolean> {
    const ctx = this.ensureGraph();
    if (!ctx) return false;

    const store = useSoundStore.getState();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        store.setNeedsUnlock(true);
        return false;
      }
    }

    const isRunning = ctx.state === 'running';
    store.setEngineStatus(ctx.state);
    store.setNeedsUnlock(!isRunning);
    return isRunning;
  }

  /** เล่นเสียง Preset ที่สังเคราะห์ภายในระบบ */
  async playPreset(preset: SoundPreset): Promise<boolean> {
    const channel = PRESET_CHANNEL[preset];
    const store = useSoundStore.getState();
    if (!store.enabled || store.muted[channel] || store.volumes[channel] <= 0) {
      return false;
    }

    const ctx = this.ensureGraph();
    if (!ctx) return false;

    if (ctx.state !== 'running') {
      const unlocked = await this.unlock();
      if (!unlocked) return false;
    }

    const channelNode = this.channels[channel];
    if (!channelNode) return false;

    const steps = PRESET_TONES[preset];
    const baseTime = ctx.currentTime;

    for (const step of steps) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = step.type;
      osc.frequency.setValueAtTime(step.freq, baseTime + step.offsetSec);

      const start = baseTime + step.offsetSec;
      const end = start + step.durationSec;

      // ADSR Envelope แบบสั้น ป้องกันเสียงคลิกหัว-ท้าย
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(Math.max(0.001, step.gain), start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(env);
      env.connect(channelNode);

      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };

      osc.start(start);
      osc.stop(end + 0.01);
    }

    return true;
  }

  /** ตัดการเชื่อมต่อ Node ทั้งหมดและปิด AudioContext เพื่อป้องกัน Memory Leak */
  async dispose(): Promise<void> {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }

    Object.values(this.channels).forEach((node) => node?.disconnect());
    this.channels = {};
    this.compressor?.disconnect();
    this.compressor = null;
    this.masterGain?.disconnect();
    this.masterGain = null;

    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.onstatechange = null;
      try {
        await this.ctx.close();
      } catch {
        /* ignore close errors */
      }
    }
    this.ctx = null;
    useSoundStore.getState().setEngineStatus('closed');
    useSoundStore.getState().setNeedsUnlock(false);
  }
}

export const soundEngine = new SoundEngine();
