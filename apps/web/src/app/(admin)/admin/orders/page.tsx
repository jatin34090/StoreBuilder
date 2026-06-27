'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { DataTable, Column } from '../../../../components/admin/DataTable';
import { StatusBadge } from '../../../../components/admin/StatusBadge';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { adminApi, AdminOrder, OrderStatus } from '../../../../lib/admin-api';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const params: Record<string, unknown> = {
    page,
    limit: 10,
    ...(statusTab !== 'ALL' ? { status: statusTab } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(fromDate ? { from: new Date(fromDate).toISOString() } : {}),
    ...(toDate ? { to: new Date(toDate).toISOString() } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: () => adminApi.orders.list(params),
  });

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: Column<AdminOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-slate-800">{row.orderNumber}</span>
      ),
    },
    {
      key: 'user',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.user?.name}</p>
          <p className="text-xs text-slate-400">{row.user?.email}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="text-sm text-center">{row.items?.length ?? 0}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => (
        <span className="text-sm font-semibold">₹{Number(row.total ?? 0).toLocaleString('en-IN')}</span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Payment',
      render: (row) => (
        <span className="text-xs text-slate-600">{row.payment?.method ?? row.payment?.status ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {format(new Date(row.createdAt), 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/orders/${row.id}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Orders" description="Manage and fulfil customer orders" />

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusTab(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusTab === tab.value
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search order # or customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 whitespace-nowrap">From:</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 whitespace-nowrap">To:</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        {(fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setPage(1);
            }}
          >
            Clear dates
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : isError ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 mb-4">Failed to load orders.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          keyField="id"
          total={total}
          page={page}
          limit={10}
          onPageChange={setPage}
          emptyMessage="No orders found."
        />
      )}
    </div>
  );
}
