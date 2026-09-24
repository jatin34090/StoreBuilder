'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, GripVertical, Eye, EyeOff, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { uploadAdminImage } from '@/lib/upload-helper';

interface Banner {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  desktopImage: string;
  mobileImage?: string | null;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM = {
  title: '', subtitle: '', ctaText: '', ctaUrl: '',
  desktopImage: '', mobileImage: '', isActive: true,
};

export default function BannersPage() {
  const [banners, setBanners]     = useState<Banner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [uploadingDesk, setUploadingDesk] = useState(false);
  const [uploadingMob, setUploadingMob]   = useState(false);
  const deskRef = useRef<HTMLInputElement>(null);
  const mobRef  = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.get('/banners/admin')
      .then((res) => {
        const data: Banner[] = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
        setBanners(data.sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => toast.error('Failed to load banners'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit   = (b: Banner) => {
    setEditId(b.id);
    setForm({
      title: b.title ?? '', subtitle: b.subtitle ?? '',
      ctaText: b.ctaText ?? '', ctaUrl: b.ctaUrl ?? '',
      desktopImage: b.desktopImage, mobileImage: b.mobileImage ?? '',
      isActive: b.isActive,
    });
    setShowForm(true);
  };

  const handleUpload = async (
    file: File,
    field: 'desktopImage' | 'mobileImage',
    setUploading: (v: boolean) => void,
  ) => {
    setUploading(true);
    try {
      const url = await uploadAdminImage(file, 'banner');
      setForm((f) => ({ ...f, [field]: url }));
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.desktopImage) { toast.error('Desktop image is required'); return; }
    setSaving(true);
    try {
      if (editId) {
        await api.patch(`/banners/${editId}`, form);
        toast.success('Banner updated');
      } else {
        await api.post('/banners', form);
        toast.success('Banner created');
      }
      setShowForm(false);
      load();
    } catch {
      toast.error('Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    try {
      await api.delete(`/banners/${id}`);
      toast.success('Banner deleted');
      load();
    } catch {
      toast.error('Failed to delete banner');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, isActive } : b));
    try {
      await api.patch(`/banners/${id}`, { isActive });
    } catch {
      toast.error('Failed to update banner');
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Banners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full-width promotional banners shown in the carousel on your homepage.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Banner
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No banners yet. Add your first banner to enable the carousel on your homepage.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <Card key={banner.id} className={!banner.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-28 rounded overflow-hidden flex-shrink-0 bg-muted">
                    <Image src={banner.desktopImage} alt={banner.title ?? ''} fill className="object-cover" sizes="112px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{banner.title || '(no title)'}</p>
                    {banner.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{banner.subtitle}</p>
                    )}
                    {banner.ctaUrl && (
                      <p className="text-xs text-muted-foreground truncate">{banner.ctaUrl}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={banner.isActive}
                      onCheckedChange={(v) => handleToggle(banner.id, v)}
                      aria-label="Toggle banner visibility"
                    />
                    <Button variant="ghost" size="sm" onClick={() => openEdit(banner)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(banner.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Banner' : 'Add Banner'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Desktop image */}
            <div className="space-y-1.5">
              <Label>Desktop Image <span className="text-destructive">*</span></Label>
              {form.desktopImage ? (
                <div className="relative aspect-[21/7] rounded overflow-hidden bg-muted">
                  <Image src={form.desktopImage} alt="" fill className="object-cover" sizes="500px" />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute bottom-2 right-2"
                    onClick={() => deskRef.current?.click()}
                    disabled={uploadingDesk}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => deskRef.current?.click()}
                  disabled={uploadingDesk}
                  className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg py-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">{uploadingDesk ? 'Uploading…' : 'Click to upload desktop image'}</span>
                  <span className="text-xs">Recommended: 1920×640px</span>
                </button>
              )}
              <input
                ref={deskRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file, 'desktopImage', setUploadingDesk);
                }}
              />
            </div>

            {/* Mobile image */}
            <div className="space-y-1.5">
              <Label>Mobile Image <span className="text-xs text-muted-foreground">(optional)</span></Label>
              {form.mobileImage ? (
                <div className="relative aspect-[4/3] max-w-xs rounded overflow-hidden bg-muted">
                  <Image src={form.mobileImage} alt="" fill className="object-cover" sizes="320px" />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute bottom-2 right-2"
                    onClick={() => mobRef.current?.click()}
                    disabled={uploadingMob}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => mobRef.current?.click()}
                  disabled={uploadingMob}
                  className="w-full border border-dashed border-muted-foreground/30 rounded py-3 flex items-center justify-center gap-2 text-muted-foreground text-sm hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingMob ? 'Uploading…' : 'Upload mobile image (optional)'}
                </button>
              )}
              <input
                ref={mobRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file, 'mobileImage', setUploadingMob);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Festive Sale"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subtitle</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Up to 40% off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTA Button Text</Label>
                <Input
                  value={form.ctaText}
                  onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
                  placeholder="Shop Now"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTA Link</Label>
                <Input
                  value={form.ctaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                  placeholder="/products"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="banner-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="banner-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploadingDesk || uploadingMob}>
              {saving ? 'Saving…' : (editId ? 'Save Changes' : 'Add Banner')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
