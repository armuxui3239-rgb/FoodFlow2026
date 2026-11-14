'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageSquareReply, Star } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { api, useSession } from '@/lib/client';

interface Review {
  id: string;
  orderId: string;
  foodRating: number;
  deliveryRating: number | null;
  comment: string | null;
  createdAt: string;
  reply: string | null;
  replyAt: string | null;
  customerName: string;
}

/** หน้ารีวิวของร้าน — ดูคะแนน/คอมเมนต์ และตอบรีวิวแบบทีละรายการ */
export default function OwnerReviewsPage() {
  const { user, ready } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setError('');
    api<{ data: Review[]; average: number }>('/api/owner/reviews')
      .then((d) => {
        setReviews(d.data ?? []);
        setAverage(d.average ?? 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const sendReply = async (r: Review) => {
    const text = (replyDraft[r.id] ?? '').trim();
    if (!text) {
      setError('กรุณาพิมพ์ข้อความตอบรีวิว');
      return;
    }
    setBusyId(r.id);
    setError('');
    setNotice('');
    try {
      const res = await api<{ reply: string; replyAt: string }>(`/api/owner/reviews/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ reply: text }),
      });
      setReviews((xs) =>
        xs.map((x) => (x.id === r.id ? { ...x, reply: res.reply, replyAt: res.replyAt } : x)),
      );
      setReplyDraft((d) => ({ ...d, [r.id]: '' }));
      setNotice('ตอบรีวิวแล้ว');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const denied = ready && (!user || user.role !== 'restaurant');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <a
            href="/owner"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </a>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Star className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-black">รีวิวจากลูกค้า</p>
            <p className="text-[11px] text-neutral-400">
              คะแนนเฉลี่ย {average || '–'} · {reviews.length} รีวิวล่าสุด
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5">
        {denied && (
          <p role="alert" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
            หน้านี้สำหรับเจ้าของร้านเท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชีร้านค้า
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        {notice && !error && (
          <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
            {notice}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">
            ยังไม่มีรีวิว — เมื่อลูกค้ารีวิวร้านจะแสดงที่นี่
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1" aria-label={`คะแนนอาหาร ${r.foodRating} จาก 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < Math.round(r.foodRating) ? 'fill-[#FFC400] text-[#FFC400]' : 'text-neutral-200'}`}
                        aria-hidden
                      />
                    ))}
                    <span className="ml-1 text-xs font-bold text-black">{r.foodRating}</span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {new Date(r.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>

                {r.comment && <p className="mt-2 text-sm text-neutral-700">{r.comment}</p>}
                <p className="mt-1 text-xs text-neutral-400">
                  {r.customerName}
                  {typeof r.deliveryRating === 'number' ? ` · คะแนนจัดส่ง ${r.deliveryRating}` : ''}
                </p>

                {/* ตอบรีวิว */}
                {r.reply ? (
                  <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2.5">
                    <p className="text-xs font-bold text-black">ตอบกลับจากร้าน:</p>
                    <p className="mt-0.5 text-sm text-neutral-700">{r.reply}</p>
                    {r.replyAt && (
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {new Date(r.replyAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={replyDraft[r.id] ?? ''}
                      onChange={(e) => setReplyDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="พิมพ์ข้อความตอบรีวิวนี้..."
                      aria-label={`ตอบรีวิวของ ${r.customerName}`}
                    />
                    <button
                      onClick={() => void sendReply(r)}
                      disabled={busyId === r.id}
                      className="btn-brand flex h-10 items-center justify-center gap-1.5 px-4 text-xs disabled:opacity-50"
                    >
                      <MessageSquareReply className="h-4 w-4" aria-hidden />
                      {busyId === r.id ? 'กำลังส่ง...' : 'ส่งคำตอบ'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
