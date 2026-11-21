'use client';

import { BellRing, MousePointerClick, PhoneCall, Play, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '@/lib/sound/engine';
import { useSoundStore } from '@/lib/sound/store';
import type { SoundChannel, SoundPreset } from '@/lib/sound/types';

interface ChannelConfig {
  key: SoundChannel;
  label: string;
  desc: string;
  preset: SoundPreset;
  Icon: typeof Volume2;
}

const CHANNELS: readonly ChannelConfig[] = [
  {
    key: 'alerts',
    label: 'เสียงแจ้งเตือนออเดอร์ / งาน',
    desc: 'ออเดอร์ใหม่ ร้านค้า ไรเดอร์ และสถานะจัดส่ง',
    preset: 'order-new',
    Icon: BellRing,
  },
  {
    key: 'ui',
    label: 'เสียงตอบสนอง UI',
    desc: 'กดปุ่ม ทำรายการสำเร็จ หรือแจ้งข้อผิดพลาด',
    preset: 'ui-success',
    Icon: MousePointerClick,
  },
  {
    key: 'call',
    label: 'เสียงโทรและกริ่งเรียกเข้า',
    desc: 'สายโทร WebRTC ภายในระบบ (AudioWorklet DSP)',
    preset: 'call-ring',
    Icon: PhoneCall,
  },
];

/**
 * แผงปรับระดับเสียงแยกช่อง (Multi-Channel Mixer) พร้อมปุ่มทดสอบเสียง
 */
export function SoundMixerPanel() {
  const enabled = useSoundStore((s) => s.enabled);
  const volumes = useSoundStore((s) => s.volumes);
  const muted = useSoundStore((s) => s.muted);
  const setChannelVolume = useSoundStore((s) => s.setChannelVolume);
  const setChannelMuted = useSoundStore((s) => s.setChannelMuted);

  if (!enabled) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      {CHANNELS.map(({ key, label, desc, preset, Icon }, index) => {
        const isMuted = muted[key];
        const percent = Math.round(volumes[key] * 100);

        return (
          <div
            key={key}
            className={`space-y-3 px-4 py-4 ${index > 0 ? 'border-t border-line' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
                <Icon className="h-4.5 w-4.5 text-black" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-black">{label}</p>
                <p className="text-[11px] text-neutral-500">{desc}</p>
              </div>
              <button
                type="button"
                onClick={() => void soundEngine.playPreset(preset)}
                disabled={isMuted || percent === 0}
                aria-label={`ทดสอบ${label}`}
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-line px-3 text-xs font-semibold text-black transition-colors hover:bg-neutral-50 disabled:opacity-40"
              >
                <Play className="h-3 w-3" aria-hidden />
                ทดสอบ
              </button>
            </div>

            <div className="flex items-center gap-3 pl-12">
              <button
                type="button"
                onClick={() => setChannelMuted(key, !isMuted)}
                aria-label={isMuted ? `เปิดเสียง${label}` : `ปิดเสียง${label}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-neutral-600 hover:bg-neutral-50 hover:text-black"
              >
                {isMuted || percent === 0 ? (
                  <VolumeX className="h-4 w-4 text-neutral-400" aria-hidden />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={isMuted ? 0 : percent}
                aria-label={`ระดับความดัง${label}`}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  if (isMuted && val > 0) setChannelMuted(key, false);
                  setChannelVolume(key, val);
                }}
                className="h-1.5 flex-1 cursor-pointer accent-black"
              />
              <span className="w-10 text-right text-xs font-semibold tabular-nums text-neutral-600">
                {isMuted ? '0%' : `${percent}%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
