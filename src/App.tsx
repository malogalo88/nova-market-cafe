import { useEffect } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAppStore } from "./store/useStore";
import { ConfirmProvider, FullPageSpinner, ToastViewport } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Transactions from "./pages/Transactions";
import Customers from "./pages/Customers";
import Employees from "./pages/Employees";
import Suppliers from "./pages/Suppliers";
import PurchaseOrders from "./pages/PurchaseOrders";
import Promotions from "./pages/Promotions";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import QrCustomer from "./pages/QrCustomer";
import CustomerOrders from "./pages/CustomerOrders";
import QrCodes from "./pages/QrCodes";

function Guard({ children }: { children: React.ReactElement }): React.ReactElement | null {
  const { ready, sessionEmployeeId, db } = useAppStore();
  const location = useLocation();

  if (!ready) return <FullPageSpinner />;

  const needsSetup =
    db.employees.length === 0 || (!db.settings.onboardingComplete && !db.settings.demoData);
  if (needsSetup && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }

  if (!sessionEmployeeId) {
    if (location.pathname === "/welcome") return children;
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === "/login" || location.pathname === "/welcome") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function TitleSync(): null {
  const db = useAppStore((s) => s.db);
  useEffect(() => {
    document.title = `${db.settings.businessName} — NovaPOS`;
  }, [db.settings.businessName]);
  return null;
}

export default function App(): React.ReactElement {
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <HashRouter>
      <TitleSync />
      <ConfirmProvider>
        <Routes>
          {/* Public customer self-ordering — completely outside the POS shell */}
          <Route path="/order/:qrId" element={<QrCustomer />} />
          <Route path="/login" element={<Login />} />
          <Route path="/welcome" element={<Guard><Onboarding /></Guard>} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/products" element={<Products />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/transactions/:txnId" element={<Transactions />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/orders" element={<CustomerOrders />} />
            <Route path="/qr" element={<QrCodes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ToastViewport />
      </ConfirmProvider>
    </HashRouter>
  );
}
