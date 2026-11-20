import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../state/AuthContext';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Shield, Crown, Briefcase, CreditCard, Sparkles } from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email: loginEmail, password: loginPass });
      login(response.data.token, response.data.user);
      toast.success(`Welcome back, ${response.data.user.name}!`);
      
      // Intelligent role-based landing page
      const user = response.data.user;
      const isCashier = !user.isSuperAdmin && user.memberships?.some((m: any) => m.role === 'CASHIER');
      const isSuperAdmin = user.isSuperAdmin;
      
      let targetPath = '/dashboard';
      if (isSuperAdmin) {
        targetPath = '/admin/subscriptions';
      } else if (isCashier) {
        targetPath = '/pos';
      } else if (from && from !== '/' && from !== '/dashboard') {
        targetPath = from;
      }
      navigate(targetPath, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    performLogin(demoEmail, 'Password123!');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50/80">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-700 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 tracking-wider">
            POS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ADK Retail POS</h1>
          <p className="text-slate-500 text-sm mt-1">Multi-Tenant Retail & Billing Management</p>
        </div>

        {/* 1-Click Role Switcher for Demo & Human Testing */}
        <div className="mb-4 bg-white/90 backdrop-blur border border-indigo-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2.5">
            <Sparkles size={14} className="text-indigo-600 animate-pulse" />
            1-Click Demo Accounts
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('owner@pos.lk')}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                <Crown size={16} />
              </div>
              <div className="min-w-0 pb-0.5">
                <p className="text-xs font-bold text-slate-800 leading-snug truncate">Store Owner</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Full Permissions</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('manager@pos.lk')}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                <Briefcase size={16} />
              </div>
              <div className="min-w-0 pb-0.5">
                <p className="text-xs font-bold text-slate-800 leading-snug truncate">Store Manager</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Ops & Inventory</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('cashier@pos.lk')}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                <CreditCard size={16} />
              </div>
              <div className="min-w-0 pb-0.5">
                <p className="text-xs font-bold text-slate-800 leading-snug truncate">Cashier (Counter)</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">POS & Shifts</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('superadmin@pos.lk')}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                <Shield size={16} />
              </div>
              <div className="min-w-0 pb-0.5">
                <p className="text-xs font-bold text-slate-800 leading-snug truncate">Super Admin</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Platform SaaS</p>
              </div>
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        <Card className="border-slate-200/90 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                label="Email Address" 
                type="email"
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@business.com"
                autoComplete="email"
              />
              <Input 
                label="Password" 
                type={showPassword ? "text" : "password"}
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                rightIcon={
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-slate-600 text-slate-400 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">Default pass: Password123!</span>
                <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm text-sm font-semibold py-2.5 rounded-xl mt-2" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-6">
          Need a new business profile?{' '}
          <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
            Create store account
          </Link>
        </p>
      </div>
    </div>
  );
};
