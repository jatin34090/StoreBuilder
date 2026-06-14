'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Star, Eye, EyeOff, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { adminReviewsApi, type AdminReview } from '../../../../lib/admin-api';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? 'text-[#D4A853] fill-[#D4A853]' : 'text-slate-300'}`}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{rating}/5</span>
    </div>
  );
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<AdminReview | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'reviews', ratingFilter, visibilityFilter, page],
    queryFn: async () => {
      const res = await adminReviewsApi.list({
        rating: ratingFilter || undefined,
        isVisible: visibilityFilter !== '' ? visibilityFilter === 'true' : undefined,
        page,
        limit: 15,
      });
      return res.data;
    },
  });

  const reviews: AdminReview[] = (data as { items?: AdminReview[]; data?: AdminReview[] } | undefined)?.items ??
    (data as { items?: AdminReview[]; data?: AdminReview[] } | undefined)?.data ??
    (Array.isArray(data) ? (data as AdminReview[]) : []);
  const total: number = (data as { total?: number } | undefined)?.total ?? reviews.length;
  const totalPages = Math.ceil(total / 15);

  const visibilityMutation = useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      adminReviewsApi.setVisibility(id, isVisible),
    onSuccess: (_, { isVisible }) => {
      toast.success(isVisible ? 'Review published' : 'Review hidden');
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
    onError: () => toast.error('Failed to update review visibility'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminReviewsApi.delete(id),
    onSuccess: () => {
      toast.success('Review deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Failed to delete review'),
  });

  return (
    <div>
      <PageHeader
        title="Reviews"
        description={`${total} customer reviews`}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={ratingFilter}
          onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>{'★'.repeat(r)} {r} Star{r !== 1 ? 's' : ''}</option>
          ))}
        </select>
        <select
          value={visibilityFilter}
          onChange={(e) => { setVisibilityFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">All Visibility</option>
          <option value="true">Published</option>
          <option value="false">Hidden</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : isError ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-slate-500 mb-4">Failed to load reviews.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Review</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Visibility</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400">No reviews found</p>
                    </td>
                  </tr>
                ) : reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="max-w-[140px]">
                        <p className="font-medium text-slate-800 truncate">
                          {(review.product as { name?: string })?.name ?? 'Unknown product'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-slate-700">{(review.user as { name?: string })?.name ?? 'Anonymous'}</p>
                        <p className="text-xs text-slate-400">{(review.user as { phone?: string })?.phone ?? ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StarRating rating={review.rating} />
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {review.title && (
                        <p className="font-medium text-slate-700 text-xs mb-0.5 truncate">{review.title}</p>
                      )}
                      <p className="text-xs text-slate-500 line-clamp-2">{review.body ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {review.createdAt ? format(new Date(review.createdAt), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {review.isVisible !== false ? (
                        <Badge className="bg-green-100 text-green-700 border-0 text-xs">Published</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Hidden</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => visibilityMutation.mutate({ id: review.id, isVisible: review.isVisible === false })}
                          disabled={visibilityMutation.isPending}
                          title={review.isVisible !== false ? 'Hide review' : 'Publish review'}
                        >
                          {review.isVisible !== false ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setDeleteConfirm(review)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <span className="text-sm text-slate-600">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Review</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete this review from{' '}
            <strong>{(deleteConfirm?.user as { name?: string })?.name ?? 'this user'}</strong>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
