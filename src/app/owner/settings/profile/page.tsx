'use client';

import { useEffect, useState } from 'react';
import { Camera, ImagePlus, Save, Store } from 'lucide-react';
import { api } from '@/lib/client';
import { OwnerSubShell } from '@/components/portal/owner-header';

interface Profile {
  name: string;
  description: string | null;
  cuisine_types: string[] | null;
  price_range: string;
  address_line: string | null;
  city: string | null;
  district: string | null;
  phone: string | null;
  logo_url: string | null;
  cover_url: string | null;
}

/** หน้าตั้งค่าโปรไฟล์ร้าน — แก้ชื่อ คำอธิบาย ประเภทอาหาร ที่อยู่ และรูปโลโก้/ปก */
export default function OwnerProfileSettingsPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisineTypes, setCuisineTypes] = useState('');
  const [priceRange, setPriceRange] = useState('$');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api<{ data: Profile }>('/api/owner/settings/profile')
      .then((d) => {
        const p = d.data;
        setName(p.name ?? '');
        setDescription(p.description ?? '');
        setCuisineTypes((p.cuisine_types ?? []).join(', '));
        setPriceRange(p.price_range ?? '$');
        setAddressLine(p.address_line ?? '');
        setCity(p.city ?? '');
        setDistrict(p.district ?? '');
        setPhone(p.phone ?? '');
        setLogoUrl(p.logo_url ?? '');
        setCoverUrl(p.cover_url ?? '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api('/api/owner/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, description, cuisineTypes, priceRange, addressLine, city, district, phone, logoUrl, coverUrl }),
      });
      setSuccess('บันทึกเรียบร้อยแล้ว');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'h-11 w-full rounded-2xl border border-line px-4 text-sm outline-none focus:border-[#FFC400]';

  return (
    <OwnerSubShell
      title="โปรไฟล์ร้าน"
      subtitle="ข้อมูลที่ลูกค้าเห็นในแอป"
      Icon={Store}
      right={
        <button onClick={() => void save()} disabled={saving || loading} className="btn-brand flex h-10 items-center gap-1.5 px-4 text-xs disabled:opacity-50">
          <Save className="h-4 w-4" aria-hidden /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      }
    >
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
          {success}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : (
        <>
          {/* รูปโลโก้และรูปปก */}
          <section className="grid grid-cols-2 gap-3" aria-label="รูปโลโก้และรูปปก">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-500">
                <ImagePlus className="h-3.5 w-3.5" aria-hidden /> URL รูปโลโก้
              </span>
              {logoUrl ? (
                <img src={logoUrl} alt="โลโก้ร้าน" className="h-24 w-full rounded-2xl border border-line object-cover" />
              ) : (
                <span className="flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-line bg-neutral-50 text-neutral-300">
                  <Store className="h-6 w-6" aria-hidden />
                </span>
              )}
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className={`${inputCls} mt-2`} />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-500">
                <Camera className="h-3.5 w-3.5" aria-hidden /> URL รูปปกร้าน
              </span>
              {coverUrl ? (
                <img src={coverUrl} alt="รูปปกร้าน" className="h-24 w-full rounded-2xl border border-line object-cover" />
              ) : (
                <span className="flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-line bg-neutral-50 text-neutral-300">
                  <ImagePlus className="h-6 w-6" aria-hidden />
                </span>
              )}
              <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className={`${inputCls} mt-2`} />
            </label>
          </section>

          {/* ข้อมูลพื้นฐาน */}
          <section className="space-y-3 rounded-3xl border border-line p-4" aria-label="ข้อมูลร้าน">
            <h2 className="text-sm font-bold text-black">ข้อมูลร้าน</h2>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-500">
                <Store className="h-3.5 w-3.5" aria-hidden /> ชื่อร้าน
              </span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">คำอธิบายร้าน</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="อธิบายจุดเด่นของร้านสั้น ๆ"
                className="w-full rounded-2xl border border-line p-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ประเภทอาหาร (คั่นด้วยจุลภาค)</span>
              <input
                value={cuisineTypes}
                onChange={(e) => setCuisineTypes(e.target.value)}
                placeholder="เช่น อาหารไทย, ก๋วยเตี๋ยว, เครื่องดื่ม"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ช่วงราคา</span>
              <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="$">$ — ราคาประหยัด</option>
                <option value="$$">$$ — ราคาปานกลาง</option>
                <option value="$$$">$$$ — ราคาพรีเมียม</option>
              </select>
            </label>
          </section>

          {/* ที่อยู่และติดต่อ */}
          <section className="space-y-3 rounded-3xl border border-line p-4" aria-label="ที่อยู่และการติดต่อ">
            <h2 className="text-sm font-bold text-black">ที่อยู่และการติดต่อ</h2>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ที่อยู่</span>
              <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">เขต/อำเภอ</span>
                <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">เมือง/จังหวัด</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">เบอร์โทรศัพท์ร้าน</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </label>
          </section>
        </>
      )}
    </OwnerSubShell>
  );
}
