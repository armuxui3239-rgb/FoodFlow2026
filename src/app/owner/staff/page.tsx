'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Copy, Link2, UserPlus, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, useSession } from '@/lib/client';

interface StaffMember {
  id: string;
  userId: string;
  staffRole: string;
  isActive: boolean;
  joinedAt: string;
  name: string;
  email: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const ROLE_TH: Record<string, string> = {
  owner: 'เจ้าของร้าน',
  manager: 'ผู้จัดการ',
  kitchen: 'พนักงานครัว',
  cashier: 'แคชเชียร์',
  viewer: 'ดูข้อมูลอย่างเดียว',
};

/** หน้าจัดการพนักงาน — รายชื่อ + เปิด/ปิดบัญชี + เชิญพนักงานผ่านลิงก์ (ยังไม่มีระบบส่งอีเมล) */
export default function OwnerStaffPage() {
  const { user, ready } = useSession();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ไดอะล็อกเชิญพนักงาน
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api<{ data: StaffMember[]; currentUserId: string | null }>('/api/owner/staff'),
      api<{ data: Invite[] }>('/api/owner/staff/invites'),
    ])
      .then(([s, i]) => {
        setStaff(s.data ?? []);
        setCurrentUserId(s.currentUserId ?? null);
        setInvites(i.data ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggleActive = async (m: StaffMember, next: boolean) => {
    setError('');
    setNotice('');
    const prev = staff;
    setStaff((xs) => xs.map((x) => (x.id === m.id ? { ...x, isActive: next } : x)));
    try {
      await api('/api/owner/staff', {
        method: 'PATCH',
        body: JSON.stringify({ profileId: m.id, isActive: next }),
      });
    } catch (e) {
      setStaff(prev);
      setError((e as Error).message);
    }
  };

  const invite = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('กรุณาระบุอีเมลพนักงาน');
      return;
    }
    setInviting(true);
    setCopied(false);
    try {
      const res = await api<{ inviteUrl: string; note: string }>('/api/owner/staff/invites', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setInviteUrl(res.inviteUrl);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    const full = `${window.location.origin}${inviteUrl}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const denied = ready && (!user || user.role !== 'restaurant');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <Link
            href="/owner"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-black">พนักงานของร้าน</p>
            <p className="text-[11px] text-neutral-400">{staff.length} บัญชีที่ผูกกับร้าน</p>
          </div>
          <Button
            onClick={() => {
              setDialogOpen(true);
              setInviteUrl('');
              setCopied(false);
            }}
            className="ml-auto h-10 rounded-full bg-[#FFF4CC] px-4 text-xs font-bold text-black shadow-none hover:bg-[#FFC400]"
          >
            <UserPlus className="h-4 w-4" aria-hidden /> เชิญพนักงาน
          </Button>
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

        {/* คำเชิญที่รอตอบรับ */}
        {!loading && invites.length > 0 && (
          <section className="rounded-3xl border border-line p-4" aria-label="คำเชิญที่รอตอบรับ">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
              <Link2 className="h-4 w-4" aria-hidden /> คำเชิญที่รอตอบรับ ({invites.length})
            </h2>
            <ul className="space-y-1.5">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate-1 text-neutral-700">{i.email}</span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    หมดอายุ {new Date(i.expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* รายชื่อพนักงาน */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">
            ยังไม่มีพนักงานในร้าน — กด &ldquo;เชิญพนักงาน&rdquo; เพื่อส่งลิงก์สมัคร
          </p>
        ) : (
          <ul className="space-y-2">
            {staff.map((m) => {
              const isMe = m.userId === currentUserId;
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-bold text-black">
                      {m.name}
                      {isMe && <span className="ml-1.5 rounded-full bg-[#FFC400] px-2 py-0.5 text-[10px] font-bold text-black">คุณ</span>}
                    </p>
                    <p className="truncate-1 text-xs text-neutral-500">{m.email}</p>
                    <p className="text-[11px] text-neutral-400">
                      {ROLE_TH[m.staffRole] ?? m.staffRole} · เข้าร่วม{' '}
                      {new Date(m.joinedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <Switch
                      checked={m.isActive}
                      disabled={isMe}
                      onCheckedChange={(v) => void toggleActive(m, v)}
                      aria-label={`เปิด/ปิดบัญชี ${m.name}`}
                    />
                    <span className={`text-[10px] font-bold ${m.isActive ? 'text-black' : 'text-neutral-400'}`}>
                      {m.isActive ? 'ใช้งาน' : 'ปิด'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-500">
          บทบาทพนักงาน: เจ้าของร้าน (owner) · ผู้จัดการ (manager) · พนักงานครัว (kitchen) · แคชเชียร์ (cashier) ·
          ดูข้อมูลอย่างเดียว (viewer) — ระบบยังไม่มีการส่งอีเมล เชิญผ่านลิงก์เท่านั้น
        </p>
      </main>

      {/* ไดอะล็อกเชิญพนักงาน */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>เชิญพนักงานเข้าร้าน</DialogTitle>
            <DialogDescription>
              ระบบยังไม่มีการส่งอีเมล — สร้างลิงก์เชิญแล้วคัดลอกส่งให้พนักงานด้วยตัวเอง (ลิงก์มีอายุ 7 วัน)
            </DialogDescription>
          </DialogHeader>

          {inviteUrl ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-bold text-neutral-500">ลิงก์เชิญของคุณ:</p>
                <p className="mt-1 break-all text-sm text-black">{inviteUrl}</p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => void copyLink()}
                  className="h-11 rounded-full"
                >
                  <Copy className="h-4 w-4" aria-hidden /> {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                </Button>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    setEmail('');
                    setInviteUrl('');
                  }}
                  className="h-11 rounded-full bg-[#FFC400] text-black hover:bg-[#e6b000]"
                >
                  เสร็จสิ้น
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-black">อีเมลพนักงาน *</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-black">บทบาท *</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black outline-none focus:border-[#FFC400]"
                >
                  {Object.entries(ROLE_TH)
                    .filter(([k]) => k !== 'owner')
                    .map(([k, label]) => (
                      <option key={k} value={k}>
                        {label} ({k})
                      </option>
                    ))}
                </select>
              </label>
              <p className="rounded-2xl bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">
                พนักงานที่ตอบรับลิงก์เชิญจะได้สิทธิ์ตามบทบาทที่เลือก
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 rounded-full">
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => void invite()}
                  disabled={inviting}
                  className="h-11 rounded-full bg-[#FFC400] text-black hover:bg-[#e6b000]"
                >
                  {inviting ? 'กำลังสร้างคำเชิญ...' : 'สร้างลิงก์เชิญ'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
