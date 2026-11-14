'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bike, BadgeCheck, ExternalLink, FileText, ShieldCheck, ShieldX, Wallet } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, baht, STATUS_COLOR, STATUS_TH, useSession } from '@/lib/client';

interface DriverDetail {
  profile: {
    id: string;
    user_id: string;
    license_number: string | null;
    vehicle_type: string;
    vehicle_plate: string | null;
    is_online: boolean;
    is_verified: boolean;
    rating: number;
    total_deliveries: number;
    total_earnings: number;
    max_delivery_radius_km: number;
    terms_accepted_at: string | null;
  };
  user: { id: string; full_name: string; email: string; phone: string | null; is_active: boolean; created_at: string } | null;
  kycSubmissions: {
    id: string;
    status: string;
    document_urls: unknown;
    rejection_reason: string | null;
    reviewed_at: string | null;
    created_at: string;
  }[];
  trips: { id: string; order_code: string; status: string; total: number; restaurantName: string; created_at: string }[];
}

const KYC_TH: Record<string, string> = { pending: 'รอตรวจ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ' };

/** แปลง document_urls (JSONB — อาจเป็น string[] หรือ object[]) เป็นลิงก์เอกสาร */
function docLinks(raw: unknown): { label: string; url: string }[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item, i) => {
        if (typeof item === 'string') return { label: `เอกสาร ${i + 1}`, url: item };
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const url = typeof obj.url === 'string' ? obj.url : '';
          const label = typeof obj.type === 'string' ? obj.type : typeof obj.name === 'string' ? obj.name : `เอกสาร ${i + 1}`;
          return url ? { label, url } : null;
        }
        return null;
      })
      .filter((x): x is { label: string; url: string } => x !== null);
  }
  if (typeof raw === 'string' && raw) return [{ label: 'เอกสาร', url: raw }];
  return [];
}

