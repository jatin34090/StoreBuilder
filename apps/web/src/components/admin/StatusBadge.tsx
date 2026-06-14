import { Badge } from '../ui/badge';

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

type Status = OrderStatus | PaymentStatus | string;

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'default';
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  // Order statuses
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  PROCESSING: { label: 'Processing', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  SHIPPED: { label: 'Shipped', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  DELIVERED: { label: 'Delivered', className: 'bg-green-100 text-green-800 border-green-200' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  RETURNED: { label: 'Returned', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  // Payment statuses
  PAID: { label: 'Paid', className: 'bg-green-100 text-green-800 border-green-200' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200' },
  REFUNDED: { label: 'Refunded', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  PARTIALLY_REFUNDED: {
    label: 'Partial Refund',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
};

export function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <Badge
      variant="outline"
      className={`${config.className} font-medium border ${size === 'sm' ? 'text-xs px-2 py-0' : 'text-xs px-2.5 py-0.5'}`}
    >
      {config.label}
    </Badge>
  );
}
