import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { Layout } from './components/layout/Layout';
import { HeroSection } from './components/sections/HeroSection';
import { ProductLanding } from './components/sections/ProductLanding';
import { WorkflowSteps } from './components/sections/WorkflowSteps';

export default function App() {
  const isWorkspace = window.location.pathname.startsWith('/workspace');

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary" id="top">
      <Header />
      <Layout>
        {isWorkspace ? <WorkflowSteps /> : <><HeroSection /><ProductLanding /></>}
      </Layout>
      <Footer />
    </div>
  );
}
