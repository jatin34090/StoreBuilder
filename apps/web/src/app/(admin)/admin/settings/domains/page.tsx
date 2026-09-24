'use client';

import { useState, useEffect, useCallback } from 'react';

interface StoreDomain {
  id: string;
  domain: string;
  type: 'PLATFORM_SUBDOMAIN' | 'CUSTOM_DOMAIN';
  status: 'PENDING' | 'VERIFIED' | 'ACTIVE' | 'FAILED' | 'DISABLED';
  isPrimary: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

interface VerificationInstructions {
  txtRecord: { host: string; type: string; value: string; ttl: number };
  cnameRecord: { host: string; type: string; target: string; note: string };
}

interface AddResult {
  id: string;
  domain: string;
  verificationInstructions: VerificationInstructions;
}

const STATUS_LABELS: Record<StoreDomain['status'], { label: string; color: string; hint: string }> = {
  PENDING:  { label: 'Pending',  color: 'text-yellow-600 bg-yellow-50',  hint: 'Configure the DNS records below, then click Verify DNS.' },
  VERIFIED: { label: 'Verified', color: 'text-blue-600 bg-blue-50',      hint: 'Domain ownership verified.' },
  ACTIVE:   { label: 'Active',   color: 'text-green-600 bg-green-50',    hint: 'Your storefront is live on this domain.' },
  FAILED:   { label: 'Failed',   color: 'text-red-600 bg-red-50',        hint: 'DNS verification failed — check your DNS records and try again.' },
  DISABLED: { label: 'Disabled', color: 'text-gray-400 bg-gray-100',     hint: 'This domain is disabled.' },
};

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const envelope = body as { message?: string; data?: { message?: string } };
    throw new Error(envelope.data?.message ?? envelope.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json() as { data?: unknown };
  // Unwrap the global ResponseInterceptor envelope { success, data, message }
  return json?.data !== undefined ? json.data : json;
}

export default function DomainsPage() {
  const [domains, setDomains]                   = useState<StoreDomain[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');
  const [newDomain, setNewDomain]               = useState('');
  const [adding, setAdding]                     = useState(false);
  const [addError, setAddError]                 = useState('');
  const [addResult, setAddResult]               = useState<AddResult | null>(null);
  const [verifying, setVerifying]               = useState<string | null>(null);
  const [verifyResult, setVerifyResult]         = useState<Record<string, string>>({});
  const [actionError, setActionError]           = useState<Record<string, string>>({});
  // instructions panel: keyed by domain id → instructions or null (loading)
  const [instructions, setInstructions]         = useState<Record<string, VerificationInstructions | null>>({});
  const [loadingInstr, setLoadingInstr]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/admin/store/domains');
      setDomains(Array.isArray(data) ? data : (data as { data?: StoreDomain[] }).data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    setAddResult(null);
    try {
      const result = await apiFetch('/admin/store/domains', {
        method: 'POST',
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      setAddResult(result as AddResult);
      setNewDomain('');
      await load();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    setVerifyResult((r) => ({ ...r, [id]: '' }));
    setActionError((r) => ({ ...r, [id]: '' }));
    try {
      const result = await apiFetch(`/admin/store/domains/${id}/verify`, { method: 'POST' });
      const msg = (result as { message?: string; verified?: boolean }).message ?? '';
      setVerifyResult((r) => ({ ...r, [id]: msg }));
      await load();
    } catch (e) {
      setActionError((r) => ({ ...r, [id]: (e as Error).message }));
    } finally {
      setVerifying(null);
    }
  };

  const handleToggleInstructions = async (id: string) => {
    // If already showing, hide
    if (id in instructions) {
      setInstructions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setLoadingInstr(id);
    try {
      const result = await apiFetch(`/admin/store/domains/${id}/instructions`) as {
        verificationInstructions?: VerificationInstructions;
      };
      setInstructions((prev) => ({
        ...prev,
        [id]: result.verificationInstructions ?? null,
      }));
    } catch (e) {
      setActionError((r) => ({ ...r, [id]: (e as Error).message }));
    } finally {
      setLoadingInstr(null);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setActionError((r) => ({ ...r, [id]: '' }));
    try {
      await apiFetch(`/admin/store/domains/${id}/primary`, { method: 'PATCH' });
      await load();
    } catch (e) {
      setActionError((r) => ({ ...r, [id]: (e as Error).message }));
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this domain?')) return;
    setActionError((r) => ({ ...r, [id]: '' }));
    try {
      await apiFetch(`/admin/store/domains/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setActionError((r) => ({ ...r, [id]: (e as Error).message }));
    }
  };

  const platformSubdomain = domains.find((d) => d.type === 'PLATFORM_SUBDOMAIN');
  const customDomains      = domains.filter((d) => d.type === 'CUSTOM_DOMAIN');

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Domains</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your store&apos;s platform subdomain and custom domains.
        </p>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Platform subdomain */}
          <section className="rounded-lg border p-5 space-y-2">
            <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
              Platform URL
            </h2>
            {platformSubdomain ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-base">https://{platformSubdomain.domain}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Always active — cannot be removed.
                    {platformSubdomain.isPrimary && ' · Primary'}
                  </p>
                </div>
                <StatusBadge status={platformSubdomain.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Platform subdomain not yet provisioned. Contact support.
              </p>
            )}
          </section>

          {/* Custom domains */}
          <section className="rounded-lg border p-5 space-y-4">
            <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
              Custom Domains
            </h2>

            {customDomains.length === 0 && (
              <p className="text-sm text-muted-foreground">No custom domains connected yet.</p>
            )}

            {customDomains.map((d) => {
              const info     = STATUS_LABELS[d.status];
              const needsDns = d.status === 'PENDING' || d.status === 'FAILED';
              const instrData = instructions[d.id];
              const showInstr = d.id in instructions;

              return (
                <div key={d.id} className="rounded border p-4 space-y-3">
                  {/* Domain header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-sm truncate">
                        {d.domain}
                        {d.isPrimary && (
                          <span className="ml-2 text-xs font-sans text-muted-foreground">Primary</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.hint}</p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>

                  {/* DNS instructions panel — toggleable for PENDING / FAILED */}
                  {needsDns && (
                    <div>
                      <button
                        onClick={() => void handleToggleInstructions(d.id)}
                        disabled={loadingInstr === d.id}
                        className="text-xs text-primary underline underline-offset-2 hover:no-underline disabled:opacity-50"
                      >
                        {loadingInstr === d.id
                          ? 'Loading…'
                          : showInstr
                          ? 'Hide DNS records'
                          : 'View DNS records to configure'}
                      </button>

                      {showInstr && (
                        instrData ? (
                          <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-4 space-y-3 text-sm">
                            <p className="font-medium text-blue-900 text-xs">
                              Add these records at your domain registrar (Cloudflare, GoDaddy, Namecheap, etc.):
                            </p>
                            <DnsRecord
                              label="Step 1 — TXT record (proves you own the domain)"
                              host={instrData.txtRecord.host}
                              type="TXT"
                              value={instrData.txtRecord.value}
                              ttl={instrData.txtRecord.ttl}
                            />
                            <DnsRecord
                              label="Step 2 — CNAME record (points domain to platform)"
                              host={instrData.cnameRecord.host}
                              type="CNAME"
                              value={instrData.cnameRecord.target}
                              note={instrData.cnameRecord.note}
                            />
                            <p className="text-xs text-blue-700">
                              DNS changes can take up to 48 hours to propagate. Once done, click{' '}
                              <strong>Verify DNS</strong> below.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2 rounded border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 space-y-1">
                            <p className="font-medium">Verification token missing for this domain.</p>
                            <p>
                              This domain was added before verification tokens were introduced.
                              Remove it and add it again to generate new DNS records.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {verifyResult[d.id] && (
                    <p className="text-xs text-green-700">{verifyResult[d.id]}</p>
                  )}
                  {actionError[d.id] && (
                    <p className="text-xs text-destructive">{actionError[d.id]}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {d.status !== 'ACTIVE' && d.status !== 'DISABLED' && (
                      <button
                        onClick={() => void handleVerify(d.id)}
                        disabled={verifying === d.id}
                        className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent disabled:opacity-50"
                      >
                        {verifying === d.id ? 'Verifying…' : 'Verify DNS'}
                      </button>
                    )}
                    {d.status === 'ACTIVE' && !d.isPrimary && (
                      <button
                        onClick={() => void handleSetPrimary(d.id)}
                        className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
                      >
                        Set as Primary
                      </button>
                    )}
                    {!d.isPrimary && (
                      <button
                        onClick={() => void handleRemove(d.id)}
                        className="text-xs px-3 py-1.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add domain form */}
            <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2 pt-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="shop.mybrand.com"
                className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <button
                type="submit"
                disabled={adding || !newDomain.trim()}
                className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {adding ? 'Adding…' : 'Add Domain'}
              </button>
            </form>
            {addError && <p className="text-xs text-destructive">{addError}</p>}

            {/* DNS instructions shown immediately after adding a new domain */}
            {addResult && !addResult.verificationInstructions && (
              <p className="text-sm text-blue-700">
                Domain added. Click <strong>View DNS records</strong> on the domain card to see verification instructions.
              </p>
            )}
            {addResult && addResult.verificationInstructions && (
              <div className="rounded border border-blue-200 bg-blue-50 p-4 space-y-3 text-sm">
                <p className="font-medium text-blue-900">
                  Domain added. Configure these DNS records to verify ownership:
                </p>
                <DnsRecord
                  label="Step 1 — TXT record (proves you own the domain)"
                  host={addResult.verificationInstructions.txtRecord.host}
                  type="TXT"
                  value={addResult.verificationInstructions.txtRecord.value}
                  ttl={addResult.verificationInstructions.txtRecord.ttl}
                />
                <DnsRecord
                  label="Step 2 — CNAME record (points domain to platform)"
                  host={addResult.verificationInstructions.cnameRecord.host}
                  type="CNAME"
                  value={addResult.verificationInstructions.cnameRecord.target}
                  note={addResult.verificationInstructions.cnameRecord.note}
                />
                <p className="text-xs text-blue-700">
                  After configuring DNS, click <strong>Verify DNS</strong> on the domain card above.
                  You can always re-open these instructions using the <strong>View DNS records</strong> link.
                  DNS changes can take up to 48 hours to propagate.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StoreDomain['status'] }) {
  const info = STATUS_LABELS[status];
  return (
    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${info.color}`}>
      {info.label}
    </span>
  );
}

function DnsRecord({
  label, host, type, value, ttl, note,
}: {
  label: string; host: string; type: string; value: string; ttl?: number; note?: string;
}) {
  const copy = (text: string) => void navigator.clipboard.writeText(text).catch(() => null);

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-blue-800">{label}</p>
      <div className="rounded border border-blue-200 bg-white overflow-hidden text-xs">
        <table className="w-full border-collapse">
          <tbody>
            <Row label="Host"  value={host}  onCopy={() => copy(host)} />
            <Row label="Type"  value={type} />
            <Row label="Value" value={value} onCopy={() => copy(value)} mono />
            {ttl !== undefined && <Row label="TTL" value={String(ttl)} />}
          </tbody>
        </table>
      </div>
      {note && <p className="text-xs text-blue-600 italic">{note}</p>}
    </div>
  );
}

function Row({ label, value, mono, onCopy }: {
  label: string; value: string; mono?: boolean; onCopy?: () => void;
}) {
  return (
    <tr className="border-b border-blue-100 last:border-0">
      <td className="px-3 py-1.5 text-blue-700 whitespace-nowrap w-12 font-medium">{label}</td>
      <td className={`px-3 py-1.5 break-all ${mono ? 'font-mono' : ''} text-gray-800`}>{value}</td>
      {onCopy && (
        <td className="px-3 py-1.5 w-8">
          <button
            onClick={onCopy}
            title="Copy"
            className="text-blue-400 hover:text-blue-700 transition-colors"
          >
            ⎘
          </button>
        </td>
      )}
    </tr>
  );
}
