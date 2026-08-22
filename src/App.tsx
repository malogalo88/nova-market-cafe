import { lazy, Suspense, useEffect } from "react";
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
import QrCustomer from "./pages/QrCustomer";

// Staff pages are code-split so phones loading the customer menu don't
// download the whole back office. Each chunk is fetched on first visit.
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POS = lazy(() => import("./pages/POS"));
const Products = lazy(() => import("./pages/Products"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Customers = lazy(() => import("./pages/Customers"));
const Employees = lazy(() => import("./pages/Employees"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const Promotions = lazy(() => import("./pages/Promotions"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const CustomerOrders = lazy(() => import("./pages/CustomerOrders"));
const QrCodes = lazy(() => import("./pages/QrCodes"));

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
        <Suspense fallback={<FullPageSpinner />}>
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
        </Suspense>
        <ToastViewport />
      </ConfirmProvider>
    </HashRouter>
  );
}
