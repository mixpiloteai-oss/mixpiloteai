// ============================================================
// NEUROTEK AI — Main App with Auth Gate
// ============================================================
import React, { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/appStore';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { LoadingScreen } from './components/LoadingScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { authApi, getAccessToken } from './services/api';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { AuthUser, QuotaInfo, ViewType } from './types';

// Eagerly-loaded views (visible at startup)
import { Dashboard } from './components/Dashboard';

// Lazy-loaded views (loaded on first navigation)
const TemplateGenerator  = lazy(() => import('./components/TemplateGenerator').then(m => ({ default: m.TemplateGenerator })));
const TrackOrganizer     = lazy(() => import('./components/TrackOrganizer').then(m => ({ default: m.TrackOrganizer })));
const MixAssistant       = lazy(() => import('./components/MixAssistant').then(m => ({ default: m.MixAssistant })));
const LiveMode           = lazy(() => import('./components/LiveMode').then(m => ({ default: m.LiveMode })));
const AIChatPanel        = lazy(() => import('./components/AIChatPanel').then(m => ({ default: m.AIChatPanel })));
const PacksBrowser       = lazy(() => import('./components/PacksBrowser').then(m => ({ default: m.PacksBrowser })));
const DAWBridge          = lazy(() => import('./components/DAWBridge').then(m => ({ default: m.DAWBridge })));
const Onboarding         = lazy(() => import('./components/Onboarding').then(m => ({ default: m.Onboarding })));
const AICoach            = lazy(() => import('./components/AICoach'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const PlansPage          = lazy(() => import('./components/PlansPage'));
const LegalPages         = lazy(() => import('./components/legal/LegalPages'));
const AudioEnginePanel   = lazy(() => import('./components/AudioEnginePanel'));
const ClipLauncherPanel  = lazy(() => import('./components/ClipLauncherPanel'));
const PianoRollPanel     = lazy(() => import('./components/PianoRollPanel'));
const ArrangementPanel   = lazy(() => import('./components/ArrangementPanel'));
const MixerPanel         = lazy(() => import('./components/MixerPanel'));
const SpectrumAnalyzer   = lazy(() => import('./components/SpectrumAnalyzer'));
const AudioRoutingPanel  = lazy(() => import('./components/AudioRoutingPanel'));
const VSTHostingPanel    = lazy(() => import('./components/VSTHostingPanel'));
const AIProductionPanel  = lazy(() => import('./components/AIProductionPanel'));
const SampleBrowserPanel = lazy(() => import('./components/SampleBrowserPanel'));
const LoginScreen        = lazy(() => import('./components/auth/LoginScreen').then(m => ({ default: m.LoginScreen })));

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function ViewFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ViewRouter({ view }: { view: ViewType }) {
  return (
    <Suspense fallback={<ViewFallback />}>
      {view === 'dashboard'      && <Dashboard />}
      {view === 'templates'      && <TemplateGenerator />}
      {view === 'tracks'         && <TrackOrganizer />}
      {view === 'mix'            && <MixAssistant />}
      {view === 'live'           && <LiveMode />}
      {view === 'chat'           && <AIChatPanel />}
      {view === 'packs'          && <PacksBrowser />}
      {view === 'daw'            && <DAWBridge />}
      {view === 'coach'          && <AICoach />}
      {view === 'analytics'      && <AnalyticsDashboard />}
      {view === 'plans'          && <PlansPage />}
      {view === 'legal'          && <LegalPages />}
      {view === 'audio'          && <AudioEnginePanel />}
      {view === 'launcher'       && <ClipLauncherPanel />}
      {view === 'piano-roll'     && <PianoRollPanel />}
      {view === 'arrangement'    && <ArrangementPanel />}
      {view === 'mixer'          && <MixerPanel />}
      {view === 'spectrum'       && <SpectrumAnalyzer />}
      {view === 'routing'        && <AudioRoutingPanel />}
      {view === 'vst'            && <VSTHostingPanel />}
      {view === 'ai-production'  && <AIProductionPanel />}
      {view === 'sample-browser' && <SampleBrowserPanel />}
    </Suspense>
  );
}

function ViewContent() {
  const currentView = useAppStore((s) => s.currentView);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex-1 overflow-hidden"
      >
        <ErrorBoundary>
          <ViewRouter view={currentView} />
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  );
}

function AppShortcuts() {
  useKeyboardShortcuts();
  return null;
}

export default function App() {
  const [loaded, setLoaded] = React.useState(false);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated);
  const setAuth = useAppStore((s) => s.setAuth);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setAuthChecked(true); return; }
    authApi.me()
      .then((res) => {
        const { id, email, name, plan, quota } = res.data.data;
        setAuth({ id, email, name, plan } as AuthUser, quota as QuotaInfo);
        const onboardingDone = localStorage.getItem('nt_onboarding_complete');
        if (!onboardingDone) setShowOnboarding(true);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authChecked) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: '#0a0a0f' }}>
        <OfflineBanner />
        <div className="flex flex-1 overflow-hidden">
          <AnimatePresence>
            {!loaded && isAuthenticated && (
              <LoadingScreen onComplete={() => setLoaded(true)} />
            )}
          </AnimatePresence>

          {!isAuthenticated && (
            <Suspense fallback={<ViewFallback />}>
              <motion.div key="login" className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <LoginScreen />
              </motion.div>
            </Suspense>
          )}

          {isAuthenticated && loaded && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
              className="flex w-full h-full overflow-hidden"
            >
              <AppShortcuts />
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <Header />
                <main className="flex-1 overflow-hidden">
                  <ViewContent />
                </main>
              </div>
              {showOnboarding && (
                <Suspense fallback={null}>
                  <Onboarding onComplete={() => setShowOnboarding(false)} />
                </Suspense>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
