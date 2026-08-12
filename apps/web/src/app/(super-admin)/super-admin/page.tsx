'use client';

import { useQuery } from '@tanstack/react-query';
import { Store, TrendingUp, Activity, Zap } from 'lucide-react';
import { superAdminApiClient } from '@/lib/super-admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PLAN_COLORS: Record<string, string> = {
  FREE:         'bg-slate-100 text-slate-700',
  STARTER:      'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-violet-100 text-violet-700',
  ENTERPRISE:   'bg-amber-100 text-amber-700',
};

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold leading-none mt-0.5">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'overview'],
    queryFn:  superAdminApiClient.getOverview,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 h-20 animate-pulse bg-slate-100 rounded-xl" /></Card>
          ))}
        </div>
      </div>
    );
  }

  const planBreakdown = Object.entries(data?.storesByPlan ?? {});

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Stores"   value={data?.totalStores  ?? 0} icon={Store}      color="bg-violet-100 text-violet-600" />
        <KpiCard title="Active Stores"  value={data?.activeStores ?? 0} icon={Activity}   color="bg-green-100  text-green-600"  />
        <KpiCard title="Platform Revenue" value={`₹${(data?.totalRevenue ?? 0).toLocaleString()}`} icon={TrendingUp} color="bg-amber-100 text-amber-600" />
        <KpiCard title="Suspended"      value={(data?.totalStores ?? 0) - (data?.activeStores ?? 0)} icon={Zap} color="bg-red-100 text-red-600" />
      </div>

      {/* Plan distribution + recent logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Stores by Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {planBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stores yet.</p>
            ) : planBreakdown.map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <Badge className={PLAN_COLORS[plan] ?? 'bg-slate-100 text-slate-700'} variant="secondary">
                  {plan}
                </Badge>
                <span className="text-sm font-medium">{count as number} store{(count as number) !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent API logs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent API Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.recentApiLogs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent requests.</p>
            ) : (
              <div className="space-y-2">
                {data!.recentApiLogs.slice(0, 8).map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      log.statusCode < 300 ? 'bg-green-100 text-green-700' :
                      log.statusCode < 400 ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>{log.statusCode}</span>
                    <span className="font-mono text-slate-500 w-12 shrink-0">{log.method}</span>
                    <span className="text-slate-700 truncate flex-1">{log.path}</span>
                    <span className="text-slate-400 shrink-0">{log.durationMs}ms</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
