import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useSubscription } from '../../state/SubscriptionContext';
import { apiClient } from '../../api/client';
import { Crown, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { DateTime } from 'luxon';

export const SubscriptionPage: React.FC = () => {
  const { subscription, isLoading, refresh } = useSubscription();
  const [plans, setPlans] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [plansRes, histRes] = await Promise.all([
          apiClient.get('/subscription/plans'),
          apiClient.get('/subscription/history'),
        ]);
        // apiClient interceptor returns response.data, so .data is the payload field
        setPlans(plansRes.data || []);
        setHistory(histRes.data || []);
      } catch {
        // ignore errors when offline
      }
    };
    load();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !subscription) {
    return <div className="p-8 text-center text-gray-500">Loading subscription...</div>;
  }

  const isPro = subscription.isPro;
  const usagePct = Math.min(100, Math.round((subscription.productCount / subscription.productLimit) * 100));
  const usageColor =
    usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Subscription</h2>
        <p className="text-gray-500 text-sm mt-1">View your current plan and product usage.</p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Crown size={20} className={isPro ? 'text-yellow-500' : 'text-gray-400'} />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Current Plan</p>
                <p className="text-lg font-bold text-gray-900">{subscription.planName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              {subscription.isExpired ? (
                <AlertCircle size={20} className="text-red-500" />
              ) : (
                <CheckCircle size={20} className="text-green-500" />
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                <p className="text-lg font-bold text-gray-900">
                  {subscription.isExpired ? 'Expired' : subscription.status}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock size={20} className={subscription.expiresAt ? 'text-blue-500' : 'text-gray-400'} />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {isPro ? 'Expires' : 'Validity'}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {subscription.expiresAt
                    ? DateTime.fromISO(subscription.expiresAt).toFormat('dd MMM yyyy')
                    : 'No expiry'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Product Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Active Products</span>
            <span className="text-sm font-semibold text-gray-900">
              {subscription.productCount} /{' '}
              {subscription.productLimit === 500
                ? 'Unlimited (500)'
                : subscription.productLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${usageColor}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {subscription.productCount >= subscription.productLimit && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700 font-medium">Product limit reached.</p>
              <p className="text-xs text-red-600 mt-1">
                {subscription.isExpired
                  ? 'Your Pro plan has expired. Existing products are preserved. Contact support to reactivate Pro.'
                  : 'You have reached the 10-product limit on the Free plan. Contact support to upgrade to Pro.'}
              </p>
            </div>
          )}
          {!subscription.isExpired &&
            subscription.productCount > 10 &&
            subscription.isFree === false && (
              <p className="text-xs text-gray-500 mt-2">
                Pro plan allows up to {subscription.productLimit} products.
              </p>
            )}
          {subscription.isExpired && subscription.productCount > 10 && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-xs text-yellow-700">
                Your account has {subscription.productCount} products. These are preserved. New
                product creation is restricted to the Free plan limit (10). Reactivate Pro to
                continue adding products.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan: any) => (
            <Card
              key={plan.id}
              className={`relative ${
                subscription.planCode === plan.code && !subscription.isExpired
                  ? 'ring-2 ring-blue-500'
                  : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {plan.code === 'PRO' && <Crown size={16} className="text-yellow-500" />}
                    {plan.name}
                  </CardTitle>
                  {subscription.planCode === plan.code && !subscription.isExpired && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {Number(plan.price) === 0 ? 'LKR 0' : `LKR ${Number(plan.price).toLocaleString()}`}
                  {plan.billingDays ? (
                    <span className="text-sm font-normal text-gray-500">
                      {' '}/ {plan.billingDays} days
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>✓ Up to {plan.productLimit === 500 ? '500' : plan.productLimit} active products</li>
                  {plan.code === 'PRO' && (
                    <>
                      <li>✓ Advanced sales reports</li>
                      <li>✓ Extended product management</li>
                      <li>✓ Priority support</li>
                    </>
                  )}
                </ul>
                {plan.code === 'PRO' && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-500">
                      To upgrade to Pro, contact your ADK Software Solutions representative or
                      system administrator.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.slice(0, 5).map((event: any) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {event.eventType.replace(/_/g, ' ')}
                    </p>
                    {event.reason && (
                      <p className="text-xs text-gray-500">{event.reason}</p>
                    )}
                    {event.performedBy && (
                      <p className="text-xs text-gray-400">by {event.performedBy.name}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    {DateTime.fromISO(event.createdAt).toFormat('dd MMM yyyy')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
