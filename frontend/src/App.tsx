import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { Layout } from './components/layout/Layout';
import { HeroSection } from './components/sections/HeroSection';
import { WorkflowSteps } from './components/sections/WorkflowSteps';

export default function App() {
  return (
    <div className="min-h-screen bg-surface-base text-ink-primary" id="top">
      <Header />
      <Layout>
        <HeroSection />
        <WorkflowSteps />
      </Layout>
      <Footer />
    </div>
  );
}
