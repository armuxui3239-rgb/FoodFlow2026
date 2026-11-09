'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Save } from 'lucide-react';
import { api, useSession } from '@/lib/client';

interface ProfileData {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  phoneVerified: boolean;
}

export default function ProfileEditPage() {
  const { user, ready: sessionReady } = useSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!sessionReady || !user) {
      setLoading(false);
      return;
    }
    api<{ data: ProfileData }>('/api/profile')
      .then((r) => {
        setFullName(r.data.fullName ?? '');
        setEmail(r.data.email ?? '');
        setPhone(r.data.phone ?? '');
        setAvatarUrl(r.data.avatarUrl ?? '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, sessionReady]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, email, avatarUrl: avatarUrl || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !sessionReady) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-16 w-16 animate-pulse rounded-full bg-neutral-100" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-16 text-center text-sm text-neutral-400">
        กรุณา{' '}
        <Link href="/login?next=%2Fprofile%2Fedit" className="font-bold text-black underline">
          เข้าสู่ระบบ
        </Link>{' '}
        ก่อนแก้ไขโปรไฟล์
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับไปหน้าโปรไฟล์"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-[#FFF4CC]"
        >
          <ArrowLeft className="h-4 w-4 text-black" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">แก้ไขโปรไฟล์</h1>
      </header>

      <form onSubmit={submit} className="space-y-4" aria-label="แบบฟอร์มแก้ไขโปรไฟล์">
        <div className="flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-black text-2xl font-bold text-[#FFC400]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="รูปโปรไฟล์" className="h-full w-full rounded-full object-cover" />
            ) : (
              (fullName || user.fullName).trim().slice(0, 1)
            )}
          </span>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-neutral-500">ชื่อ-นามสกุล</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            aria-label="ชื่อ-นามสกุล"
            data-testid="input-fullname"
            className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#FFC400]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-neutral-500">อีเมล</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="อีเมล"
            data-testid="input-email"
            className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#FFC400]"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-neutral-500">เบอร์โทรศัพท์ (เปลี่ยนไม่ได้ — ผูกกับการยืนยัน OTP)</span>
          <div className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-neutral-50 px-4">
            <span className="text-sm font-semibold text-neutral-400">
              {phone.startsWith('0') ? `+66 ${phone.slice(1)}` : phone || 'ไม่มีเบอร์'}
            </span>
            {phone && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-black">
                <BadgeCheck className="h-3.5 w-3.5 text-[#FFC400]" aria-hidden />
                ยืนยันแล้ว
              </span>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
            บันทึกโปรไฟล์เรียบร้อยแล้ว
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          data-testid="save-profile"
          className="btn-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
        >
          {saving ? (
            'กำลังบันทึก...'
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden />
              บันทึกการเปลี่ยนแปลง
            </>
          )}
        </button>
      </form>
    </div>
  );
}
