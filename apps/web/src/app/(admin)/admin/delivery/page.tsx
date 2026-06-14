'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Truck, MapPin, Edit2, Trash2, Package, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardContent } from '../../../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { TableSkeleton } from '../../../../components/admin/LoadingSkeleton';
import { adminDeliveryApi, type DeliveryAgent } from '../../../../lib/admin-api';

const agentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  vehicleNumber: z.string().optional(),
});
type AgentFormData = z.infer<typeof agentSchema>;

export default function DeliveryPage() {
  const queryClient = useQueryClient();
  const [agentModal, setAgentModal] = useState(false);
  const [editAgent, setEditAgent] = useState<DeliveryAgent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeliveryAgent | null>(null);

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['admin', 'delivery', 'agents'],
    queryFn: async () => {
      const res = await adminDeliveryApi.listAgents();
      return res.data;
    },
  });

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['admin', 'delivery', 'deliveries'],
    queryFn: async () => {
      const res = await adminDeliveryApi.listDeliveries({ limit: 20 });
      return res.data;
    },
  });

  const agents: DeliveryAgent[] = Array.isArray(agentsData)
    ? (agentsData as DeliveryAgent[])
    : ((agentsData as { data?: DeliveryAgent[] } | undefined)?.data ?? []);

  const deliveries: Record<string, unknown>[] = Array.isArray(deliveriesData)
    ? (deliveriesData as Record<string, unknown>[])
    : ((deliveriesData as { items?: Record<string, unknown>[]; data?: Record<string, unknown>[] } | undefined)?.items ??
       (deliveriesData as { items?: Record<string, unknown>[]; data?: Record<string, unknown>[] } | undefined)?.data ?? []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: AgentFormData) => adminDeliveryApi.createAgent(data),
    onSuccess: () => {
      toast.success('Delivery agent added');
      queryClient.invalidateQueries({ queryKey: ['admin', 'delivery'] });
      setAgentModal(false);
      reset();
    },
    onError: () => toast.error('Failed to add agent'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgentFormData }) =>
      adminDeliveryApi.updateAgent(id, data),
    onSuccess: () => {
      toast.success('Agent updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'delivery'] });
      setAgentModal(false);
      setEditAgent(null);
      reset();
    },
    onError: () => toast.error('Failed to update agent'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeliveryApi.deleteAgent(id),
    onSuccess: () => {
      toast.success('Agent removed');
      queryClient.invalidateQueries({ queryKey: ['admin', 'delivery'] });
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Failed to remove agent'),
  });

  const openCreate = () => {
    setEditAgent(null);
    reset();
    setAgentModal(true);
  };

  const openEdit = (agent: DeliveryAgent) => {
    setEditAgent(agent);
    reset({
      name: agent.name,
      phone: agent.phone,
      email: agent.email ?? '',
    });
    setAgentModal(true);
  };

  const onSubmit = (data: AgentFormData) => {
    if (editAgent) {
      updateMutation.mutate({ id: editAgent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const availableAgents = agents.filter((a) => a.isAvailable);
  const busyAgents = agents.filter((a) => !a.isAvailable);

  return (
    <div>
      <PageHeader
        title="Delivery"
        description={`${agents.length} delivery agents`}
        action={
          <Button onClick={openCreate} className="bg-[#4A0E8F] hover:bg-[#3d0b78]">
            <Plus className="w-4 h-4 mr-2" />
            Add Agent
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Agents</p>
              <p className="text-xl font-bold">{agents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Available</p>
              <p className="text-xl font-bold text-green-600">{availableAgents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">On Delivery</p>
              <p className="text-xl font-bold text-orange-600">{busyAgents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active Deliveries</p>
              <p className="text-xl font-bold text-purple-600">{deliveries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="agents">
        <TabsList className="mb-4">
          <TabsTrigger value="agents">Agents ({agents.length})</TabsTrigger>
          <TabsTrigger value="deliveries">Active Deliveries ({deliveries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          {agentsLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Deliveries</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center">
                          <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-400">No delivery agents yet. Add your first agent.</p>
                        </td>
                      </tr>
                    ) : agents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                              {agent.name[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800">{agent.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <div>{agent.phone}</div>
                          {agent.email && <div className="text-xs">{agent.email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {agent.isAvailable ? (
                            <Badge className="bg-green-100 text-green-700 border-0 text-xs">Available</Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">On Delivery</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {agent.totalDeliveries ?? 0}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 inline mr-1" />
                          <span className="text-xs">Live tracking</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(agent)}>
                              <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setDeleteConfirm(agent)}
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="deliveries">
          {deliveriesLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Est. Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                          No active deliveries
                        </td>
                      </tr>
                    ) : deliveries.map((d, i) => (
                      <tr key={String(d.id ?? i)} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-[#4A0E8F]">{String(d.orderId ?? d.id ?? '—')}</td>
                        <td className="px-4 py-3">
                          <Badge className="bg-slate-100 text-slate-700 border-0 text-xs">
                            {String(d.type ?? '—')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                            {String(d.status ?? '—')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {d.agent ? String((d.agent as { name?: string })?.name ?? '—') : 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {d.estimatedAt
                            ? format(new Date(String(d.estimatedAt)), 'dd MMM yyyy')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Agent Create/Edit Modal */}
      <Dialog open={agentModal} onOpenChange={(open) => { setAgentModal(open); if (!open) { setEditAgent(null); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editAgent ? 'Edit Agent' : 'Add Delivery Agent'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input {...register('name')} placeholder="Rajesh Kumar" className="mt-1" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Phone *</Label>
              <Input {...register('phone')} placeholder="9876543210" className="mt-1" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input {...register('email')} type="email" placeholder="agent@email.com" className="mt-1" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Vehicle Number</Label>
              <Input {...register('vehicleNumber')} placeholder="MH01AB1234" className="mt-1 uppercase" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAgentModal(false); setEditAgent(null); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#4A0E8F] hover:bg-[#3d0b78]">
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editAgent ? 'Update' : 'Add Agent'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Agent</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to remove <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
