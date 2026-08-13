'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { fmtDate } from '../../../../lib/formatters';
import { Plus, Search, Pencil, Trash2, ChevronUp, ChevronDown, ImageIcon } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { DataTable, Column } from '../../../../components/admin/DataTable';
import { StatusBadge } from '../../../../components/admin/StatusBadge';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { adminApi, AdminProduct } from '../../../../lib/admin-api';

// Lazy-load heavy modals — only compiled when user opens them
const ProductFormModal = dynamic(
  () => import('../../../../components/admin/products/ProductFormModal').then((m) => ({ default: m.ProductFormModal })),
  { ssr: false },
);
const VariantManager = dynamic(
  () => import('../../../../components/admin/products/VariantManager').then((m) => ({ default: m.VariantManager })),
  { ssr: false },
);
const ProductImageManager = dynamic(
  () => import('../../../../components/admin/products/ProductImageManager').then((m) => ({ default: m.ProductImageManager })),
  { ssr: false },
);

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<AdminProduct | null>(null);
  const [variantProduct, setVariantProduct] = useState<AdminProduct | null>(null);
  const [imageProduct, setImageProduct] = useState<AdminProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // The admin products list API only supports page/limit/category server-side,
  // so search, status and sort are applied client-side over the fetched page.
  const params: Record<string, unknown> = {
    page,
    limit: 10,
    ...(categoryFilter !== 'ALL' ? { category: categoryFilter } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: () => adminApi.products.list(params),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminApi.categories.list(),
  });

  const categories = categoriesData?.items ?? [];
  const total = data?.total ?? 0;

  const products = (data?.items ?? [])
    .filter((p) =>
      debouncedSearch
        ? p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          p.slug.toLowerCase().includes(debouncedSearch.toLowerCase())
        : true,
    )
    .filter((p) =>
      statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? p.isActive : !p.isActive,
    )
    .sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'price') return (Number(a.basePrice) - Number(b.basePrice)) * dir;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.products.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Product deleted');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete product'),
  });

  const toggleSort = useCallback(
    (col: string) => {
      if (sortBy === col) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(col);
        setSortOrder('desc');
      }
      setPage(1);
    },
    [sortBy],
  );

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="inline w-3 h-3 ml-0.5" />
    ) : (
      <ChevronDown className="inline w-3 h-3 ml-0.5" />
    );
  }

  const columns: Column<AdminProduct>[] = [
    {
      key: 'image',
      header: 'Image',
      render: (row) => {
        const img = row.images?.find((i) => i.isPrimary) ?? row.images?.[0];
        return img ? (
          <img
            src={img.url}
            alt={row.name}
            className="w-[60px] h-[60px] rounded-md object-cover border border-slate-200"
          />
        ) : (
          <div className="w-[60px] h-[60px] rounded-md bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
            No img
          </div>
        );
      },
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <button
            className="font-medium text-slate-900 hover:underline text-left"
            onClick={() => toggleSort('name')}
          >
            {row.name}
            <SortIcon col="name" />
          </button>
          <p className="text-xs text-slate-400 font-mono">{row.slug}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-sm">{row.category?.name ?? '—'}</span>,
    },
    {
      key: 'basePrice',
      header: 'Base Price',
      render: (row) => (
        <button className="text-sm font-medium" onClick={() => toggleSort('price')}>
          ₹{Number(row.basePrice ?? 0).toLocaleString('en-IN')}
          <SortIcon col="price" />
        </button>
      ),
    },
    {
      key: 'discountPct',
      header: 'Discount',
      render: (row) => {
        const pct = row.discountPct ?? 0;
        if (!pct) return <span className="text-slate-400">—</span>;
        return <span className="text-sm text-green-600">{pct}%</span>;
      },
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (row) => {
        const total = row.variants?.reduce((acc, v) => acc + v.stock, 0) ?? 0;
        return (
          <span className={`text-sm font-medium ${total === 0 ? 'text-red-500' : 'text-slate-700'}`}>
            {total}
          </span>
        );
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <button className="text-xs text-slate-500" onClick={() => toggleSort('createdAt')}>
          {fmtDate(row.createdAt)}
          <SortIcon col="createdAt" />
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setEditProduct(row);
              setModalOpen(true);
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setImageProduct(row)}
            title="Manage images"
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1" />
            Images
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setVariantProduct(row)}
          >
            Variants
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Products"
        description="Manage your jewellery catalogue"
        action={
          <Button
            onClick={() => {
              setEditProduct(null);
              setModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> New Product
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={9} />
      ) : isError ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 mb-4">Failed to load products.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={products}
          keyField="id"
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
          emptyMessage="No products found. Create your first product."
        />
      )}

      {/* Create/Edit Modal */}
      <ProductFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditProduct(null);
        }}
        product={editProduct}
      />

      {/* Variants Dialog */}
      {variantProduct && (
        <Dialog open={!!variantProduct} onOpenChange={(o) => !o && setVariantProduct(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Variants — {variantProduct.name}</DialogTitle>
            </DialogHeader>
            <VariantManager
              productId={variantProduct.id}
              variants={variantProduct.variants ?? []}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setVariantProduct(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Manager */}
      {imageProduct && (
        <ProductImageManager
          productId={imageProduct.id}
          productName={imageProduct.name}
          open={!!imageProduct}
          onClose={() => setImageProduct(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Product</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteTarget.name}</span>? This action cannot be
              undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
