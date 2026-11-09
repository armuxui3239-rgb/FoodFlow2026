'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  Frown,
  Laugh,
  LoaderCircle,
  Meh,
  PackageSearch,
  ReceiptText,
  Smile,
  Sparkles,
  Star,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/client';

interface Review {
  id: string;
  food_rating: number;
  delivery_rating: number;
  comment: string | null;
  created_at: string;
}

/** 5 ระดับความรู้สึก — ห้าม emoji ใช้ lucide ทั้งหมด (ค่า = คะแนนการจัดส่ง 1–5) */
const MOODS: { value: number; Icon: typeof Frown; label: string }[] = [
  { value: 1, Icon: Frown, label: 'แย่มาก' },
  { value: 2, Icon: Meh, label: 'ไม่ค่อยดี' },
  { value: 3, Icon: Smile, label: 'ปานกลาง' },
  { value: 4, Icon: Laugh, label: 'ดีมาก' },
  { value: 5, Icon: Sparkles, label: 'ประทับใจ' },
];

function Stars({ value, size = 'h-5 w-5' }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`คะแนน ${value} จาก 5 ดวง`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`${size} ${i < value ? 'fill-[#FFC400] stroke-[#FFC400]' : 'fill-none stroke-neutral-300'}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

export default function RatePage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ data: Review | null }>(`/api/orders/${id}/review`)
      .then((r) => {
        if (!cancelled) setReview(r.data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const submit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      await api<{ data: Review }>(`/api/orders/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ foodRating, deliveryRating, comment }),
      });
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'ส่งคะแนนไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดหน้าให้คะแนน">
        <div className="h-11 w-40 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-8 w-64 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-28 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    );
  }

  // 404 → สถานะ "ว่าง"
  if (error === 'ไม่พบคำสั่งซื้อ') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <PackageSearch className="h-9 w-9 text-neutral-300" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-black">ไม่พบคำสั่งซื้อ</h1>
        <p className="text-sm text-neutral-400">คำสั่งซื้อนี้อาจถูกลบหรือไม่ใช่ของคุณ</p>
        <Link href="/orders" className="btn-brand inline-flex h-11 items-center px-8 text-sm">
          ดูคำสั่งซื้อทั้งหมด
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <ReceiptText className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-brand inline-flex h-11 items-center px-8 text-sm"
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  const deliveryMood = review
    ? (MOODS.find((m) => m.value === review.delivery_rating) ?? MOODS[MOODS.length - 1])
    : null;

  /* ===== เคยให้คะแนนแล้ว → แสดงคะแนนเดิม + ปุ่มกลับ ===== */
  if (review) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/orders/${id}`}
            aria-label="ย้อนกลับไปรายละเอียดคำสั่งซื้อ"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-[#FFF4CC]"
          >
            <ChevronLeft className="h-5 w-5 text-black" aria-hidden />
          </Link>
          <h1 className="truncate-1 text-lg font-bold text-black">ให้คะแนนคำสั่งซื้อ</h1>
        </div>

        <section
          aria-label="คะแนนที่คุณให้ไว้"
          className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-6 text-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden />
          </span>
          <p className="text-base font-bold text-black">คุณให้คะแนนคำสั่งซื้อนี้แล้ว</p>
          <p className="text-xs text-neutral-400">
            {new Date(review.created_at).toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'Asia/Bangkok',
            })}
          </p>
          <div className="mt-1 flex w-full items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
            <span className="text-xs text-neutral-500">คะแนนอาหาร</span>
            <Stars value={review.food_rating} />
          </div>
          <div className="flex w-full items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
            <span className="text-xs text-neutral-500">การจัดส่ง</span>
            {deliveryMood && (
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold text-black">{deliveryMood.label}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black">
                  <deliveryMood.Icon className="h-5 w-5 text-[#FFC400]" aria-hidden />
                </span>
              </span>
            )}
          </div>
          {review.comment && (
            <p className="w-full rounded-2xl bg-[#FFF4CC] px-4 py-3 text-left text-sm leading-relaxed text-black">
              {review.comment}
            </p>
          )}
          <Link href="/orders" className="btn-brand mt-2 inline-flex h-11 w-full items-center justify-center text-sm">
            กลับไปหน้าคำสั่งซื้อ
          </Link>
        </section>
      </div>
    );
  }

  /* ===== ส่งสำเร็จ → การ์ดขอบคุณ ===== */
  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-black">ขอบคุณสำหรับคะแนน!</h1>
        <p className="text-sm text-neutral-400">ความคิดเห็นของคุณช่วยให้ร้านและไรเดอร์ทำงานได้ดีขึ้น</p>
        <Link href="/orders" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
          กลับไปหน้าคำสั่งซื้อ
        </Link>
      </div>
    );
  }

  /* ===== ฟอร์มให้คะแนน ===== */
  const canSubmit = foodRating >= 1 && foodRating <= 5 && deliveryRating >= 1 && deliveryRating <= 5;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/orders/${id}`}
          aria-label="ย้อนกลับไปรายละเอียดคำสั่งซื้อ"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-[#FFF4CC]"
        >
          <ChevronLeft className="h-5 w-5 text-black" aria-hidden />
        </Link>
        <h1 className="truncate-1 text-lg font-bold text-black">ให้คะแนนคำสั่งซื้อ</h1>
      </div>

      <section aria-label="แบบฟอร์มให้คะแนน" className="space-y-6 rounded-3xl border border-line bg-white p-5">
        {/* ความรู้สึก 5 ระดับ (คะแนนการจัดส่ง) */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-black">คุณรู้สึกอย่างไรกับคำสั่งซื้อนี้?</h2>
          <p className="mt-1 text-xs text-neutral-400">แตะไอคอนที่ตรงกับความรู้สึกในการจัดส่งของคุณ</p>
          <div className="mt-4 flex items-center justify-between gap-1" role="radiogroup" aria-label="คะแนนการจัดส่ง">
            {MOODS.map(({ value, Icon, label }) => {
              const selected = deliveryRating === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${label} (${value} จาก 5)`}
                  onClick={() => setDeliveryRating(value)}
                  className={`flex h-14 flex-1 items-center justify-center rounded-2xl transition-all active:scale-90 ${
                    selected ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-400 hover:bg-[#FFF4CC]'
                  }`}
                >
                  <Icon className="h-8 w-8" aria-hidden />
                </button>
              );
            })}
          </div>
          {deliveryRating > 0 && (
            <p className="mt-2 text-xs font-bold text-black">
              {MOODS.find((m) => m.value === deliveryRating)?.label}
            </p>
          )}
        </div>

        {/* ดาว 5 ดวง — คะแนนอาหาร */}
        <div className="text-center">
          <p className="text-sm font-bold text-black">คะแนนอาหาร</p>
          <div className="mt-2 flex items-center justify-center gap-1" role="radiogroup" aria-label="คะแนนอาหาร">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={foodRating === value}
                aria-label={`ให้ ${value} ดาว`}
                onClick={() => setFoodRating(value)}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90"
              >
                <Star
                  className={`h-9 w-9 ${value <= foodRating ? 'fill-[#FFC400] stroke-[#FFC400]' : 'fill-none stroke-neutral-300'}`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </div>

        {/* คอมเมนต์ */}
        <div>
          <label htmlFor="review-comment" className="mb-1.5 block text-sm font-bold text-black">
            คอมเมนต์เพิ่มเติม
          </label>
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="บอกเราเพิ่มเติมได้เลย (ไม่บังคับ)"
            maxLength={500}
            rows={4}
            className="rounded-2xl border-line bg-neutral-50 text-sm"
          />
          <p className="mt-1 text-right text-[11px] text-neutral-400" aria-live="polite">
            {comment.length}/500
          </p>
        </div>

        {submitError && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {submitError}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit || submitting}
          className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm"
        >
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
          {submitting ? 'กำลังส่ง…' : 'ส่งคะแนน'}
        </button>
        {!canSubmit && (
          <p className="text-center text-[11px] text-neutral-400">
            เลือกความรู้สึกและคะแนนอาหารก่อนส่งคะแนน
          </p>
        )}
      </section>
    </div>
  );
}
