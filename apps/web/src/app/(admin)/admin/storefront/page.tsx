'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { GripVertical, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import Link from 'next/link';

const SECTION_LABELS: Record<string, string> = {
  HERO:             'Hero Section',
  BANNERS:          'Banners',
  CATEGORIES:       'Shop by Category',
  FEATURED_PRODUCTS:'Featured Products',
  WHY_CHOOSE_US:    'Why Choose Us',
};

const SECTION_DESC: Record<string, string> = {
  HERO:             'Large headline, tagline, and call-to-action buttons',
  BANNERS:          'Full-width image banners with auto-advance carousel',
  CATEGORIES:       'Scrolling category cards with images',
  FEATURED_PRODUCTS:'Horizontally scrollable featured product cards',
  WHY_CHOOSE_US:    'Trust signals — shipping, returns, quality badges',
};

interface Section {
  id?: string;
  type: string;
  enabled: boolean;
  sortOrder: number;
}

export default function StorefrontPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    api.get('/storefront/homepage')
      .then((res) => {
        const data: Section[] = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
        setSections(data.sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => toast.error('Failed to load storefront sections'))
      .finally(() => setLoading(false));
  }, []);

  const toggleSection = async (type: string, enabled: boolean) => {
    setSections((prev) => prev.map((s) => s.type === type ? { ...s, enabled } : s));
    setSaving(true);
    try {
      await api.patch('/storefront/homepage/section', { type, enabled });
      toast.success(`${SECTION_LABELS[type] ?? type} ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update section');
    } finally {
      setSaving(false);
    }
  };

  const moveSection = (fromIdx: number, toIdx: number) => {
    const next = [...sections];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const reordered = next.map((s, i) => ({ ...s, sortOrder: i }));
    setSections(reordered);
    return reordered.map((s) => s.type);
  };

  const handleDrop = async (toIdx: number) => {
    if (dragging === null || dragging === toIdx) return;
    const newOrder = moveSection(dragging, toIdx);
    setDragging(null);
    setDragOver(null);
    setSaving(true);
    try {
      await api.patch('/storefront/homepage/reorder', { order: newOrder });
      toast.success('Section order saved');
    } catch {
      toast.error('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const moveUp = async (idx: number) => {
    if (idx === 0) return;
    const newOrder = moveSection(idx, idx - 1);
    setSaving(true);
    try {
      await api.patch('/storefront/homepage/reorder', { order: newOrder });
      toast.success('Order updated');
    } catch {
      toast.error('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const moveDown = async (idx: number) => {
    if (idx === sections.length - 1) return;
    const newOrder = moveSection(idx, idx + 1);
    setSaving(true);
    try {
      await api.patch('/storefront/homepage/reorder', { order: newOrder });
      toast.success('Order updated');
    } catch {
      toast.error('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Storefront Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arrange and toggle sections shown on your homepage.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/" target="_blank">
            <ExternalLink className="h-4 w-4 mr-1.5" /> Preview
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section, idx) => (
            <Card
              key={section.type}
              draggable
              onDragStart={() => setDragging(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(idx)}
              className={`transition-all cursor-grab active:cursor-grabbing ${
                dragOver === idx ? 'ring-2 ring-primary' : ''
              } ${!section.enabled ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {SECTION_LABELS[section.type] ?? section.type}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {SECTION_DESC[section.type] ?? ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0 || saving}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors p-1"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === sections.length - 1 || saving}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors p-1"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <Switch
                      checked={section.enabled}
                      onCheckedChange={(v) => toggleSection(section.type, v)}
                      disabled={saving}
                      aria-label={`Toggle ${SECTION_LABELS[section.type] ?? section.type}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Drag rows to reorder, or use the ↑↓ buttons. Toggle the switch to show/hide a section.
      </p>
    </div>
  );
}
