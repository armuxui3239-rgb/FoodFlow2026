'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FolderPlus, Layers, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api, useSession } from '@/lib/client';

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_visible: boolean;
}

const EMPTY_FORM = { name: '', sortOrder: '0', isVisible: true };

/** หน้าจัดการหมวดหมู่เมนู — เพิ่ม/แก้ไข (ไดอะล็อก) และลบ (กันลบถ้ายังมีเมนูใช้อยู่) */
export default function OwnerCategoriesPage() {
  const { user, ready } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ไดอะล็อกเพิ่ม/แก้ไข
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError('');
    api<{ data: Category[] }>('/api/owner/categories')
      .then((d) => setCategories(d.data ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ name: c.name, sortOrder: String(c.sort_order), isVisible: c.is_visible });
    setDialogOpen(true);
  };

  const submit = async () => {
    setError('');
    setNotice('');
    if (!form.name.trim()) {
      setError('กรุณาระบุชื่อหมวดหมู่');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api(`/api/owner/categories/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            sortOrder: Number(form.sortOrder) || 0,
            isVisible: form.isVisible,
          }),
        });
      } else {
        await api('/api/owner/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            sortOrder: Number(form.sortOrder) || 0,
            isVisible: form.isVisible,
          }),
        });
      }
      setDialogOpen(false);
      setNotice(editingId ? 'บันทึกการแก้ไขหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่ใหม่แล้ว');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (c: Category, next: boolean) => {
    const prev = categories;
    setCategories((xs) => xs.map((x) => (x.id === c.id ? { ...x, is_visible: next } : x)));
    try {
      await api(`/api/owner/categories/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: next }),
      });
    } catch (e) {
      setCategories(prev);
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    setError('');
    setNotice('');
    try {
      await api(`/api/owner/categories/${deleteId}`, { method: 'DELETE' });
      setNotice('ลบหมวดหมู่แล้ว');
      load();
    } catch (e) {
      // 409 = มีเมนูอ้างถึงหมวดนี้ ระบบบล็อกการลบ
      setError((e as Error).message);
    } finally {
      setDeleteId(null);
    }
  };

  const denied = ready && (!user || user.role !== 'restaurant');
  const deletingCat = categories.find((c) => c.id === deleteId);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <Link
            href="/owner/menu"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Layers className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">หมวดหมู่เมนู</h1>
          <Button
            onClick={openCreate}
            className="ml-auto h-10 rounded-full bg-[#FFF4CC] px-4 text-xs font-bold text-black shadow-none hover:bg-[#FFC400]"
          >
            <FolderPlus className="h-4 w-4" aria-hidden /> เพิ่มหมวดหมู่
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
        {notice && !error && (
          <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
            {notice}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">
            ยังไม่มีหมวดหมู่ — กด &ldquo;เพิ่มหมวดหมู่&rdquo; เพื่อเริ่มจัดกลุ่มเมนู
          </p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate-1 text-sm font-bold text-black">{c.name}</p>
                  <p className="text-xs text-neutral-400">ลำดับ {c.sort_order}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`mr-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.is_visible ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-400'}`}>
                    {c.is_visible ? 'แสดง' : 'ซ่อน'}
                  </span>
                  <Switch
                    checked={c.is_visible}
                    onCheckedChange={(v) => void toggleVisible(c, v)}
                    aria-label={`แสดง/ซ่อน ${c.name}`}
                  />
                  <button
                    onClick={() => openEdit(c)}
                    aria-label={`แก้ไข ${c.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
                  >
                    <Pencil className="h-4 w-4 text-neutral-500" aria-hidden />
                  </button>
                  <AlertDialog
                    open={deleteId === c.id}
                    onOpenChange={(open) => setDeleteId(open ? c.id : null)}
                  >
                    <AlertDialogTrigger asChild>
                      <button
                        aria-label={`ลบ ${c.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" aria-hidden />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>ลบหมวดหมู่ &ldquo;{deletingCat?.name}&rdquo;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          ถ้ายังมีเมนูอยู่ในหมวดนี้ ระบบจะไม่ให้ลบ — ต้องย้ายเมนูออกก่อน
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void remove()}
                          className="rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          ลบหมวดหมู่
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* ไดอะล็อกเพิ่ม/แก้ไขหมวดหมู่ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</DialogTitle>
            <DialogDescription>ตั้งชื่อหมวด ลำดับการแสดง และเปิด-ซ่อนจากหน้าร้าน</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-black">ชื่อหมวดหมู่ *</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
                placeholder="เช่น อาหารจานเดียว"
                className="mt-1 h-11 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-black">ลำดับการแสดง</span>
              <input
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                type="number"
                inputMode="numeric"
                className="mt-1 h-11 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
              <span className="text-sm font-semibold text-black">แสดงในหน้าร้าน</span>
              <Switch
                checked={form.isVisible}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isVisible: v }))}
                aria-label="แสดงในหน้าร้าน"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 rounded-full"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={saving}
              className="h-11 rounded-full bg-[#FFC400] text-black hover:bg-[#e6b000]"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
