import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  AlertTriangle, 
  Smartphone, 
  Maximize2, 
  Layers, 
  Clock, 
  KeyRound,
  Sparkles,
  Save,
  PlusCircle,
  Trash2,
  Edit3,
  CheckCircle2,
  Fingerprint,
  Monitor,
  Radio,
  FileText,
  Cloud
} from 'lucide-react';
import { ExamPayload, SavedExamItem } from '../types';
import { 
  saveExamConfig, 
  getSavedExamList, 
  saveExamToList, 
  deleteExamFromList,
  subscribeToSyncMessages
} from '../utils/proctorSync';
import {
  cloudSaveExam,
  cloudDeleteExam,
  subscribeToCloudExams,
  initializeFirestoreExamsIfNeeded
} from '../utils/firebaseSync';

interface ExamConfiguratorProps {
  config: ExamPayload;
  setConfig: (config: ExamPayload) => void;
  onLaunchPlayer: () => void;
  onOpenProctor: () => void;
}

export const ExamConfigurator: React.FC<ExamConfiguratorProps> = ({
  config,
  setConfig,
  onLaunchPlayer,
  onOpenProctor,
}) => {
  // Current editing state
  const [examName, setExamName] = useState(config.exam_config.exam_name || '');
  const [targetClass, setTargetClass] = useState(config.exam_config.target_class || '');
  const [formUrl, setFormUrl] = useState(config.exam_config.form_source_url || '');
  const [accessPin, setAccessPin] = useState(config.exam_config.token_settings.access_pin || 'AMAN-2026');
  const [expirationDatetime, setExpirationDatetime] = useState(
    config.exam_config.token_settings.expiration_datetime || '2026-09-08 14:00'
  );

  // Security checkboxes
  const [forceFullscreen, setForceFullscreen] = useState(config.exam_config.security_rules.force_fullscreen);
  const [blockTabSwitch, setBlockTabSwitch] = useState(config.exam_config.security_rules.block_tab_switch);
  const [blockFloatingApps, setBlockFloatingApps] = useState(config.exam_config.security_rules.block_floating_apps);
  const [maxViolations, setMaxViolations] = useState(config.exam_config.security_rules.max_allowed_violations);
  const [violationPenaltySeconds, setViolationPenaltySeconds] = useState(
    config.exam_config.security_rules.violation_penalty_seconds || 10
  );
  const [actionOnExceed, setActionOnExceed] = useState(
    config.exam_config.security_rules.action_on_exceed || 'LOCK_PERMANENTLY'
  );

  // Saved Exams List State
  const [savedExams, setSavedExams] = useState<SavedExamItem[]>(() => getSavedExamList());
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState(false);
  const [activePreset, setActivePreset] = useState<'strict' | 'zero' | 'practice'>('strict');
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  // Initialize and subscribe to real-time Firestore database
  useEffect(() => {
    // Seed default exams if Firestore collection is fresh
    initializeFirestoreExamsIfNeeded();

    // Subscribe to real-time cloud changes from all devices & phones
    const unsubCloud = subscribeToCloudExams((cloudList) => {
      setSavedExams(cloudList);
    });

    const unsubLocal = subscribeToSyncMessages((msg) => {
      if (msg.type === 'EXAM_LIST_UPDATED') {
        setSavedExams(msg.list);
      }
    });

    return () => {
      unsubCloud();
      unsubLocal();
    };
  }, []);

  // Apply Quick Preset
  const applyPreset = (preset: 'strict' | 'zero' | 'practice') => {
    setActivePreset(preset);
    if (preset === 'strict') {
      setForceFullscreen(true);
      setBlockTabSwitch(true);
      setBlockFloatingApps(true);
      setMaxViolations(1);
      setViolationPenaltySeconds(10);
      setActionOnExceed('LOCK_PERMANENTLY');
    } else if (preset === 'zero') {
      setForceFullscreen(true);
      setBlockTabSwitch(true);
      setBlockFloatingApps(true);
      setMaxViolations(0);
      setViolationPenaltySeconds(10);
      setActionOnExceed('LOCK_PERMANENTLY');
    } else {
      setForceFullscreen(true);
      setBlockTabSwitch(true);
      setBlockFloatingApps(false);
      setMaxViolations(3);
      setViolationPenaltySeconds(5);
      setActionOnExceed('WARN_ONLY');
    }
  };

  // Main Action: "Simpan & Terbitkan Asesmen"
  const handleSaveAndPublish = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!examName.trim()) {
      alert('Mohon masukkan Nama Ujian!');
      return;
    }
    if (!formUrl.trim()) {
      alert('Mohon masukkan Link/URL Soal Ujian (Google Forms, Jotform, dll)!');
      return;
    }

    const newPayload: ExamPayload = {
      exam_config: {
        exam_name: examName.trim(),
        target_class: targetClass.trim() || 'Semua Kelas',
        form_source_url: formUrl.trim(),
        security_rules: {
          force_fullscreen: forceFullscreen,
          block_tab_switch: blockTabSwitch,
          block_floating_apps: blockFloatingApps,
          max_allowed_violations: Number(maxViolations),
          violation_penalty_seconds: Number(violationPenaltySeconds),
          action_on_exceed: actionOnExceed,
        },
        token_settings: {
          expiration_datetime: expirationDatetime,
          max_attempts: 1,
          access_pin: accessPin.trim().toUpperCase() || 'AMAN-2026',
        },
      },
    };

    // Save to Firestore cloud database (and local fallback)
    setIsCloudSaving(true);
    try {
      await cloudSaveExam(newPayload, editingExamId || undefined);
      setConfig(newPayload);
      setSaveSuccessBanner(true);
      setEditingExamId(null);
    } catch (err) {
      console.error('Error saving exam:', err);
    } finally {
      setIsCloudSaving(false);
    }

    // Auto-scroll or keep view responsive
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load an existing exam to edit
  const handleSelectExamToEdit = (exam: SavedExamItem) => {
    setEditingExamId(exam.id);
    setExamName(exam.payload.exam_config.exam_name);
    setTargetClass(exam.payload.exam_config.target_class);
    setFormUrl(exam.payload.exam_config.form_source_url);
    setAccessPin(exam.payload.exam_config.token_settings.access_pin || 'AMAN-2026');
    setExpirationDatetime(exam.payload.exam_config.token_settings.expiration_datetime);
    setForceFullscreen(exam.payload.exam_config.security_rules.force_fullscreen);
    setBlockTabSwitch(exam.payload.exam_config.security_rules.block_tab_switch);
    setBlockFloatingApps(exam.payload.exam_config.security_rules.block_floating_apps);
    setMaxViolations(exam.payload.exam_config.security_rules.max_allowed_violations);
    setViolationPenaltySeconds(exam.payload.exam_config.security_rules.violation_penalty_seconds);
    setActionOnExceed(exam.payload.exam_config.security_rules.action_on_exceed);

    // Also activate it
    setConfig(exam.payload);
    saveExamConfig(exam.payload);
    setSaveSuccessBanner(false);
  };

  // Activate directly
  const handleActivateExam = async (exam: SavedExamItem) => {
    setConfig(exam.payload);
    saveExamConfig(exam.payload);
    await cloudSaveExam(exam.payload, exam.id);
    alert(`Ujian "${exam.name}" sekarang aktif sebagai ujian utama!`);
  };

  // Delete an exam
  const handleDeleteExam = async (id: string, name: string) => {
    if (confirm(`Hapus ujian "${name}" dari database cloud?`)) {
      const nextList = await cloudDeleteExam(id);
      setSavedExams(nextList);
    }
  };

  // Reset form to create new
  const handleCreateNew = () => {
    setEditingExamId(null);
    setExamName('');
    setTargetClass('Kelas X');
    setFormUrl('');
    setAccessPin('AMAN-2026');
    setSaveSuccessBanner(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
              ALUR KERJA GURU: BUAT SEKALI, PAKAI LANGSUNG
            </span>
            <span className="text-xs text-slate-400">Konfigurasi Ujian Online Aman</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Konfigurasi & Penerbitan Asesmen
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Masukkan link Google Forms/Jotform, atur PIN dan protokol keamanan, lalu klik <strong>"Simpan & Terbitkan Asesmen"</strong>. Ujian langsung otomatis tersedia di Asesmen Siswa tanpa repot file JSON!
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleCreateNew}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Buat Ujian Baru</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/80 text-white shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-200">
                Ujian Berhasil Diterbitkan dan Siap Dipakai!
              </h3>
              <p className="text-xs text-slate-300">
                Ujian <strong>"{examName}"</strong> kini tersimpan di database lokal dan langsung muncul di pilihan asesmen siswa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onLaunchPlayer}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/30"
            >
              <Monitor className="w-4 h-4" />
              <span>Buka di Asesmen Siswa</span>
            </button>
            <button
              onClick={onOpenProctor}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
            >
              <Radio className="w-4 h-4" />
              <span>Pantau di Dashboard Pengawas</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Left Form (1 Stream Form), Right: Saved Exams Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form (7 Cols): Single Stream Workflow */}
        <form onSubmit={handleSaveAndPublish} className="lg:col-span-7 space-y-6">
          {/* Section 1: Exam Info & Link Integration */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                1
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Informasi Ujian & Integrasi Link Soal
                </h2>
                <p className="text-xs text-slate-400">
                  Judul asesmen, target kelas, dan link lembar soal online
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Nama Ujian / Mata Pelajaran <span className="text-rose-400">*</span></span>
                  {editingExamId && (
                    <span className="text-[10px] text-amber-400 font-mono">Sedang mengedit ujian</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Contoh: Penilaian Akhir Semester - Matematika & Logika Terapan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target Kelas</label>
                  <input
                    type="text"
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    placeholder="Contoh: Kelas XII - MIPA 1"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">PIN Token Masuk Siswa</label>
                  <input
                    type="text"
                    value={accessPin}
                    onChange={(e) => setAccessPin(e.target.value.toUpperCase())}
                    placeholder="Contoh: AMAN-2026"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-emerald-400 focus:border-emerald-500 outline-none tracking-wider"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>URL Form Soal (Google Forms / Jotform / LMS) <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-slate-500">Mendukung embed HTTPS</span>
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:border-emerald-500 outline-none"
                />

                {/* Quick Link Helpers */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">Contoh format:</span>
                  <button
                    type="button"
                    onClick={() => setFormUrl('https://docs.google.com/forms/d/e/1FAIpQLSc_EXAMPLE_MATH/viewform')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                  >
                    Google Forms
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormUrl('https://form.jotform.com/24000123456789')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                  >
                    Jotform
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormUrl('https://forms.office.com/r/SAMPLE123')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                  >
                    Office Forms
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Security Rules & Preset */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                2
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Parameter Keamanan & Protokol Pengawasan
                </h2>
                <p className="text-xs text-slate-400">
                  Pilih preset penguncian atau sesuaikan aturan anti-curang
                </p>
              </div>
            </div>

            {/* Quick 1-Click Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => applyPreset('strict')}
                className={`p-3 rounded-xl border text-left transition ${
                  activePreset === 'strict'
                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Standar Ketat</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Toleransi 1x. Penalti beku 10s, pelanggaran berikutnya diblokir permanen.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('zero')}
                className={`p-3 rounded-xl border text-left transition ${
                  activePreset === 'zero'
                    ? 'bg-rose-950/50 border-rose-500 text-rose-300 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Zero Tolerance</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Toleransi 0x. Sekali tab ditutup/keluar langsung dikunci total.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('practice')}
                className={`p-3 rounded-xl border text-left transition ${
                  activePreset === 'practice'
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Latihan / Fleksibel</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Toleransi 3x peringatan. Layar tidak diblokir permanen.
                </p>
              </button>
            </div>

            {/* Checkboxes for security triggers */}
            <div className="space-y-2.5 pt-2">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Maximize2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Wajib Layar Penuh (Fullscreen Lockdown)</div>
                    <div className="text-[11px] text-slate-400">Mencegah akses taskbar, menu browser, dan notifikasi OS</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={forceFullscreen}
                  onChange={(e) => setForceFullscreen(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Anti-Tab Switching & Jendela Baru</div>
                    <div className="text-[11px] text-slate-400">Deteksi langsung saat siswa membuka tab lain atau berpindah jendela</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={blockTabSwitch}
                  onChange={(e) => setBlockTabSwitch(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Anti-Split Screen & Aplikasi Mengambang (Floating Apps)</div>
                    <div className="text-[11px] text-slate-400">Mencegah WhatsApp pop-up, split screen HP, atau kalkulator mengambang</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={blockFloatingApps}
                  onChange={(e) => setBlockFloatingApps(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Fine tuning parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Toleransi Pelanggaran Maksimal</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={maxViolations}
                    onChange={(e) => setMaxViolations(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:border-emerald-500 outline-none"
                  />
                  <span className="text-xs text-slate-400 whitespace-nowrap">kali toleransi</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Batas Waktu Pengerjaan (Exp)</label>
                <input
                  type="text"
                  value={expirationDatetime}
                  onChange={(e) => setExpirationDatetime(e.target.value)}
                  placeholder="YYYY-MM-DD HH:MM"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Master Action Button "Simpan & Terbitkan Asesmen" */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border-2 border-emerald-500/50 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span>Sinkronisasi Cloud Firebase Aktif</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                HP Siswa Real-time
              </span>
            </div>

            <button
              id="btn-save-and-publish"
              type="submit"
              disabled={isCloudSaving}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>{isCloudSaving ? 'Menyinkron ke Cloud Firebase...' : 'Simpan & Terbitkan Asesmen ke Cloud'}</span>
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              Setelah diklik, ujian langsung tersimpan ke Database Cloud Firebase dan otomatis muncul di layar HP setiap siswa secara real-time.
            </p>
          </div>
        </form>

        {/* Right Column (5 Cols): Catalog of Saved Exams & Emergency Protocols */}
        <div className="lg:col-span-5 space-y-6">
          {/* Saved Exams List */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Daftar Asesmen yang Tersimpan ({savedExams.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Lokal Storage</span>
            </div>

            <p className="text-xs text-slate-400">
              Ujian di bawah ini langsung muncul pada menu dropdown siswa di tab <strong>Asesmen Siswa</strong>.
            </p>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {savedExams.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Belum ada ujian tersimpan. Isi formulir di samping dan klik <strong>"Simpan & Terbitkan Asesmen"</strong>.
                </div>
              ) : (
                savedExams.map((exam) => {
                  const isActive = config.exam_config.exam_name === exam.name;

                  return (
                    <div
                      key={exam.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 transition ${
                        isActive
                          ? 'bg-slate-950 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/20'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white leading-snug">{exam.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {exam.targetClass} | PIN: <span className="text-emerald-400 font-bold">{exam.payload.exam_config.token_settings.access_pin}</span>
                          </div>
                        </div>

                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                            SEDANG AKTIF
                          </span>
                        )}
                      </div>

                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSelectExamToEdit(exam)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleActivateExam(exam)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-300 text-[11px] font-medium transition"
                            >
                              Jadikan Aktif
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteExam(exam.id, exam.name)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                          title="Hapus Ujian"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Info Box: Protokol Pemulihan & Panic Exit */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-md space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Fingerprint className="w-4 h-4 text-rose-400" />
              <span>Protokol Pengawas Selama Ujian:</span>
            </div>
            <ul className="space-y-2 text-[11px] text-slate-400 list-disc list-inside">
              <li>
                <strong className="text-slate-300">Master PIN Dinamis:</strong> Pengawas memegang 6-digit PIN yang otomatis diperbarui setiap 90s di Dashboard Pengawas untuk membuka kunci layar siswa darurat.
              </li>
              <li>
                <strong className="text-slate-300">Token Pemulihan (NIS):</strong> Pengawas dapat menerbitkan kode khusus NIS siswa agar siswa resume tanpa kehilangan jawaban.
              </li>
              <li>
                <strong className="text-slate-300">Panic Exit (3 Jari 5 Detik):</strong> Kombinasi tahan 3 jari 5 detik di layar siswa memicu dialog PIN keluar darurat secara aman tanpa merusak perangkat.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
