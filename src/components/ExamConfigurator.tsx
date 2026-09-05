import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Play, 
  AlertTriangle, 
  Smartphone, 
  Maximize2, 
  Layers, 
  Clock, 
  KeyRound,
  FileCode,
  Sparkles,
  RefreshCw,
  Fingerprint,
  ShieldAlert
} from 'lucide-react';
import { ExamPayload } from '../types';
import { saveExamConfig } from '../utils/proctorSync';

interface ExamConfiguratorProps {
  config: ExamPayload;
  setConfig: (config: ExamPayload) => void;
  onLaunchPlayer: () => void;
  onOpenProctor: () => void;
  onOpenAiAssistant: () => void;
}

export const ExamConfigurator: React.FC<ExamConfiguratorProps> = ({
  config,
  setConfig,
  onLaunchPlayer,
  onOpenProctor,
  onOpenAiAssistant,
}) => {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState('');

  const currentExam = config.exam_config;

  const updateConfig = (updater: (prev: ExamPayload) => ExamPayload) => {
    const next = updater(config);
    setConfig(next);
    saveExamConfig(next);
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ujianaman_${currentExam.exam_name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'config'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyPreset = (presetType: 'google_math' | 'jotform_science' | 'strict_quiz') => {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    const expDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:00`;

    let next: ExamPayload;

    if (presetType === 'google_math') {
      next = {
        exam_config: {
          exam_name: "Penilaian Akhir Semester - Matematika Wajib",
          target_class: "Kelas XII - MIPA 1 & 2",
          form_source_url: "https://docs.google.com/forms/d/e/1FAIpQLSc_EXAMPLE_MATH/viewform",
          security_rules: {
            force_fullscreen: true,
            block_tab_switch: true,
            block_floating_apps: true,
            max_allowed_violations: 1,
            violation_penalty_seconds: 10,
            action_on_exceed: "LOCK_PERMANENTLY"
          },
          token_settings: {
            expiration_datetime: expDate,
            max_attempts: 1,
            access_pin: "MATH-XII"
          }
        }
      };
    } else if (presetType === 'jotform_science') {
      next = {
        exam_config: {
          exam_name: "Asesmen Sumatif - Fisika Kuantum & Optik",
          target_class: "Kelas XI - IPA Unggulan",
          form_source_url: "https://form.jotform.com/231984729182061",
          security_rules: {
            force_fullscreen: true,
            block_tab_switch: true,
            block_floating_apps: true,
            max_allowed_violations: 1,
            violation_penalty_seconds: 10,
            action_on_exceed: "LOCK_PERMANENTLY"
          },
          token_settings: {
            expiration_datetime: expDate,
            max_attempts: 1,
            access_pin: "FISIKA-2026"
          }
        }
      };
    } else {
      next = {
        exam_config: {
          exam_name: "Ujian Blok Ketat - Bahasa Indonesia",
          target_class: "Seluruh Kelas X",
          form_source_url: "https://docs.google.com/forms/d/e/1FAIpQLSd_EXAMPLE_INDO/viewform",
          security_rules: {
            force_fullscreen: true,
            block_tab_switch: true,
            block_floating_apps: true,
            max_allowed_violations: 0, // 0 toleransi
            violation_penalty_seconds: 10,
            action_on_exceed: "LOCK_PERMANENTLY"
          },
          token_settings: {
            expiration_datetime: expDate,
            max_attempts: 1,
            access_pin: "IND-STRICT"
          }
        }
      };
    }

    setConfig(next);
    saveExamConfig(next);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.exam_config || !parsed.exam_config.security_rules) {
        throw new Error("Format JSON harus menyertakan 'exam_config' dan 'security_rules'.");
      }
      setConfig(parsed);
      saveExamConfig(parsed);
      setShowImportModal(false);
      setImportText('');
      setImportError('');
    } catch (e: any) {
      setImportError(e.message || 'JSON tidak valid');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              MODUL PENGATUR KEAMANAN UJIAN
            </span>
            <span className="text-xs text-slate-400">Protokol Anti-Curang Web & Mobile</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Konfigurator & Generator Payload Sistem
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Bungkus link ujian online (Google Forms, Jotform, Web LMS) dengan sandbox penguncian browser otomatis, deteksi tab baru, split screen, dan auto-block.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            id="consult-ai-btn"
            onClick={onOpenAiAssistant}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tanya AI Asisten</span>
          </button>

          <button
            id="test-player-btn"
            onClick={onLaunchPlayer}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Uji Coba di Player Siswa</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Select */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs">
        <span className="text-slate-400 font-medium px-2">Preset Cepat Guru:</span>
        <button
          onClick={() => handleApplyPreset('google_math')}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          Google Forms Matematika (Standar 1x)
        </button>
        <button
          onClick={() => handleApplyPreset('jotform_science')}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          Jotform Sains (Standar 1x)
        </button>
        <button
          onClick={() => handleApplyPreset('strict_quiz')}
          className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 transition"
        >
          Ketat Maksimal (0x Toleransi)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Identitas Ujian & Link */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileCode className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  1. Informasi Ujian & Integrasi Link
                </h2>
                <p className="text-xs text-slate-400">
                  Tautan soal Google Forms atau form ujian yang akan dibungkus
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Nama Ujian / Mata Pelajaran
                </label>
                <input
                  id="input-exam-name"
                  type="text"
                  value={currentExam.exam_name}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: { ...prev.exam_config, exam_name: e.target.value },
                    }))
                  }
                  placeholder="Misal: Penilaian Akhir Matematika"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Target Kelas / Grup
                </label>
                <input
                  id="input-target-class"
                  type="text"
                  value={currentExam.target_class}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: { ...prev.exam_config, target_class: e.target.value },
                    }))
                  }
                  placeholder="Misal: Kelas XII - MIPA 1"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>URL Sumber Soal (Google Forms / Jotform / LMS)</span>
                <span className="text-[11px] text-emerald-400 font-normal">Tautan aktif terproteksi</span>
              </label>
              <div className="relative">
                <input
                  id="input-form-url"
                  type="url"
                  value={currentExam.form_source_url}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: { ...prev.exam_config, form_source_url: e.target.value },
                    }))
                  }
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-emerald-300 placeholder-slate-500 font-mono text-xs outline-none"
                />
                {currentExam.form_source_url && (
                  <a
                    href={currentExam.form_source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    title="Buka form asli"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Siswa tidak akan diberikan tautan langsung ini. Sistem UjianAman.id akan menginjeksi pengawasan keamanan di sekelilingnya.
              </p>
            </div>
          </div>

          {/* Card 2: Aturan Keamanan Wajib (System Security Rules) */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  2. Parameter & Protokol Keamanan Wajib
                </h2>
                <p className="text-xs text-slate-400">
                  Aturan penguncian layar, pencegahan tab switching, dan sanksi
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Force Fullscreen */}
              <div className="flex items-start justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 mt-0.5">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Lock Fullscreen (Layar Penuh Wajib)</span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        WAJIB AKTIF
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Memaksa layar penuh otomatis. Percobaan keluar dari layar penuh dihitung sebagai pelanggaran.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={currentExam.security_rules.force_fullscreen}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: {
                        ...prev.exam_config,
                        security_rules: {
                          ...prev.exam_config.security_rules,
                          force_fullscreen: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer mt-1"
                />
              </div>

              {/* Block Tab Switch */}
              <div className="flex items-start justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Anti-Tab Switching & New Window</span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                        REAL-TIME HOOK
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mendeteksi seketika saat siswa membuka tab baru, pindah jendela browser, atau beralih aplikasi.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={currentExam.security_rules.block_tab_switch}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: {
                        ...prev.exam_config,
                        security_rules: {
                          ...prev.exam_config.security_rules,
                          block_tab_switch: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer mt-1"
                />
              </div>

              {/* Block Floating Apps & Split Screen */}
              <div className="flex items-start justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-900 text-amber-400 mt-0.5">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Anti-Split Screen & Floating Apps</span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                        MOBILE & DESKTOP
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mencegah penggunaan kalkulator mengambang, WhatsApp pop-up, atau pembagian layar di HP/tablet.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={currentExam.security_rules.block_floating_apps}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: {
                        ...prev.exam_config,
                        security_rules: {
                          ...prev.exam_config.security_rules,
                          block_floating_apps: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer mt-1"
                />
              </div>
            </div>

            {/* Toleransi & Penalti Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Batas Pelanggaran (Maks)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="input-max-violations"
                    type="number"
                    min="0"
                    max="5"
                    value={currentExam.security_rules.max_allowed_violations}
                    onChange={(e) =>
                      updateConfig((prev) => ({
                        ...prev,
                        exam_config: {
                          ...prev.exam_config,
                          security_rules: {
                            ...prev.exam_config.security_rules,
                            max_allowed_violations: Math.max(0, parseInt(e.target.value) || 0),
                          },
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-emerald-400 focus:border-emerald-500 outline-none"
                  />
                  <span className="text-xs text-slate-400">kali</span>
                </div>
                <p className="text-[11px] text-slate-500">Default: 1x pelanggaran</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Jeda Penalti Beku Layar
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="input-penalty-seconds"
                    type="number"
                    min="5"
                    max="60"
                    step="5"
                    value={currentExam.security_rules.violation_penalty_seconds}
                    onChange={(e) =>
                      updateConfig((prev) => ({
                        ...prev,
                        exam_config: {
                          ...prev.exam_config,
                          security_rules: {
                            ...prev.exam_config.security_rules,
                            violation_penalty_seconds: Math.max(5, parseInt(e.target.value) || 10),
                          },
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-amber-400 focus:border-emerald-500 outline-none"
                  />
                  <span className="text-xs text-slate-400">detik</span>
                </div>
                <p className="text-[11px] text-slate-500">Layar terkunci 10 detik</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Sanksi Melebihi Batas
                </label>
                <select
                  id="select-action-exceed"
                  value={currentExam.security_rules.action_on_exceed}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: {
                        ...prev.exam_config,
                        security_rules: {
                          ...prev.exam_config.security_rules,
                          action_on_exceed: e.target.value as any,
                        },
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-rose-900/40 text-xs font-bold text-rose-400 focus:border-rose-500 outline-none"
                >
                  <option value="LOCK_PERMANENTLY">LOCK_PERMANENTLY (Blokir Total)</option>
                  <option value="AUTO_SUBMIT">AUTO_SUBMIT (Kirim Otomatis)</option>
                  <option value="WARN_ONLY">WARN_ONLY (Hanya Peringatan)</option>
                </select>
                <p className="text-[11px] text-rose-400/80">Siswa tidak bisa lanjut ujian</p>
              </div>
            </div>
          </div>

          {/* Card 3: Token Settings & Waktu */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  3. Token & Masa Berlaku Akses
                </h2>
                <p className="text-xs text-slate-400">
                  Batas waktu pengerjaan dan PIN pembuka akses siswa
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300">
                  Batas Akhir Ujian (Expiration Datetime)
                </label>
                <div className="relative">
                  <input
                    id="input-expiration-datetime"
                    type="text"
                    value={currentExam.token_settings.expiration_datetime}
                    onChange={(e) =>
                      updateConfig((prev) => ({
                        ...prev,
                        exam_config: {
                          ...prev.exam_config,
                          token_settings: {
                            ...prev.exam_config.token_settings,
                            expiration_datetime: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="YYYY-MM-DD HH:MM"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-emerald-500 outline-none"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  PIN Token Masuk
                </label>
                <input
                  id="input-access-pin"
                  type="text"
                  value={currentExam.token_settings.access_pin || 'AMAN-2026'}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      exam_config: {
                        ...prev.exam_config,
                        token_settings: {
                          ...prev.exam_config.token_settings,
                          access_pin: e.target.value.toUpperCase(),
                        },
                      },
                    }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-emerald-400 focus:border-emerald-500 outline-none text-center tracking-widest"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Protokol Darurat & Panic Combo */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  4. Protokol Akses Darurat & Panic Combo
                </h2>
                <p className="text-xs text-slate-400">
                  Mekanisme pemulihan sesi terkunci & force exit aman bagi pengawas
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Master PIN Dinamis (Rotasi 90s)</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Tersedia 6-digit PIN dinamis di Dashboard Pengawas yang diperbarui berkala untuk membuka layar siswa terkunci melalui tombol <strong>"Buka Akses Darurat"</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <KeyRound className="w-4 h-4" />
                  <span>Reset Sesi Spesifik NIS Siswa</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Pengawas dapat menerbitkan Token Pemulihan khusus per NIS (<code className="text-indigo-300 font-mono">REC-XXXX-XXXX</code>) agar siswa bisa <strong>resume ujian dari titik terakhir tanpa kehilangan lembar jawaban</strong>.
                </p>
              </div>

              <div className="sm:col-span-2 p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-slate-300 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <Fingerprint className="w-4 h-4" />
                  <span>Mekanisme Force Exit "Panic Combo"</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Karena tombol Home / Back diblokir, kombinasi <strong>tekan & tahan 3 jari selama 5 detik</strong> di area pojok atas layar memicu dialog verifikasi PIN pengawas untuk keluar dari peramban secara aman tanpa membekukan atau merusak perangkat siswa.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live JSON Payload Output & Actions */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            {/* Header of Code Box */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono font-medium text-slate-300 ml-2">
                  exam_security_payload.json
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  id="copy-json-btn"
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Salin JSON"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Salin</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Unduh file JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* JSON Code Viewer */}
            <div className="p-4 bg-slate-950/90 max-h-[440px] overflow-auto text-xs font-mono leading-relaxed">
              <pre className="text-emerald-400/90 whitespace-pre">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Status Payload:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Siap Diproses Browser Lock
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  id="launch-sim-btn"
                  onClick={onLaunchPlayer}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-md hover:shadow-teal-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Uji di Player</span>
                </button>

                <button
                  id="open-dashboard-btn"
                  onClick={onOpenProctor}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md hover:shadow-indigo-500/20"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Pantau Siswa</span>
                </button>
              </div>

              <button
                onClick={() => setShowImportModal(true)}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 underline pt-1"
              >
                Punya JSON Konfigurasi dari AI? Impor di sini
              </button>
            </div>
          </div>

          {/* Security Guarantee Box */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-200/90 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Garansi Protokol Keamanan UjianAman.id</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Payload JSON ini mengaktifkan event listener tingkat peramban (`Page Visibility API`, `Fullscreen API`, dan rasio viewport window) untuk menjamin ujian berlangsung tanpa celah kecurangan.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Import JSON */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Impor JSON Konfigurasi Ujian</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Tempelkan payload JSON dari asisten AI atau backup sebelumnya untuk memperbarui konfigurasi.
            </p>
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Tempel JSON di sini..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 outline-none focus:border-emerald-500"
            />
            {importError && (
              <p className="text-xs text-rose-400">{importError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleImportJson}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Terapkan JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
