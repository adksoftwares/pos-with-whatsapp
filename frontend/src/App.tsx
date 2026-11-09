import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/pos/POS';
import { GenericPlaceholder } from './pages/GenericPlaceholder';
import { Settings } from './pages/Settings';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { ProductList } from './pages/products/ProductList';
import { PrintersSettings } from './pages/settings/Printers';
import { SalesHistory } from './pages/sales/SalesHistory';
import { OrderDetails } from './pages/sales/OrderDetails';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { SyncDashboard } from './pages/SyncDashboard';
import { SubscriptionPage } from './pages/settings/Subscription';
import { AdminSubscriptions } from './pages/admin/AdminSubscriptions';
import { Customers } from './pages/Customers';
import { Expenses } from './pages/Expenses';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="sales/:id" element={<OrderDetails />} />
            <Route path="pos" element={<POS />} />
            <Route path="products" element={<ProductList />} />
            <Route path="customers" element={<Customers />} />
            <Route path="reports" element={<ReportsDashboard />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/printers" element={<PrintersSettings />} />
            <Route path="settings/subscription" element={<SubscriptionPage />} />
            <Route path="admin/subscriptions" element={<AdminSubscriptions />} />
            <Route path="sync" element={<SyncDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={
          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">404</h2>
            <p className="text-gray-500">The page you are looking for does not exist.</p>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
