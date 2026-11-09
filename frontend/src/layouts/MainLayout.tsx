import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Settings, LogOut, Cloud, Crown, Shield, Wallet, Truck, PackagePlus, RotateCcw, Clock, History } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../state/AuthContext';
import { ConfirmDialog } from '../components/ui/Modal';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS Billing', icon: ShoppingCart },
  { to: '/sales', label: 'Sales History', icon: BarChart3 },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/purchases', label: 'Purchases', icon: PackagePlus },
  { to: '/returns', label: 'Sales Returns', icon: RotateCcw },
  { to: '/shifts', label: 'Cashier Shift', icon: Clock },
  { to: '/inventory-ledger', label: 'Inventory Ledger', icon: History },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/sync', label: 'Offline Sync', icon: Cloud },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const { user, activeBusiness, logout, activeRole } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    setIsLogoutOpen(false);
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      
      <ConfirmDialog 
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        isDanger
      />

      <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 lg:px-6 z-20">
        <div className="flex items-center gap-3">
          <button 
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded"
            onClick={toggleMenu}
            aria-label="Toggle navigation"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="font-bold text-xl text-blue-600 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-black text-sm">
              POS
            </div>
            <span className="hidden sm:inline-block text-gray-900">RetailSystem</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-semibold text-gray-900">{user?.name}</span>
            <span className="text-xs text-gray-500">{activeBusiness?.name} • {activeRole}</span>
          </div>
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold border border-gray-300">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden relative">
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-gray-900/50 z-30 lg:hidden" 
            onClick={closeMenu}
          />
        )}

        <aside 
          className={cn(
            "fixed inset-y-0 left-0 top-16 w-64 bg-white border-r border-gray-200 z-40 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-auto flex flex-col",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMenu}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <item.icon size={18} className={cn("shrink-0")} />
                {item.label}
              </NavLink>
            ))}

            {/* Settings section — Subscription */}
            <div className="pt-2 mt-2 border-t border-gray-100">
              <p className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Subscription</p>
              <NavLink
                to="/settings/subscription"
                onClick={closeMenu}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Crown size={18} className="shrink-0" />
                Subscription
              </NavLink>
            </div>

            {/* Super Admin section — only shown to isSuperAdmin users */}
            {(user as any)?.isSuperAdmin && (
              <div className="pt-2 mt-2 border-t border-gray-100">
                <p className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
                <NavLink
                  to="/admin/subscriptions"
                  onClick={closeMenu}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Shield size={18} className="shrink-0" />
                  Manage Subscriptions
                </NavLink>
              </div>
            )}
          </nav>

          <div className="p-4 border-t border-gray-100">
             <button
                onClick={() => setIsLogoutOpen(true)}
                className="flex items-center w-full gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                Sign Out
              </button>
          </div>
        </aside>
        
        <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
