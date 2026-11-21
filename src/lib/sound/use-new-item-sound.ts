'use client';

import { useEffect, useRef } from 'react';
import { soundEngine } from './engine';
import type { SoundPreset } from './types';

/**
 * Hook กลางสำหรับเล่นเสียงเมื่อมีรายการใหม่เข้ามาหลังโหลดครั้งแรกเสร็จแล้ว
 * ป้องกันเสียงดังซ้ำตอนเปิดหน้าครั้งแรก
 */
export function useNewItemSound(
  ids: readonly string[],
  preset: SoundPreset,
  ready = true,
): void {
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }

    let hasNew = false;
    for (const id of ids) {
      if (!seenRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }

    seenRef.current = new Set(ids);
    if (hasNew) {
      void soundEngine.playPreset(preset);
    }
  }, [ids, preset, ready]);
}
