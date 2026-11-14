import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface UsageRow {
  id: string;
  provider: string;
  model: string;
  outcome: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string;
}

export interface AiModelStat {
  model: string;
  provider: string;
  count: number;
  tokens: number;
  avgLatency: number;
}

/** GET /api/admin/ai-monitor — สถิติการใช้ AI รวม + แยกตามโมเดล + ข้อผิดพลาดล่าสุด 20 รายการ */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const events = await sbList<UsageRow>('ai_usage_events', {
    select: 'id,provider,model,outcome,input_tokens,output_tokens,latency_ms,error_code,created_at',
    order: 'created_at.desc',
    limit: '1000',
  });

  const success = events.filter((e) => e.outcome === 'success').length;
  const error = events.filter((e) => e.outcome === 'error').length;
  const tokensIn = events.reduce((s, e) => s + (e.input_tokens ?? 0), 0);
  const tokensOut = events.reduce((s, e) => s + (e.output_tokens ?? 0), 0);
  const latencies = events.map((e) => e.latency_ms ?? 0);
  const avgLatency = events.length ? Math.round(latencies.reduce((s, x) => s + x, 0) / events.length) : 0;

  const grouped = new Map<string, AiModelStat>();
  for (const e of events) {
    const key = e.model || 'ไม่ทราบโมเดล';
    const b =
      grouped.get(key) ?? { model: key, provider: e.provider, count: 0, tokens: 0, avgLatency: 0 };
    b.count += 1;
    b.tokens += (e.input_tokens ?? 0) + (e.output_tokens ?? 0);
    b.avgLatency += e.latency_ms ?? 0;
    grouped.set(key, b);
  }
  const byModel: AiModelStat[] = [...grouped.values()]
    .map((b) => ({ ...b, avgLatency: Math.round(b.avgLatency / b.count) }))
    .sort((a, b) => b.count - a.count);

  const recentErrors = events
    .filter((e) => e.outcome === 'error')
    .slice(0, 20)
    .map((e) => ({ id: e.id, model: e.model, error_code: e.error_code, created_at: e.created_at }));

  return Response.json({
    totals: { events: events.length, success, error, tokensIn, tokensOut, avgLatency },
    byModel,
    recentErrors,
  });
}
