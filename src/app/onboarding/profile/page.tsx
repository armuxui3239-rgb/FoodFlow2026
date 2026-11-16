'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Camera, CalendarDays, User, Mail, Users } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

export default function ProfileSetupPage() {
  const router = useRouter();
  const t = useTranslations('onboardingProfile');
  const tCommon = useTranslations('common');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ดึงชื่อ-อีเมลที่กรอกไว้ตอนสมัครสมาชิกมาแสดงอัตโนมัติ
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/onboard/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (cancelled || !res?.data) return;
        if (res.data.fullName) setFullName(res.data.fullName);
        if (res.data.email) setEmail(res.data.email);
        if (res.data.avatarUrl) setAvatarUrl(res.data.avatarUrl);
        if (res.data.nickname) setNickname(res.data.nickname);
        if (res.data.birthDate) setBirthDate(res.data.birthDate);
        if (res.data.gender) setGender(res.data.gender);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'อัปโหลดรูปไม่สำเร็จ');
      setAvatarUrl(body.data?.avatarUrl ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

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
    <AuthShell title={t('title')} backHref="/verify-otp">
      <div className="mb-6 flex justify-center">
        <label className="relative cursor-pointer" aria-label={t('uploadPhoto')}>
          <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-neutral-100">
            {avatarUrl ? (
              <img src={avatarUrl} alt="รูปโปรไฟล์" className="h-full w-full object-cover" />
            ) : (
              <User className="h-12 w-12 text-neutral-400" aria-hidden />
            )}
          </span>
          <span
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand shadow"
            aria-hidden
          >
            <Camera className="h-4 w-4 text-black" />
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void uploadAvatar(e.target.files?.[0])}
          />
        </label>
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
            placeholder={t('fullName')}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label={t('fullName')}
            required
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <User className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('nickname')}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label={t('nickname')}
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <CalendarDays className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-transparent text-sm text-ink outline-none"
            aria-label={t('birthDate')}
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <Mail className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('email')}
            autoComplete="email"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label={t('email')}
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <Users className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full bg-transparent text-sm text-ink outline-none"
            aria-label={t('gender')}
          >
            <option value="">{t('gender')}</option>
            <option value="male">{t('genderMale')}</option>
            <option value="female">{t('genderFemale')}</option>
            <option value="other">{t('genderOther')}</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
        >
          {loading ? tCommon('saving') : tCommon('next')}
        </button>
      </form>
    </AuthShell>
  );
}
