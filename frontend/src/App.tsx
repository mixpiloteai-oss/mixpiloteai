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
import { BetaBanner } from './components/BetaBanner';
import { WelcomeModal } from './components/WelcomeModal';
import { UpdateChecker } from './components/UpdateChecker';
import { authApi, getAccessToken } from './services/api';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useOfflineFirst } from './hooks/useOfflineFirst';
import { useNetworkStore } from './store/networkStore';
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
const DebugPanel         = lazy(() => import('./components/desktop/DebugPanel'));

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

// ─── Offline placeholder for online-only features ────────────────────────────
function OfflinePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: '#475569' }}>
      <WifiOffIcon />
      <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-xs text-center max-w-xs">
        This feature requires an internet connection. Your project is safe — it will be available again when you reconnect.
      </p>
    </div>
  );
}
function WifiOffIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#334155' }}>
      <line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /><path d="M10.71 5.05A16 16 0 0 1 22.56 9" /><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" />
    </svg>
  );
}

function ViewRouter({ view }: { view: ViewType }) {
  const { isOnline, backendReachable } = useNetworkStore();
  const networkOk = isOnline && backendReachable !== false;

  return (
    <Suspense fallback={<ViewFallback />}>
      {view === 'dashboard'      && <Dashboard />}
      {view === 'templates'      && <TemplateGenerator />}
      {view === 'tracks'         && <TrackOrganizer />}
      {view === 'mix'            && <MixAssistant />}
      {view === 'live'           && <LiveMode />}
      {view === 'chat'           && (networkOk ? <AIChatPanel /> : <OfflinePlaceholder label="AI Chat" />)}
      {view === 'packs'          && (networkOk ? <PacksBrowser /> : <OfflinePlaceholder label="Packs Marketplace" />)}
      {view === 'daw'            && <DAWBridge />}
      {view === 'coach'          && (networkOk ? <AICoach /> : <OfflinePlaceholder label="AI Coach" />)}
      {view === 'analytics'      && (networkOk ? <AnalyticsDashboard /> : <OfflinePlaceholder label="Analytics" />)}
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
      {view === 'debug'          && <DebugPanel />}
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
  const setAuth         = useAppStore((s) => s.setAuth);

  // Initialise offline-first connectivity monitor + sync queue flusher
  useOfflineFirst();

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
                <BetaBanner />
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
              <WelcomeModal />
              <UpdateChecker />
            </motion.div>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
