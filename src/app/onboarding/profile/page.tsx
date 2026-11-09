'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CalendarDays, User, Mail, Phone } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

export default function ProfileSetupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/onboard/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, nickname, birthDate, gender, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'บันทึกไม่สำเร็จ');
      router.push(body.next ?? '/onboarding/location');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setLoading(false);
    }
  };

  return (
    <AuthShell title="กรอกโปรไฟล์ของคุณ" backHref="/verify-otp">
      <div className="mb-6 flex justify-center">
        <div className="relative">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-100">
            <User className="h-12 w-12 text-neutral-400" aria-hidden />
          </span>
          <span
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand"
            aria-hidden
          >
            <Camera className="h-4 w-4 text-black" />
          </span>
          <span className="sr-only">อัปโหลดรูปโปรไฟล์ (ทำได้ภายหลังในหน้าโปรไฟล์)</span>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <User className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="ชื่อ-นามสกุล"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label="ชื่อ-นามสกุล"
            required
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <User className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="ชื่อเล่น"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label="ชื่อเล่น"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <CalendarDays className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-transparent text-sm text-ink outline-none"
            aria-label="วันเกิด"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <Mail className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล"
            autoComplete="email"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label="อีเมล"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <Phone className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full bg-transparent text-sm text-ink outline-none"
            aria-label="เพศ"
          >
            <option value="">เพศ</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
            <option value="other">อื่น ๆ</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
        >
          {loading ? 'กำลังบันทึก...' : 'ถัดไป'}
        </button>
      </form>
    </AuthShell>
  );
}
