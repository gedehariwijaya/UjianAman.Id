import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ExamConfigurator } from './components/ExamConfigurator';
import { SecurePlayer } from './components/SecurePlayer';
import { ProctorDashboard } from './components/ProctorDashboard';
import { ExamPayload } from './types';
import { 
  getSavedExamConfig, 
  getSavedSessions, 
  subscribeToSyncMessages, 
  saveExamConfig 
} from './utils/proctorSync';
import { ShieldCheck, Lock, Unlock, AlertCircle, X, KeyRound, ArrowRight, Monitor, Radio, Terminal } from 'lucide-react';

const ADMIN_PASSWORD = 'aman1234';
const AUTH_STORAGE_KEY = 'ujianaman_admin_auth';

export default function App() {
  // Tab 1: Simulator Siswa (Default landing page) | Tab 2: Admin (Password Protected)
  const [activeMainTab, setActiveMainTab] = useState<'student-simulator' | 'admin'>('student-simulator');
  
  // Admin Sub-Tabs: 'configurator' (Konfigurasi Ujian) | 'proctor-dashboard' (Dashboard Pengawas)
  const [adminSubTab, setAdminSubTab] = useState<'configurator' | 'proctor-dashboard'>('configurator');

  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  });

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [inputPassword, setInputPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Active exam configuration
  const [config, setConfig] = useState<ExamPayload>(() => getSavedExamConfig());
  const [blockedCount, setBlockedCount] = useState(0);
  const [violationCount, setViolationCount] = useState(0);

  // Keep badge counts and active config updated
  useEffect(() => {
    const updateCounts = () => {
      const sessions = getSavedSessions();
      setBlockedCount(sessions.filter((s) => s.status === 'blocked').length);
      setViolationCount(sessions.reduce((acc, s) => acc + s.violationsCount, 0));
    };

    updateCounts();

    const unsub = subscribeToSyncMessages((msg) => {
      updateCounts();
      if (msg.type === 'CONFIG_UPDATED') {
        setConfig(msg.config);
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ujianaman_active_config') {
        setConfig(getSavedExamConfig());
      }
      updateCounts();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // When switching tabs
  const handleSelectMainTab = (tab: 'student-simulator' | 'admin') => {
    if (tab === 'admin') {
      if (isAdminAuthenticated) {
        setActiveMainTab('admin');
      } else {
        setShowPasswordModal(true);
        setPasswordError('');
        setInputPassword('');
        setTimeout(() => {
          passwordInputRef.current?.focus();
        }, 100);
      }
    } else {
      // Ensure latest config is loaded when returning to student tab
      setConfig(getSavedExamConfig());
      setActiveMainTab('student-simulator');
    }
  };

  // Password submit handler
  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPassword === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      setShowPasswordModal(false);
      setInputPassword('');
      setPasswordError('');
      setActiveMainTab('admin');
    } else {
      setPasswordError('Password salah! Masukkan password admin yang benar (aman1234).');
      setInputPassword('');
      passwordInputRef.current?.focus();
    }
  };

  // Cancel password modal
  const handleCancelPassword = () => {
    setShowPasswordModal(false);
    setInputPassword('');
    setPasswordError('');
  };

  // Lock Admin
  const handleLockAdmin = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setActiveMainTab('student-simulator');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Global Header with 2 Main Tabs: Simulator Siswa & Admin */}
      <Header
        activeMainTab={activeMainTab}
        onSelectTab={handleSelectMainTab}
        isAdminAuthenticated={isAdminAuthenticated}
        adminSubTab={adminSubTab}
        onSelectAdminSubTab={setAdminSubTab}
        onLockAdmin={handleLockAdmin}
        blockedCount={blockedCount}
        violationCount={violationCount}
      />

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col">
        {/* TAB 1: Simulator Siswa (Default Landing Page) */}
        {activeMainTab === 'student-simulator' && (
          <SecurePlayer
            config={config}
            onExitPlayer={() => {
              if (isAdminAuthenticated) {
                setActiveMainTab('admin');
              } else {
                handleSelectMainTab('admin');
              }
            }}
          />
        )}

        {/* TAB 2: Admin View (Only rendered when authenticated) */}
        {activeMainTab === 'admin' && isAdminAuthenticated && (
          <div className="flex-1 flex flex-col">
            {adminSubTab === 'configurator' && (
              <ExamConfigurator
                config={config}
                setConfig={setConfig}
                onLaunchPlayer={() => setActiveMainTab('student-simulator')}
                onOpenProctor={() => setAdminSubTab('proctor-dashboard')}
              />
            )}

            {adminSubTab === 'proctor-dashboard' && (
              <ProctorDashboard
                config={config}
                onOpenPlayer={() => setActiveMainTab('student-simulator')}
              />
            )}
          </div>
        )}
      </main>

      {/* Admin Password Modal (Protected with aman1234) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    Akses Menu Admin & Guru
                  </h3>
                  <p className="text-xs text-slate-400">
                    Halaman ini dikhususkan bagi Pengajar/Proctor
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelPassword}
                className="text-slate-500 hover:text-slate-300 transition p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Masukkan Password Admin:</span>
                  <span className="text-[11px] text-slate-500 font-mono">Default: aman1234</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    ref={passwordInputRef}
                    type="password"
                    required
                    value={inputPassword}
                    onChange={(e) => {
                      setInputPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Ketik password admin..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:border-indigo-500 outline-none shadow-inner"
                  />
                </div>
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelPassword}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <span>Buka Akses Admin</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Catatan Keamanan:</span> Password admin melindungi menu konfigurasi ujian, kunci token darurat, dan rekaman log pengawasan dari akses siswa.
            </div>
          </div>
        </div>
      )}

      {/* Global Footer (Hidden in Simulator Siswa to give maximum focus) */}
      {activeMainTab !== 'student-simulator' && (
        <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-500 py-6 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-slate-300">UjianAman.id</span>
              <span>— Platform Keamanan & Pengawasan Asesmen Berbasis Web</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1 text-slate-400">
                <Lock className="w-3 h-3 text-emerald-400" /> Password Protected Admin: aman1234
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Sistem Buat Sekali, Pakai Langsung</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
