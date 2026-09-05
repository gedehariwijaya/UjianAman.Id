import React from 'react';
import { ShieldCheck, Monitor, Lock, Unlock, LogOut, Radio, Terminal } from 'lucide-react';

interface HeaderProps {
  activeMainTab: 'student-simulator' | 'admin';
  onSelectTab: (tab: 'student-simulator' | 'admin') => void;
  isAdminAuthenticated: boolean;
  adminSubTab: 'configurator' | 'proctor-dashboard';
  onSelectAdminSubTab: (subTab: 'configurator' | 'proctor-dashboard') => void;
  onLockAdmin: () => void;
  blockedCount: number;
  violationCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeMainTab,
  onSelectTab,
  isAdminAuthenticated,
  adminSubTab,
  onSelectAdminSubTab,
  onLockAdmin,
  blockedCount,
  violationCount,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
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
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  SECURE EXAM
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Sistem Keamanan & Pengawasan Ujian Online
              </p>
            </div>
          </div>

          {/* Main 2-Tab Navigation Bar: Tab 1 (Asesmen Siswa) & Tab 2 (Admin) */}
          <nav className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
            {/* Tab 1: Asesmen Siswa */}
            <button
              id="tab-student-simulator-btn"
              onClick={() => onSelectTab('student-simulator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'student-simulator'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-1 ring-teal-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Asesmen Siswa</span>
            </button>

            {/* Tab 2: Admin (Password Protected) */}
            <button
              id="tab-admin-btn"
              onClick={() => onSelectTab('admin')}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {isAdminAuthenticated ? (
                <Unlock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <span>Admin</span>

              {/* Status or Alert Badge */}
              {isAdminAuthenticated ? (
                <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400" title="Admin Terbuka" />
              ) : (
                <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
                  (Terkunci)
                </span>
              )}

              {(blockedCount > 0 || violationCount > 0) && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {blockedCount > 0 ? `${blockedCount} lock` : violationCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Status or Admin Quick Actions */}
          <div className="flex items-center gap-3">
            {activeMainTab === 'admin' && isAdminAuthenticated && (
              <button
                onClick={onLockAdmin}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800/40 text-slate-400 hover:text-rose-300 text-xs font-medium transition"
                title="Kunci Akses Menu Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Kunci Admin</span>
              </button>
            )}

            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[11px] text-emerald-400">SECURE ENGINE READY</span>
            </div>
          </div>
        </div>

        {/* Sub-Header for Admin when authenticated */}
        {activeMainTab === 'admin' && isAdminAuthenticated && (
          <div className="flex items-center justify-between py-2 border-t border-slate-800/60 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Menu Guru/Admin:</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
                <button
                  id="subtab-configurator-btn"
                  onClick={() => onSelectAdminSubTab('configurator')}
                  className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
                    adminSubTab === 'configurator'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>1. Konfigurasi Ujian</span>
                </button>

                <button
                  id="subtab-proctor-btn"
                  onClick={() => onSelectAdminSubTab('proctor-dashboard')}
                  className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
                    adminSubTab === 'proctor-dashboard'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>2. Dashboard Pengawas</span>
                  {(blockedCount > 0 || violationCount > 0) && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                      {blockedCount > 0 ? `${blockedCount}` : violationCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={onLockAdmin}
              className="sm:hidden text-rose-400 hover:text-rose-300 font-semibold"
            >
              Kunci Admin
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
