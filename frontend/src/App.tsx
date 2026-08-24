import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OttoProvider } from "./hooks/useOttoStore";
import { LandingPage } from "./pages/LandingPage";
import { Dashboard } from "./pages/Dashboard";

function App() {
  return (
    <OttoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<Dashboard />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </OttoProvider>
  );
}

export default App;