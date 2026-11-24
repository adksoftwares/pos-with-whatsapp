import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  Menu, X, LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Settings, 
  LogOut, Cloud, Crown, Shield, Wallet, Truck, PackagePlus, RotateCcw, 
  Clock, History, Sparkles, Briefcase, CreditCard, Wifi, WifiOff,
  PanelLeftClose, PanelLeftOpen, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../state/AuthContext';
import { useNetwork } from '../state/NetworkContext';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ui/Modal';

interface NavSection {
  title?: string;
  items: Array<{
    to: string;
    label: string;
    icon: any;
    roles?: string[];
  }>;
}

const navSections: NavSection[] = [
  {
    title: 'Counter & Sales',
    items: [
      { to: '/pos', label: 'POS Billing', icon: ShoppingCart },
      { to: '/shifts', label: 'Cashier Shift', icon: Clock },
      { to: '/sales', label: 'Sales History', icon: BarChart3 },
      { to: '/returns', label: 'Sales Returns', icon: RotateCcw },
    ]
  },
  {
    title: 'Inventory & Stock',
    items: [
      { to: '/products', label: 'Products Catalog', icon: Package, roles: ['OWNER', 'MANAGER'] },
      { to: '/inventory-ledger', label: 'Inventory Ledger', icon: History, roles: ['OWNER', 'MANAGER'] },
      { to: '/purchases', label: 'Purchase Invoices', icon: PackagePlus, roles: ['OWNER', 'MANAGER'] },
      { to: '/suppliers', label: 'Suppliers Directory', icon: Truck, roles: ['OWNER', 'MANAGER'] },
    ]
  },
  {
    title: 'CRM & Finance',
    items: [
      { to: '/dashboard', label: 'Store Overview', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER'] },
      { to: '/customers', label: 'Customers & Loyalty', icon: Users },
      { to: '/expenses', label: 'Operating Expenses', icon: Wallet, roles: ['OWNER', 'MANAGER'] },
      { to: '/reports', label: 'Analytics & Reports', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
    ]
  },
  {
    title: 'System & Connectivity',
    items: [
      { to: '/sync', label: 'Offline Sync Queue', icon: Cloud },
      { to: '/settings', label: 'Business Settings', icon: Settings, roles: ['OWNER'] },
      { to: '/settings/subscription', label: 'Plan & Billing', icon: Crown, roles: ['OWNER'] },
    ]
  }
];

export const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const { user, activeBusiness, logout, login, activeRole } = useAuth();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    setIsLogoutOpen(false);
    navigate('/login');
  };

  const handleSwitchAccount = async (targetEmail: string, roleName: string) => {
    if (user?.email === targetEmail) return;
    setIsSwitching(true);
    const toastId = toast.loading(`Switching to ${roleName}...`);
    try {
      const response = await apiClient.post('/auth/login', {
        email: targetEmail,
        password: 'Password123!'
      });
      login(response.data.token, response.data.user);
      toast.success(`Active as ${roleName}`, { id: toastId });
      if (roleName === 'Cashier') {
        navigate('/pos');
      } else if (roleName === 'Super Admin') {
        navigate('/admin/subscriptions');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Role switch failed', { id: toastId });
    } finally {
      setIsSwitching(false);
    }
  };

  const getRoleBadge = () => {
    if ((user as any)?.isSuperAdmin) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">SUPER ADMIN</span>;
    }
    switch (activeRole) {
      case 'OWNER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">OWNER</span>;
      case 'MANAGER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">MANAGER</span>;
      case 'CASHIER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">CASHIER</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{activeRole || 'STAFF'}</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans antialiased">
      
      <ConfirmDialog 
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        description="Are you sure you want to exit the current session?"
        confirmText="Sign Out"
        isDanger
      />

      {/* Primary Top Bar */}
      <header className="bg-white border-b border-slate-200/80 h-16 flex items-center justify-between px-3 lg:px-6 sticky top-0 z-30 shadow-xs">
        
        {/* Left: Mobile hamburger, Desktop collapse toggle & Brand */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button 
            className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={toggleMenu}
            aria-label="Toggle navigation"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Desktop sidebar minimize/expand button */}
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors items-center justify-center -ml-1"
            title={isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-700 to-indigo-600 rounded-xl shadow-sm flex items-center justify-center text-white font-black text-sm tracking-wide shrink-0">
              POS
            </div>
            <div className={cn("transition-all duration-200 overflow-hidden", isSidebarCollapsed ? "hidden xl:block" : "block")}>
              <div className="font-bold text-base text-slate-900 leading-tight truncate max-w-[200px]">
                {activeBusiness?.name || 'ADK Retail POS'}
              </div>
              <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Batticaloa • Sri Lanka (LKR)
              </div>
            </div>
          </div>
        </div>

        {/* Center: Quick Role Switcher Pills (Human Testing / Demo Bar) */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
            <Sparkles size={12} className="text-amber-500" /> Demo:
          </span>
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => handleSwitchAccount('owner@pos.lk', 'Owner')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1",
              user?.email === 'owner@pos.lk' 
                ? "bg-white text-amber-800 shadow-xs font-bold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Crown size={13} className="text-amber-600" /> Owner
          </button>
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => handleSwitchAccount('manager@pos.lk', 'Manager')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1",
              user?.email === 'manager@pos.lk' 
                ? "bg-white text-blue-800 shadow-xs font-bold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Briefcase size={13} className="text-blue-600" /> Manager
          </button>
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => handleSwitchAccount('cashier@pos.lk', 'Cashier')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1",
              user?.email === 'cashier@pos.lk' 
                ? "bg-white text-emerald-800 shadow-xs font-bold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <CreditCard size={13} className="text-emerald-600" /> Cashier
          </button>
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => handleSwitchAccount('superadmin@pos.lk', 'Super Admin')}
            className={cn(
              "px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1",
              (user as any)?.isSuperAdmin 
                ? "bg-white text-purple-800 shadow-xs font-bold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Shield size={13} className="text-purple-600" /> Super Admin
          </button>
        </div>

        {/* Right: Network Status, User Profile & Logout */}
        <div className="flex items-center gap-3">
          {/* Online / Offline Indicator Pill */}
          <div className={cn(
            "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
            isOnline 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/80" 
              : "bg-amber-50 text-amber-700 border-amber-200/80"
          )}>
            {isOnline ? (
              <>
                <Wifi size={13} className="text-emerald-600 animate-pulse" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={13} className="text-amber-600" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1 justify-end">
                {user?.name}
              </div>
              <div className="mt-0.5">{getRoleBadge()}</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </div>
      </header>
      
      {/* Body Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden" 
            onClick={closeMenu}
          />
        )}

        {/* Professional Organized Sidebar */}
        <aside 
          className={cn(
            "fixed inset-y-0 left-0 top-16 bg-white border-r border-slate-200/90 z-40 transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-auto flex flex-col shadow-sm lg:shadow-none",
            isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full",
            isSidebarCollapsed ? "lg:w-[72px]" : "lg:w-64"
          )}
        >
          <nav className={cn("space-y-4 flex-1 overflow-y-auto", isSidebarCollapsed ? "p-2" : "p-3")}>
            {navSections.map((section, idx) => {
              const visibleItems = section.items.filter(item => {
                if (!item.roles) return true;
                if ((user as any)?.isSuperAdmin) return true;
                return activeRole && item.roles.includes(activeRole);
              });
              if (visibleItems.length === 0) return null;
              return (
                <div key={idx} className="space-y-1">
                  {section.title && (
                    isSidebarCollapsed ? (
                      <div className="my-2 border-t border-slate-100 mx-1" />
                    ) : (
                      <p className="px-3 pt-1 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                        {section.title}
                      </p>
                    )
                  )}
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeMenu}
                      title={item.label}
                      className={({ isActive }) => cn(
                        "flex items-center rounded-xl text-sm font-medium transition-all group relative",
                        isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2",
                        isActive 
                          ? "bg-blue-600 text-white shadow-sm font-semibold" 
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                      )}
                    >
                      <item.icon size={19} className="shrink-0 transition-transform group-hover:scale-110" />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              );
            })}

            {/* Super Admin section — only shown to isSuperAdmin users */}
            {(user as any)?.isSuperAdmin && (
              <div className={cn("pt-2 border-t border-purple-100 space-y-1", isSidebarCollapsed && "pt-1")}>
                {!isSidebarCollapsed && (
                  <p className="px-3 pb-1 text-[11px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                    <Shield size={12} /> Platform Admin
                  </p>
                )}
                <NavLink
                  to="/admin/subscriptions"
                  onClick={closeMenu}
                  title="Tenant Subscriptions (Platform Admin)"
                  className={({ isActive }) => cn(
                    "flex items-center rounded-xl text-sm font-medium transition-all",
                    isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2",
                    isActive
                      ? "bg-purple-700 text-white shadow-sm font-semibold"
                      : "text-purple-700 hover:bg-purple-50"
                  )}
                >
                  <Shield size={19} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">Tenant Subscriptions</span>}
                </NavLink>
              </div>
            )}
          </nav>

          {/* Sidebar Footer: Minimize Toggle & Sign Out */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 space-y-1">
            {/* Desktop Minimize Toggle Button */}
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex items-center w-full rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors py-2 px-2.5"
              title={isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"}
            >
              {isSidebarCollapsed ? (
                <div className="w-full flex justify-center py-0.5">
                  <ChevronsRight size={18} className="text-slate-600" />
                </div>
              ) : (
                <div className="w-full flex items-center justify-between">
                  <span className="truncate">Minimize Sidebar</span>
                  <ChevronsLeft size={16} className="text-slate-400 shrink-0" />
                </div>
              )}
            </button>

            {/* Sign Out */}
            <button
              onClick={() => setIsLogoutOpen(true)}
              title="Sign Out"
              className={cn(
                "flex items-center w-full rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors",
                isSidebarCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2"
              )}
            >
              <LogOut size={16} className="shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Sign Out</span>}
            </button>
          </div>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-6 w-full bg-slate-50">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