/** หน้ารายละเอียดไรเดอร์ (แอดมิน) — ตรวจ KYC เอกสาร, อนุมัติ/ปฏิเสธ, ดูงานส่งล่าสุด */
export default function AdminDriverDetailPage() {
  useSession();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<'approved' | 'rejected' | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<DriverDetail>(`/api/admin/drivers/${id}`)
      .then((d) => {
        setDetail(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const pending = detail?.kycSubmissions.find((k) => k.status === 'pending') ?? null;
  const latest = detail?.kycSubmissions[0] ?? null;
  const shown = pending ?? latest;

  const review = async () => {
    if (!submissionId || !confirmAction) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/drivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          confirmAction === 'approved'
            ? { kycSubmissionId: submissionId, status: 'approved' }
            : { kycSubmissionId: submissionId, status: 'rejected', rejectionReason: rejectReason.trim() },
        ),
      });
      setConfirmAction(null);
      setRejectReason('');
      setLoading(true);
      load();
    } catch (e) {
      setError((e as Error).message);
      setConfirmAction(null);
    } finally {
      setBusy(false);
    }
  };

  const p = detail?.profile;
  const u = detail?.user;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/admin/drivers"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
            <Bike className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="truncate-1 text-sm font-bold text-black">{u?.full_name ?? 'รายละเอียดไรเดอร์'}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : !p ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ไม่พบโปรไฟล์ไรเดอร์นี้</p>
        ) : (
          <>
            {/* โปรไฟล์ไรเดอร์ */}
            <section className="rounded-3xl border border-line p-4" aria-label="โปรไฟล์ไรเดอร์">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-lg font-bold text-black">
                    {u?.full_name ?? '-'}
                    {p.is_verified && (
                      <span className="flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[11px] font-bold text-[#FFC400]">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> ยืนยันตัวแล้ว
                      </span>
                    )}
                  </p>
                  <p className="truncate-1 text-xs text-neutral-400">{u?.email ?? '-'} · {u?.phone ?? 'ไม่มีเบอร์โทร'}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    ยานพาหนะ: {p.vehicle_type} · ป้ายทะเบียน {p.vehicle_plate ?? 'ไม่ระบุ'} · ใบขับขี่ {p.license_number ?? 'ไม่ระบุ'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    รัศมีจัดส่ง {p.max_delivery_radius_km} กม. · สถานะบัญชี {u?.is_active ? 'ปกติ' : 'ถูกระงับ'}
                  </p>
                </div>
                <Link
                  href={`/admin/users/${p.user_id}`}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  ดูบัญชีผู้ใช้
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-neutral-50 p-3 text-center">
                  <p className="text-lg font-bold text-black">{Number(p.rating).toFixed(1)}</p>
                  <p className="text-[11px] text-neutral-500">คะแนนเฉลี่ย</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3 text-center">
                  <p className="text-lg font-bold text-black">{p.total_deliveries}</p>
                  <p className="text-[11px] text-neutral-500">จัดส่งสำเร็จ</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-lg font-bold text-black"><Wallet className="h-4 w-4" aria-hidden />{baht(Number(p.total_earnings))}</p>
                  <p className="text-[11px] text-neutral-500">รายได้รวม</p>
                </div>
              </div>
            </section>

            {/* ตรวจ KYC */}
            <section className="rounded-3xl border border-line p-4" aria-label="ตรวจสอบ KYC">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
                <FileText className="h-4 w-4" aria-hidden /> ตรวจเอกสาร KYC
                {shown && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${shown.status === 'pending' ? 'bg-[#FFC400] text-black' : shown.status === 'approved' ? 'bg-black text-[#FFC400]' : 'bg-red-50 text-red-600'}`}>
                    {KYC_TH[shown.status] ?? shown.status}
                  </span>
                )}
              </h2>

              {!shown ? (
                <p className="py-2 text-center text-sm text-neutral-300">ยังไม่มีใบยื่น KYC</p>
              ) : (
                <>
                  <p className="text-[11px] text-neutral-400">
                    ยื่นเมื่อ {new Date(shown.created_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
                    {shown.reviewed_at ? ` · ตรวจเมื่อ ${new Date(shown.reviewed_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}` : ''}
                    {shown.rejection_reason ? ` · เหตุผลปฏิเสธ: ${shown.rejection_reason}` : ''}
                  </p>
                  {docLinks(shown.document_urls).length === 0 ? (
                    <p className="mt-2 rounded-2xl bg-neutral-50 px-3 py-2 text-xs text-neutral-400">ไม่มีไฟล์เอกสารแนบ</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {docLinks(shown.document_urls).map((doc) => (
                        <li key={doc.url}>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-2xl bg-[#FFF4CC] px-3 py-2 text-sm font-bold text-black transition-colors hover:bg-[#FFC400]"
                          >
                            <FileText className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="truncate-1">{doc.label}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {shown.status === 'pending' ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => { setSubmissionId(shown.id); setConfirmAction('approved'); }}
                        className="btn-brand flex h-11 flex-1 items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" aria-hidden /> อนุมัติ KYC
                      </button>
                      <button
                        onClick={() => { setSubmissionId(shown.id); setConfirmAction('rejected'); }}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <ShieldX className="h-4 w-4" aria-hidden /> ปฏิเสธ
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-semibold text-neutral-400">ใบยื่นนี้ถูกตรวจแล้ว</p>
                  )}
                </>
              )}

              {detail.kycSubmissions.length > 1 && (
                <ul className="mt-3 divide-y divide-line border-t border-line pt-2">
                  {detail.kycSubmissions.slice(1).map((k) => (
                    <li key={k.id} className="flex items-center justify-between gap-2 py-1.5 text-[11px] text-neutral-400">
                      <span>ใบยื่น {new Date(k.created_at).toLocaleDateString('th-TH')}</span>
                      <span className="font-bold">{KYC_TH[k.status] ?? k.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* งานส่งสำเร็จล่าสุด */}
            <section aria-label="งานจัดส่งล่าสุด">
              <h2 className="mb-2 text-sm font-bold text-black">งานจัดส่งสำเร็จล่าสุด</h2>
              {detail.trips.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ยังไม่มีงานจัดส่งสำเร็จ</p>
              ) : (
                <div className="overflow-y-auto ft-scroll rounded-3xl border border-line bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#FFF4CC] text-xs text-neutral-600">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">รหัสออเดอร์</th>
                        <th className="hidden px-4 py-2.5 font-bold sm:table-cell">ร้าน</th>
                        <th className="px-4 py-2.5 font-bold">สถานะ</th>
                        <th className="px-4 py-2.5 text-right font-bold">ยอด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.trips.map((t) => (
                        <tr key={t.id} className="border-t border-line">
                          <td className="px-4 py-2.5">
                            <Link href={`/admin/orders/${t.id}`} className="text-xs font-bold text-black hover:underline">{t.order_code}</Link>
                          </td>
                          <td className="hidden max-w-40 truncate-1 px-4 py-2.5 text-neutral-500 sm:table-cell">{t.restaurantName}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[t.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                              {STATUS_TH[t.status] ?? t.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-black">{baht(t.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ยืนยันอนุมัติ/ปฏิเสธ KYC */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(v) => { if (!v) setConfirmAction(null); }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'approved' ? 'ยืนยันอนุมัติ KYC ไรเดอร์?' : 'ปฏิเสธใบยื่น KYC'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'approved'
                ? 'เมื่ออนุมัติ ระบบจะตั้งค่า "ยืนยันตัวแล้ว" ให้ไรเดอร์คนนี้ทันที และบันทึกผู้ตรวจพร้อมเวลา'
                : 'การปฏิเสธต้องระบุเหตุผล เพื่อให้ไรเดอร์ทราบว่าควรแก้ไขเอกสารอย่างไร'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmAction === 'rejected' && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">เหตุผลการปฏิเสธ (จำเป็น)</span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="เช่น ภาพใบขับขี่ไม่ชัด กรุณาถ่ายใหม่"
                className="w-full rounded-2xl border border-line bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void review(); }}
              disabled={busy || (confirmAction === 'rejected' && !rejectReason.trim())}
              className="rounded-full disabled:opacity-50"
            >
              {busy ? 'กำลังบันทึก…' : confirmAction === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
