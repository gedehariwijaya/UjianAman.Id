import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ExamConfigurator } from './components/ExamConfigurator';
import { AiAssistant } from './components/AiAssistant';
import { SecurePlayer } from './components/SecurePlayer';
import { ProctorDashboard } from './components/ProctorDashboard';
import { ExamPayload } from './types';
import { 
  DEFAULT_EXAM_CONFIG, 
  getSavedExamConfig, 
  getSavedSessions, 
  subscribeToSyncMessages, 
  saveExamConfig 
} from './utils/proctorSync';
import { ShieldCheck, Lock, ExternalLink, Globe, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'configurator' | 'ai-assistant' | 'secure-player' | 'proctor-dashboard'>('configurator');
  const [config, setConfig] = useState<ExamPayload>(() => getSavedExamConfig());
  const [blockedCount, setBlockedCount] = useState(0);
  const [violationCount, setViolationCount] = useState(0);

  // Keep badge counts updated
  useEffect(() => {
    const updateCounts = () => {
      const sessions = getSavedSessions();
      setBlockedCount(sessions.filter((s) => s.status === 'blocked').length);
      setViolationCount(sessions.reduce((acc, s) => acc + s.violationsCount, 0));
    };

    updateCounts();

    const unsub = subscribeToSyncMessages(() => {
      updateCounts();
    });

    return () => unsub();
  }, []);

  const handleApplyConfig = (newConfig: ExamPayload) => {
    setConfig(newConfig);
    saveExamConfig(newConfig);
    setActiveTab('configurator');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        blockedCount={blockedCount}
        violationCount={violationCount}
      />

      {/* Main Viewport */}
      <main className="flex-1">
        {activeTab === 'configurator' && (
          <ExamConfigurator
            config={config}
            setConfig={setConfig}
            onLaunchPlayer={() => setActiveTab('secure-player')}
            onOpenProctor={() => setActiveTab('proctor-dashboard')}
            onOpenAiAssistant={() => setActiveTab('ai-assistant')}
          />
        )}

        {activeTab === 'ai-assistant' && (
          <AiAssistant
            currentConfig={config}
            onApplyConfig={handleApplyConfig}
            onLaunchPlayer={() => setActiveTab('secure-player')}
          />
        )}

        {activeTab === 'secure-player' && (
          <SecurePlayer
            config={config}
            onExitPlayer={() => setActiveTab('configurator')}
          />
        )}

        {activeTab === 'proctor-dashboard' && (
          <ProctorDashboard
            config={config}
            onOpenPlayer={() => setActiveTab('secure-player')}
          />
        )}
      </main>

      {/* Global Footer (Hidden when in full student exam simulator) */}
      {activeTab !== 'secure-player' && (
        <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 py-6 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-slate-300">UjianAman.id</span>
              <span>— Secure Exam Player & AI Proctoring Infrastructure</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1 text-slate-400">
                <Lock className="w-3 h-3 text-emerald-400" /> Sandbox Web APIs: Page Visibility, Fullscreen, ResizeObserver
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Standar Protokol Asesmen Terintegrasi</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
