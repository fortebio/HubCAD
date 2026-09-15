import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastViewport } from '@/components/ui/Toast';
import { ConfirmHost } from '@/components/ui/ConfirmDialog';
import { PromptHost } from '@/components/ui/PromptDialog';
import { useAuthStore } from '@/stores/useAuthStore';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Dashboard } from '@/pages/Dashboard';
import { Viewer3D } from '@/pages/Viewer3D';
import { BOMManager } from '@/pages/BOMManager';
import { QuoteEstimator } from '@/pages/QuoteEstimator';
import { DrawingChecklist } from '@/pages/DrawingChecklist';
import { DFMReview } from '@/pages/DFMReview';
import { WIDocument } from '@/pages/WIDocument';
import { CatalogDatasheet } from '@/pages/CatalogDatasheet';
import { ReleaseManager } from '@/pages/ReleaseManager';
import { ECRManager } from '@/pages/ECRManager';
import { DocTracker } from '@/pages/DocTracker';
import { Backup } from '@/pages/Backup';
import { UserManagement } from '@/pages/UserManagement';
import { AuditLog } from '@/pages/AuditLog';
import { CostSettings } from '@/pages/CostSettings';

function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AppShell({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50 flex-col md:flex-row">
      {/* First tab stop: jump past the navigation straight to the page. */}
      <a href="#main-content" className="skip-link">
        Skip to content / Đến nội dung chính
      </a>
      <Sidebar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/viewer" element={<Viewer3D />} />
                  <Route path="/bom" element={<BOMManager />} />
                  <Route path="/quote" element={<QuoteEstimator />} />
                  <Route path="/checklist" element={<DrawingChecklist />} />
                  <Route path="/dfm" element={<DFMReview />} />
                  <Route path="/wi" element={<WIDocument />} />
                  <Route path="/catalog" element={<CatalogDatasheet />} />
                  <Route path="/release" element={<ReleaseManager />} />
                  <Route path="/ecr" element={<ECRManager />} />
                  <Route path="/tracker" element={<DocTracker />} />
                  <Route path="/backup" element={<Backup />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/audit" element={<AuditLog />} />
                  <Route path="/pricing" element={<CostSettings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
      {/* App-wide feedback surfaces, available on every route. */}
      <ToastViewport />
      <ConfirmHost />
      <PromptHost />
    </>
  );
}
