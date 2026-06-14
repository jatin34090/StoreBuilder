'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, AlertTriangle, Package, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { adminInventoryApi, type InventoryItem } from '../../../../lib/admin-api';
import { useDebounce } from '../../../../hooks/useDebounce';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: inventoryData, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'inventory', debouncedSearch, page],
    queryFn: async () => {
      const res = await adminInventoryApi.list({
        search: debouncedSearch || undefined,
        page,
        limit: 20,
      });
      return res.data;
    },
    enabled: !showLowStock,
  });

  const { data: lowStockData, isLoading: lowStockLoading } = useQuery({
    queryKey: ['admin', 'inventory', 'low-stock'],
    queryFn: async () => {
      const res = await adminInventoryApi.lowStock({ threshold: 5 });
      return res.data;
    },
  });

  const items: InventoryItem[] = showLowStock
    ? (Array.isArray(lowStockData) ? (lowStockData as InventoryItem[]) : [])
    : ((inventoryData as { items?: InventoryItem[]; data?: InventoryItem[] } | undefined)?.items ??
       (inventoryData as { items?: InventoryItem[]; data?: InventoryItem[] } | undefined)?.data ??
       (Array.isArray(inventoryData) ? (inventoryData as InventoryItem[]) : []));

  const total: number = (inventoryData as { total?: number } | undefined)?.total ?? items.length;
  const lowStockCount = Array.isArray(lowStockData) ? (lowStockData as InventoryItem[]).length : 0;
  const totalPages = Math.ceil(total / 20);

  const updateMutation = useMutation({
    mutationFn: ({ variantId, stock }: { variantId: string; stock: number }) =>
      adminInventoryApi.update(variantId, stock),
    onSuccess: () => {
      toast.success('Stock updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      setEditingId(null);
    },
    onError: () => toast.error('Failed to update stock'),
  });

  const handleEditStart = (item: InventoryItem) => {
    setEditingId(item.variantId);
    setEditStock(String(item.stock));
  };

  const handleEditSave = (variantId: string) => {
    const stock = parseInt(editStock);
    if (isNaN(stock) || stock < 0) {
      toast.error('Stock must be a non-negative number');
      return;
    }
    updateMutation.mutate({ variantId, stock });
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Manage stock levels across all product variants"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total SKUs</p>
              <p className="text-xl font-bold text-slate-900">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-0 shadow-sm cursor-pointer transition-all ${showLowStock ? 'ring-2 ring-red-400' : 'hover:shadow-md'}`}
          onClick={() => setShowLowStock(!showLowStock)}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Low Stock (≤5)</p>
              <p className="text-xl font-bold text-red-600">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">In Stock</p>
              <p className="text-xl font-bold text-green-600">{total - lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {!showLowStock && (
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search product, SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9"
            />
          </div>
        )}
        {showLowStock && (
          <Badge className="bg-red-100 text-red-700 border-0 self-center px-3 py-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Showing low stock items only
          </Badge>
        )}
        <Button
          variant={showLowStock ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowLowStock(!showLowStock)}
          className={showLowStock ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          {showLowStock ? 'Show All' : `Low Stock (${lowStockCount})`}
        </Button>
      </div>

      {/* Table */}
      {(isLoading && !showLowStock) || (lowStockLoading && showLowStock) ? (
        <TableSkeleton rows={10} cols={6} />
      ) : isError ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-slate-500 mb-4">Failed to load inventory.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Variant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      {showLowStock ? 'No low stock items 🎉' : 'No inventory items found'}
                    </td>
                  </tr>
                ) : items.map((item) => (
                  <tr key={item.variantId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.productName} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <span className="font-medium text-slate-800 max-w-[180px] truncate">{item.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.sku}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {[item.size, item.color].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      ₹{Number(item.price).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === item.variantId ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editStock}
                            onChange={(e) => setEditStock(e.target.value)}
                            className="h-7 w-20 text-sm"
                            min="0"
                            autoFocus
                          />
                          <Button size="sm" className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700" onClick={() => handleEditSave(item.variantId)} disabled={updateMutation.isPending}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className={`font-semibold ${item.stock <= 0 ? 'text-red-600' : item.stock <= 5 ? 'text-orange-500' : 'text-slate-800'}`}>
                          {item.stock}
                          {item.stock <= 5 && item.stock > 0 && (
                            <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-orange-400" />
                          )}
                          {item.stock === 0 && (
                            <span className="ml-2 text-xs text-red-500 font-normal">Out of stock</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId !== item.variantId && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleEditStart(item)}>
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          Edit Stock
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!showLowStock && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <span className="text-sm">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
