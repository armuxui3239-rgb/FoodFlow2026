import 'server-only';
import { SupabaseClient } from '@supabase/supabase-js';
import { sbInsert, sbList, sbUpdate } from '@/lib/supabase';

/** ท่อส่งเหตุการณ์ (REMAINING-WORK D7 / realtime_outbox)
 *  เหตุการณ์สำคัญถูกเขียนลง outbox ก่อนเสมอ (transactional-ish) แล้วค่อยส่งออกผ่าน
 *  Supabase Realtime broadcast ด้วย service key — drain ได้ทีละชุดจากหน้าแอดมิน */

export const OUTBOX_CHANNEL_PREFIX = 'events';

/** เขียนเหตุการณ์ลง outbox — พังไม่รบกวนการทำงานหลัก (catch ที่ผู้เรียก) */
export async function enqueueOutboxEvent(orderId: string, event: string, payload: Record<string, unknown>): Promise<void> {
  await sbInsert('realtime_outbox', {
    channel: `${OUTBOX_CHANNEL_PREFIX}:order:${orderId}`,
    event,
    payload: payload as never,
  });
}

let serviceClient: SupabaseClient | null = null;

/** Supabase client ฝั่ง server (service key) สำหรับส่ง broadcast */
function getServiceRealtimeClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SBK;
    if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_KEY');
    serviceClient = new SupabaseClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return serviceClient;
}

export interface DrainResult {
  delivered: number;
  failed: number;
  skipped: number;
}

/** ส่งเหตุการณ์ที่ยังค้างออกทาง Supabase Realtime broadcast (กลุ่มตาม channel) แล้ว mark delivered */
export async function drainOutbox(limit = 100): Promise<DrainResult> {
  const pending = await sbList<{
    id: string;
    channel: string;
    event: string;
    payload: Record<string, unknown>;
  }>('realtime_outbox', {
    delivered_at: 'is.null',
    order: 'created_at.asc',
    limit: String(limit),
    select: 'id,channel,event,payload',
  });
  if (pending.length === 0) return { delivered: 0, failed: 0, skipped: 0 };

  const client = getServiceRealtimeClient();
  let delivered = 0;
  let failed = 0;

  // จัดกลุ่มตาม channel — เปิด channel เดียวส่งหลายเหตุการณ์ได้
  const byChannel = new Map<string, typeof pending>();
  for (const ev of pending) {
    const list = byChannel.get(ev.channel) ?? [];
    list.push(ev);
    byChannel.set(ev.channel, list);
  }

  for (const [channel, events] of byChannel) {
    try {
      const ch = client.channel(channel);
      await ch.subscribe();
      for (const ev of events) {
        try {
          await ch.send({ type: 'broadcast', event: ev.event, payload: ev.payload });
          await sbUpdate('realtime_outbox', { id: `eq.${ev.id}` }, { delivered_at: new Date().toISOString() });
          delivered += 1;
        } catch (e) {
          await sbUpdate('realtime_outbox', { id: `eq.${ev.id}` }, { error: String(e).slice(0, 400) });
          failed += 1;
        }
      }
      await client.removeChannel(ch);
    } catch (e) {
      for (const ev of events) {
        await sbUpdate('realtime_outbox', { id: `eq.${ev.id}` }, { error: String(e).slice(0, 400) });
        failed += 1;
      }
    }
  }

  return { delivered, failed, skipped: 0 };
}
