'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  Briefcase,
  ChevronLeft,
  CircleHelp,
  Home,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/client';

interface AddressItem {
  id: string;
  label: string;
  address_line: string;
  is_default: boolean;
}

const LABEL_OPTIONS = [
  { value: 'บ้าน', Icon: Home },
  { value: 'ที่ทำงาน', Icon: Briefcase },
  { value: 'อื่น ๆ', Icon: MapPin },
] as const;

/** เลือกไอคอนตามป้ายที่อยู่ */
function labelIcon(label: string) {
  if (label === 'บ้าน') return Home;
  if (label === 'ที่ทำงาน') return Briefcase;
  return MapPin;
}

export default function AddressesPage() {
  const t = useTranslations('addresses');
  const tc = useTranslations('common');
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // สถานะฟอร์ม (Sheet) — ใช้ทั้งเพิ่มและแก้ไข
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AddressItem | null>(null);
  const [label, setLabel] = useState<string>('บ้าน');
  const [addressLine, setAddressLine] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [coords, setCoords] = useState({ lng: 100.5018, lat: 13.7563 });
  const [mapReady, setMapReady] = useState(false);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // สถานะลบ (ยืนยันด้วย AlertDialog)
  const [removing, setRemoving] = useState<AddressItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api<{ data: AddressItem[] }>('/api/addresses')
      .then((r) => setAddresses(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const openAdd = () => {
    setEditing(null);
    setLabel('บ้าน');
    setAddressLine('');
    setIsDefault(addresses.length === 0); // ที่อยู่แรกของบัญชี = ค่าเริ่มต้นอัตโนมัติ
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (a: AddressItem) => {
    setEditing(a);
    setLabel(a.label);
    setAddressLine(a.address_line);
    setIsDefault(a.is_default);
    setFormError('');
    setFormOpen(true);
  };

  useEffect(() => {
    if (!formOpen) {
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const maplibregl = await import('maplibre-gl');
      if (cancelled || !mapDiv.current) return;
      try {
        maplibregl.config.WORKER_URL = '/maplibre-gl-worker.mjs';
      } catch {
        // ignore worker override failure
      }
      const { buildPmtilesStyle, ensurePmtilesProtocol } = await import('@/lib/map-pmtiles');
      const pmtilesActive = await ensurePmtilesProtocol();
      const style = pmtilesActive
        ? buildPmtilesStyle()
        : new URL('/api/map/style', window.location.origin).toString();
      const map = new maplibregl.Map({
        container: mapDiv.current,
        style,
        center: [coords.lng, coords.lat],
        zoom: 14,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => !cancelled && setMapReady(true));
      map.on('moveend', () => {
        const c = map.getCenter();
        setCoords({ lng: c.lng, lat: c.lat });
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [formOpen]);

  const save = async () => {
    setFormError('');
    setSaving(true);
    try {
      const payload = JSON.stringify({
        label,
        addressLine,
        isDefault,
        lat: coords.lat,
        lng: coords.lng,
      });
      if (editing) {
        await api(`/api/addresses/${editing.id}`, { method: 'PATCH', body: payload });
      } else {
        await api('/api/addresses', { method: 'POST', body: payload });
      }
      setFormOpen(false);
      load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/api/addresses/${removing.id}`, { method: 'DELETE' });
      setAddresses((prev) => prev.filter((a) => a.id !== removing.id));
      setRemoving(null);
    } catch (e) {
      setError((e as Error).message);
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดที่อยู่">
        <div className="relative flex items-center justify-center py-1">
          <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-100" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-full max-w-64 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={load} className="btn-brand h-11 rounded-full px-6 text-sm">
          {tc('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* หัวเรื่อง — ย้อนกลับไปหน้าโปรไฟล์ */}
      <div className="relative flex items-center justify-center py-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับ"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white hover:bg-neutral-50"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">{t('title')}</h1>
        <button
          type="button"
          onClick={openAdd}
          className="absolute right-0 flex h-10 w-10 items-center justify-center rounded-full bg-black text-[#FFC400] active:scale-90"
          aria-label={t('addNew')}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#FFF4CC]">
            <MapPin className="h-10 w-10 text-black" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-black">{t('emptyTitle')}</h2>
          <p className="max-w-64 text-sm text-neutral-400">
            {t('emptySubtitle')}
          </p>
          <button onClick={openAdd} className="btn-brand inline-flex h-12 items-center px-8 text-sm">
            {t('addNew')}
          </button>
        </div>
      ) : (
        <ul className="space-y-3" aria-label={t('title')}>
          {addresses.map((a) => {
            const Icon = labelIcon(a.label);
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC]">
                  <Icon className="h-5 w-5 text-black" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="flex items-center gap-2">
                    <span className="truncate-1 text-sm font-bold text-black">{a.label}</span>
                    {a.is_default && (
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-[#FFC400]">
                        {t('defaultBadge')}
                      </span>
                    )}
                  </p>
                  <p className="truncate-2 text-xs text-neutral-400">{a.address_line}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    aria-label={`แก้ไขที่อยู่ ${a.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[#FFF4CC] active:scale-90"
                  >
                    <Pencil className="h-4.5 w-4.5 text-black" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(a)}
                    aria-label={`ลบที่อยู่ ${a.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 active:scale-90"
                  >
                    <Trash2 className="h-4.5 w-4.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {addresses.length > 0 && (
        <button
          type="button"
          onClick={openAdd}
          className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden />
          เพิ่มที่อยู่ใหม่
        </button>
      )}

      {/* ฟอร์มเพิ่ม/แก้ไขที่อยู่ — เปิดจากด้านล่างตามสไตล์มือถือ */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 pt-4">
          <SheetHeader className="space-y-1 p-0 text-left">
            <SheetTitle className="text-base font-bold text-black">
              {editing ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่'}
            </SheetTitle>
            <SheetDescription className="text-xs text-neutral-400">
              ระบุป้ายชื่อและรายละเอียดที่อยู่สำหรับการจัดส่ง
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* เลือกป้ายที่อยู่ */}
            <div>
              <p className="mb-2 text-xs font-semibold text-neutral-500">ป้ายที่อยู่</p>
              <div className="grid grid-cols-3 gap-2">
                {LABEL_OPTIONS.map(({ value, Icon }) => {
                  const active = label === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLabel(value)}
                      aria-pressed={active}
                      className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-semibold transition-colors ${
                        active
                          ? 'border-black bg-black text-[#FFC400]'
                          : 'border-line bg-white text-neutral-500 hover:bg-[#FFF4CC]/60'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* รายละเอียดที่อยู่ */}
            <div>
              <label htmlFor="address-line" className="mb-2 block text-xs font-semibold text-neutral-500">
                ที่อยู่จัดส่ง
              </label>
              <textarea
                id="address-line"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                rows={3}
                placeholder="บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                className="w-full resize-none rounded-2xl border border-line bg-white p-3 text-sm text-black outline-none placeholder:text-neutral-300 focus:border-black"
              />
              <p className="mt-1 text-[11px] text-neutral-400">อย่างน้อย 10 ตัวอักษร</p>
            </div>

            {/* ปักหมุดตำแหน่งบนแผนที่ */}
            <div>
              <span className="mb-2 block text-xs font-semibold text-neutral-500">
                ปักหมุดตำแหน่งจัดส่ง ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </span>
              <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-line bg-neutral-100">
                <div ref={mapDiv} className="h-full w-full" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="-mt-5 flex h-9 w-9 items-center justify-center rounded-full bg-black text-[#FFC400] shadow-md">
                    <MapPin className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                {!mapReady && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-neutral-500">
                    กำลังโหลดแผนที่...
                  </div>
                )}
              </div>
            </div>

            {/* ตั้งเป็นค่าเริ่มต้น */}
            <div className="flex items-center justify-between rounded-2xl border border-line bg-white p-3">
              <span className="text-sm font-medium text-black">ตั้งเป็นที่อยู่ค่าเริ่มต้น</span>
              <Switch
                checked={isDefault}
                onCheckedChange={setIsDefault}
                aria-label="ตั้งเป็นที่อยู่ค่าเริ่มต้น"
                className="data-[state=checked]:bg-black data-[state=unchecked]:bg-neutral-200"
              />
            </div>

            {formError && <p className="text-xs text-red-500">{formError}</p>}

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !label.trim() || addressLine.trim().length < 10}
              className="btn-brand flex h-12 w-full items-center justify-center text-sm"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกที่อยู่'}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ยืนยันก่อนลบที่อยู่ */}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ลบที่อยู่นี้?</AlertDialogTitle>
            <AlertDialogDescription>
              ที่อยู่ “{removing?.label ?? ''} — {removing?.address_line ?? ''}” จะถูกลบถาวร
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="mt-0 flex-1 rounded-full border-line" disabled={busy}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 rounded-full bg-red-500 text-white hover:bg-red-600"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              ลบที่อยู่
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
