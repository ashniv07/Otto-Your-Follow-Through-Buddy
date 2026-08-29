import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { OttoProvider, useOtto } from "./hooks/useOttoStore";
import { LandingPage } from "./pages/LandingPage";
import { Dashboard } from "./pages/Dashboard";

// /app requires a signed-in Otto account (see backend/api/authRoutes.js
// google/signin) — while the session is still loading, render nothing to
// avoid a flash of the landing page for an already-signed-in user.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useOtto();
  if (session === null) return null;
  if (!session.authenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <OttoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </OttoProvider>
  );
}

export default App;
