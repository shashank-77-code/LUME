import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { Layout } from './components/layout/Layout';
import { HeroSection } from './components/sections/HeroSection';
import { ProductLanding } from './components/sections/ProductLanding';
import { WorkflowSteps } from './components/sections/WorkflowSteps';

export default function App() {
  const location = useLocation();
  const isWorkspace = location.pathname === '/workspace';
  const routes = (
    <Routes>
      <Route path="/" element={<><HeroSection /><ProductLanding /></>} />
      <Route path="/workspace" element={<WorkflowSteps />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary" id="top">
      {!isWorkspace && <Header />}
      {isWorkspace ? routes : <Layout>{routes}</Layout>}
      {!isWorkspace && <Footer />}
    </div>
  );
}
