/**
 * ประเภทข้อมูลหลักของ Sound Engine ภายในระบบ FoodFlow2026
 * ออกแบบให้ทำงานด้วย Web Audio API มาตรฐาน 100% ไม่พึ่งพาผู้ให้บริการภายนอก
 */

export type SoundChannel = 'alerts' | 'ui' | 'call';

export type SoundPreset =
  | 'order-new'
  | 'order-ready'
  | 'ui-tap'
  | 'ui-success'
  | 'ui-error'
  | 'call-ring';

export type ChannelVolumes = Record<SoundChannel, number>;

export type ChannelMuted = Record<SoundChannel, boolean>;

export type SoundEngineStatus =
  | 'idle'
  | 'suspended'
  | 'running'
  | 'interrupted'
  | 'closed'
  | 'unsupported';

export interface ToneStep {
  /** ความถี่เสียง (Hz) */
  freq: number;
  /** รูปคลื่น */
  type: OscillatorType;
  /** เวลาเริ่มนับจากปัจจุบัน (วินาที) */
  offsetSec: number;
  /** ความยาวเสียง (วินาที) */
  durationSec: number;
  /** ความดังสัมพัทธ์ของโน้ต (0.0 - 1.0) */
  gain: number;
}
