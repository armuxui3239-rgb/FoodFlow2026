'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ChannelMuted,
  ChannelVolumes,
  SoundChannel,
  SoundEngineStatus,
} from './types';

interface SoundStoreState {
  /** สวิตช์เปิด-ปิดเสียงรวมทั้งระบบ */
  enabled: boolean;
  /** ระดับความดังแยกตามช่อง (0.0 - 1.0) */
  volumes: ChannelVolumes;
  /** สถานะปิดเสียงเฉพาะช่อง */
  muted: ChannelMuted;
  /** แจ้งเตือน UI เมื่อเบราว์เซอร์บล็อก Autoplay จนกว่าผู้ใช้จะกดปุ่ม */
  needsUnlock: boolean;
  /** สถานะปัจจุบันของ AudioContext */
  engineStatus: SoundEngineStatus;

  setEnabled: (enabled: boolean) => void;
  setChannelVolume: (channel: SoundChannel, volume: number) => void;
  setChannelMuted: (channel: SoundChannel, muted: boolean) => void;
  setNeedsUnlock: (needsUnlock: boolean) => void;
  setEngineStatus: (status: SoundEngineStatus) => void;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export const useSoundStore = create<SoundStoreState>()(
  persist(
    (set) => ({
      enabled: true,
      volumes: {
        alerts: 0.9,
        ui: 0.45,
        call: 1.0,
      },
      muted: {
        alerts: false,
        ui: false,
        call: false,
      },
      needsUnlock: false,
      engineStatus: 'idle',

      setEnabled: (enabled) => set({ enabled }),
      setChannelVolume: (channel, volume) =>
        set((state) => ({
          volumes: {
            ...state.volumes,
            [channel]: clampVolume(volume),
          },
        })),
      setChannelMuted: (channel, muted) =>
        set((state) => ({
          muted: {
            ...state.muted,
            [channel]: muted,
          },
        })),
      setNeedsUnlock: (needsUnlock) => set({ needsUnlock }),
      setEngineStatus: (engineStatus) => set({ engineStatus }),
    }),
    {
      name: 'ft_sound_settings',
      storage: createJSONStorage(() => localStorage),
      // เก็บเฉพาะค่าตั้งค่าถาวร ไม่เก็บสถานะชั่วคราวของ AudioContext
      partialize: (state) => ({
        enabled: state.enabled,
        volumes: state.volumes,
        muted: state.muted,
      }),
    },
  ),
);
