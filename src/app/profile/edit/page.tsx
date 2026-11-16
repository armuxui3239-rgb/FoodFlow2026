'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, BadgeCheck, Camera, Save } from 'lucide-react';
import { api, useSession } from '@/lib/client';

interface ProfileData {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  nickname?: string;
  birthDate?: string;
  gender?: string;
  phoneVerified: boolean;
}

export default function ProfileEditPage() {
  const { user, ready: sessionReady } = useSession();
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
        setNickname(r.data.nickname ?? '');
        setBirthDate(r.data.birthDate ?? '');
        setGender(r.data.gender ?? '');
        setEmail(r.data.email ?? '');
        setPhone(r.data.phone ?? '');
        setAvatarUrl(r.data.avatarUrl ?? '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, sessionReady]);

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    setSaved(false);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'อัปโหลดรูปไม่สำเร็จ');
      setAvatarUrl(body.data?.avatarUrl ?? '');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          email,
          nickname,
          birthDate,
          gender,
          avatarUrl: avatarUrl || null,
        }),
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
        <h1 className="text-lg font-bold text-black">{t('editTitle')}</h1>
      </header>

      <form onSubmit={submit} className="space-y-4" aria-label={t('editTitle')}>
        <div className="flex flex-col items-center gap-2">
          <label className="relative cursor-pointer" aria-label={t('editTitle')}>
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-black text-2xl font-bold text-[#FFC400]">
              {avatarUrl ? (
                <img src={avatarUrl} alt={t('editTitle')} className="h-full w-full rounded-full object-cover" />
              ) : (
                (fullName || user.fullName).trim().slice(0, 1)
              )}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#FFC400] shadow">
              <Camera className="h-3.5 w-3.5 text-black" aria-hidden />
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              data-testid="input-avatar"
              disabled={uploadingAvatar}
              onChange={(e) => void uploadAvatar(e.target.files?.[0])}
            />
          </label>
          <span className="text-xs text-neutral-400">
            {uploadingAvatar ? t('avatarUploading') : t('avatarHint')}
          </span>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-neutral-500">{t('fullName')}</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            aria-label={t('fullName')}
            data-testid="input-fullname"
            className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#FFC400]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-neutral-500">{t('nickname')}</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('nickname')}
              aria-label={t('nickname')}
              data-testid="input-nickname"
              className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#FFC400]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-neutral-500">{t('gender')}</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              aria-label={t('gender')}
              data-testid="input-gender"
              className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#FFC400]"
            >
              <option value="">{t('genderUnset')}</option>
              <option value="male">ชาย / Male</option>
              <option value="female">หญิง / Female</option>
              <option value="other">อื่น ๆ / Other</option>
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-neutral-500">{t('birthDate')}</span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-label={t('birthDate')}
            data-testid="input-birthdate"
            className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#FFC400]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-neutral-500">{t('email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label={t('email')}
            data-testid="input-email"
            className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none transition-colors focus:border-[#FFC400]"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-neutral-500">{t('phoneReadonly')}</span>
          <div className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-neutral-50 px-4">
            <span className="text-sm font-semibold text-neutral-400">
              {phone.startsWith('0') ? `+66 ${phone.slice(1)}` : phone || '—'}
            </span>
            {phone && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-black">
                <BadgeCheck className="h-3.5 w-3.5 text-[#FFC400]" aria-hidden />
                {tc('verified')}
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
            {t('savedNotice')}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          data-testid="save-profile"
          className="btn-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
        >
          {saving ? (
            tc('saving')
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden />
              {tc('save')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
