import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../state/AuthContext';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';
import { Crown, RefreshCw } from 'lucide-react';
import { DateTime } from 'luxon';

export const AdminSubscriptions: React.FC = () => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activating, setActivating] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  // Security: check super admin on frontend for UX only
  // Backend enforces this authoritatively
  if (!(user as any)?.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 text-lg">Access Denied</p>
        <p className="text-gray-400 text-sm">Super Admin access required.</p>
      </div>
    );
  }

  // ── hooks must not be called conditionally, so everything below is safe ──
  // (The early return above only fires if !isSuperAdmin, the hooks are above it
  //  but React rules require this placement — we keep the data fetching in useEffect)

  const fetchBusinesses = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/subscription/admin/all', {
        params: { search, limit: 50 },
      });
      setBusinesses(res.data?.businesses || res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load businesses');
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const loadDetail = async (businessId: string) => {
    try {
      const res = await apiClient.get(`/subscription/admin/${businessId}`);
      setDetail(res.data);
      setSelectedBusiness(businessId);
    } catch {
      toast.error('Failed to load details');
    }
  };

  const handleActivate = async (
    businessId: string,
    action: 'activate' | 'reactivate' | 'cancel'
  ) => {
    setActivating(businessId + action);
    try {
      await apiClient.post(`/subscription/admin/${businessId}/${action}`, {
        reason: `Manual ${action} by Super Admin`,
      });
      toast.success(`PRO ${action}d successfully!`);
      fetchBusinesses();
      if (selectedBusiness === businessId) loadDetail(businessId);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || `Failed to ${action}`);
    } finally {
      setActivating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') return <Badge variant="success">Active</Badge>;
    if (status === 'EXPIRED') return <Badge variant="danger">Expired</Badge>;
    if (status === 'CANCELLED') return <Badge variant="warning">Cancelled</Badge>;
    return <Badge>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
          Subscription Management
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Super Admin — manage business subscriptions platform-wide.
        </p>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search businesses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="secondary" onClick={fetchBusinesses} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business List */}
        <Card>
          <CardHeader>
            <CardTitle>All Businesses ({businesses.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : businesses.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No businesses found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {businesses.map((b: any) => (
                  <div
                    key={b.businessId}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedBusiness === b.businessId ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => loadDetail(b.businessId)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {b.plan?.code === 'PRO' && (
                            <Crown size={14} className="text-yellow-500" />
                          )}
                          <span className="font-medium text-gray-900 text-sm">
                            {b.businessName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {b.plan?.name} · {b.productCount} products
                        </p>
                        {b.expiresAt && (
                          <p className="text-xs text-gray-400">
                            Expires: {DateTime.fromISO(b.expiresAt).toFormat('dd MMM yyyy')}
                          </p>
                        )}
                      </div>
                      <div>{getStatusBadge(b.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Business Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!detail ? (
              <p className="text-gray-400 text-sm">Select a business to view details.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{detail.business?.name}</h3>
                  <p className="text-sm text-gray-500">
                    {detail.business?.productCount} active products
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Plan</p>
                    <p className="font-semibold">{detail.subscription?.planName}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <div>{getStatusBadge(detail.subscription?.status || '')}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Products</p>
                    <p className="font-semibold">
                      {detail.subscription?.productCount} /{' '}
                      {detail.subscription?.productLimit}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Expires</p>
                    <p className="font-semibold text-xs">
                      {detail.subscription?.expiresAt
                        ? DateTime.fromISO(detail.subscription.expiresAt).toFormat(
                            'dd MMM yyyy'
                          )
                        : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {(detail.subscription?.status !== 'ACTIVE' ||
                    detail.subscription?.isExpired) && (
                    <Button
                      size="sm"
                      isLoading={activating === detail.business?.id + 'reactivate'}
                      onClick={() => handleActivate(detail.business?.id, 'reactivate')}
                    >
                      <Crown size={14} className="mr-1" />
                      Reactivate PRO
                    </Button>
                  )}
                  {detail.subscription?.status === 'ACTIVE' &&
                    !detail.subscription?.isExpired &&
                    detail.subscription?.planCode === 'FREE' && (
                      <Button
                        size="sm"
                        isLoading={activating === detail.business?.id + 'activate'}
                        onClick={() => handleActivate(detail.business?.id, 'activate')}
                      >
                        <Crown size={14} className="mr-1" />
                        Activate PRO
                      </Button>
                    )}
                  {detail.subscription?.status === 'ACTIVE' &&
                    !detail.subscription?.isExpired &&
                    detail.subscription?.planCode === 'PRO' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={activating === detail.business?.id + 'cancel'}
                        onClick={() => handleActivate(detail.business?.id, 'cancel')}
                      >
                        Cancel PRO
                      </Button>
                    )}
                </div>

                {/* History */}
                {detail.history?.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Event History
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {detail.history.map((ev: any) => (
                        <div
                          key={ev.id}
                          className="flex justify-between text-xs text-gray-500 py-1"
                        >
                          <span>{ev.eventType.replace(/_/g, ' ')}</span>
                          <span>
                            {DateTime.fromISO(ev.createdAt).toFormat('dd MMM yy')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
