// ============================================================
// NEUROTEK AI — Main App with Auth Gate
// ============================================================
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/appStore';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TemplateGenerator } from './components/TemplateGenerator';
import { TrackOrganizer } from './components/TrackOrganizer';
import { MixAssistant } from './components/MixAssistant';
import { LiveMode } from './components/LiveMode';
import { AIChatPanel } from './components/AIChatPanel';
import { PacksBrowser } from './components/PacksBrowser';
import { DAWBridge } from './components/DAWBridge';
import { Onboarding } from './components/Onboarding';
import { authApi, getAccessToken } from './services/api';
import type { AuthUser, QuotaInfo } from './types';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function ViewContent() {
  const { currentView } = useAppStore();

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
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'templates' && <TemplateGenerator />}
        {currentView === 'tracks' && <TrackOrganizer />}
        {currentView === 'mix' && <MixAssistant />}
        {currentView === 'live' && <LiveMode />}
        {currentView === 'chat' && <AIChatPanel />}
        {currentView === 'packs' && <PacksBrowser />}
        {currentView === 'daw' && <DAWBridge />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { auth, setAuth } = useAppStore();

  // Re-hydrate auth from stored token on startup
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    authApi.me()
      .then((res) => {
        const { id, email, name, plan, quota } = res.data.data;
        setAuth({ id, email, name, plan } as AuthUser, quota as QuotaInfo);
        // Check if onboarding has been completed
        const onboardingDone = localStorage.getItem('nt_onboarding_complete');
        if (!onboardingDone) setShowOnboarding(true);
      })
      .catch(() => {
        // Token invalid/expired — stay on login screen
      })
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
    <div className="w-full h-full flex overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Loading screen (first boot) */}
      <AnimatePresence>
        {!loaded && auth.isAuthenticated && (
          <LoadingScreen onComplete={() => setLoaded(true)} />
        )}
      </AnimatePresence>

      {/* Login screen */}
      {!auth.isAuthenticated && (
        <motion.div
          key="login"
          className="w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <LoginScreen />
        </motion.div>
      )}

      {/* Main app — only shown after auth + loading */}
      {auth.isAuthenticated && loaded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex w-full h-full overflow-hidden"
        >
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <Header />
            <main className="flex-1 overflow-hidden">
              <ViewContent />
            </main>
          </div>

          {/* Onboarding overlay */}
          <AnimatePresence>
            {showOnboarding && (
              <Onboarding onComplete={() => setShowOnboarding(false)} />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
