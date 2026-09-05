import React from 'react';
import { ShieldAlert, ShieldCheck, Cpu, Terminal, Users, Monitor, Radio } from 'lucide-react';

interface HeaderProps {
  activeTab: 'configurator' | 'ai-assistant' | 'secure-player' | 'proctor-dashboard';
  setActiveTab: (tab: 'configurator' | 'ai-assistant' | 'secure-player' | 'proctor-dashboard') => void;
  blockedCount: number;
  violationCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  blockedCount,
  violationCount,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
                  UjianAman.id
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  SECURE EXAM PROCTOR
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Sistem Keamanan & Pengawasan Ujian Online Terintegrasi
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
            <button
              id="tab-configurator-btn"
              onClick={() => setActiveTab('configurator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'configurator'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Konfigurator &</span> JSON
            </button>

            <button
              id="tab-ai-assistant-btn"
              onClick={() => setActiveTab('ai-assistant')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ai-assistant'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-300" />
              <span>AI Asisten</span>
            </button>

            <button
              id="tab-player-btn"
              onClick={() => setActiveTab('secure-player')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'secure-player'
                  ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simulator</span> Siswa
            </button>

            <button
              id="tab-proctor-btn"
              onClick={() => setActiveTab('proctor-dashboard')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'proctor-dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Dashboard</span> Pengawas
              {(blockedCount > 0 || violationCount > 0) && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {blockedCount > 0 ? `${blockedCount} lock` : violationCount}
                </span>
              )}
            </button>
          </nav>

          {/* Status Indicator */}
          <div className="hidden lg:flex items-center gap-2.5 text-xs text-slate-400">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-[11px] text-emerald-400">SYNC REAL-TIME AKTIF</span>
          </div>
        </div>
      </div>
    </header>
  );
};
