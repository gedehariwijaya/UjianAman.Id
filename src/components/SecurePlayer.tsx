import React, { useState, useEffect, useRef } from 'react';
import { 
  Maximize, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  AlertOctagon, 
  Clock, 
  UserCheck, 
  RotateCcw, 
  ExternalLink,
  Info,
  CheckCircle2,
  XCircle,
  EyeOff,
  SplitSquareVertical,
  Layers,
  Volume2
} from 'lucide-react';
import { ExamPayload, StudentSession, StudentViolationRecord, ProctorLog } from '../types';
import { playWarningBeep, playBlockAlarm } from '../utils/audioAlerts';
import { broadcastMessage, subscribeToSyncMessages } from '../utils/proctorSync';

interface SecurePlayerProps {
  config: ExamPayload;
  onExitPlayer: () => void;
}

export const SecurePlayer: React.FC<SecurePlayerProps> = ({ config, onExitPlayer }) => {
  const currentExam = config.exam_config;
  const security = currentExam.security_rules;

  // Student details in simulator
  const [studentName, setStudentName] = useState('Raden Fajar Pratama');
  const [studentNis, setStudentNis] = useState('202611048');
  const [enteredPin, setEnteredPin] = useState(currentExam.token_settings.access_pin || 'AMAN-2026');

  // Exam phase: 'lobby' | 'active' | 'warning_penalty' | 'blocked_permanent' | 'finished'
  const [phase, setPhase] = useState<'lobby' | 'active' | 'warning_penalty' | 'blocked_permanent' | 'finished'>('lobby');

  const [violations, setViolations] = useState<StudentViolationRecord[]>([]);
  const [penaltySeconds, setPenaltySeconds] = useState(10);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [proctorPinInput, setProctorPinInput] = useState('');
  const [unblockError, setUnblockError] = useState('');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [useFallbackForm, setUseFallbackForm] = useState(false);

  // Student session ID
  const sessionIdRef = useRef('stu_' + Math.random().toString(36).substr(2, 9));
  const containerRef = useRef<HTMLDivElement>(null);

  // Create student session object
  const getSessionObject = (currentPhase = phase, violationList = violations, penaltyTime = penaltySeconds): StudentSession => {
    let status: StudentSession['status'] = 'active';
    if (currentPhase === 'blocked_permanent') status = 'blocked';
    else if (currentPhase === 'warning_penalty') status = 'warning';
    else if (currentPhase === 'finished') status = 'submitted';

    return {
      studentId: sessionIdRef.current,
      studentName,
      studentNis,
      examId: currentExam.exam_name,
      status,
      device: navigator.userAgent.includes('Mobile') ? 'Smartphone (Android/iOS)' : 'Desktop/Laptop (Windows/Mac)',
      os: navigator.platform || 'Unknown OS',
      browser: 'Secure Browser Sandbox',
      violationsCount: violationList.length,
      maxViolations: security.max_allowed_violations,
      penaltySecondsLeft: penaltyTime,
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
      recentViolations: violationList,
    };
  };

  // Broadcast student heartbeat
  useEffect(() => {
    if (phase === 'lobby') return;

    const interval = setInterval(() => {
      broadcastMessage({
        type: 'STUDENT_HEARTBEAT',
        session: getSessionObject(),
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [phase, violations, penaltySeconds]);

  // Listen for remote unblock messages from proctor dashboard
  useEffect(() => {
    const unsub = subscribeToSyncMessages((msg) => {
      if (msg.type === 'PROCTOR_UNLOCK' && msg.studentId === sessionIdRef.current) {
        setPhase('active');
        setPenaltySeconds(0);
        setViolations([]);
        setUnblockError('');
      } else if (msg.type === 'PROCTOR_GLOBAL_ALERT') {
        alert(`[Pesan Pengawas]: ${msg.message}`);
      }
    });

    return () => unsub();
  }, []);

  // Penalty countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'warning_penalty' && penaltySeconds > 0) {
      timer = setInterval(() => {
        setPenaltySeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase, penaltySeconds]);

  // Handler to register security violation
  const triggerViolation = (type: StudentViolationRecord['type'], title: string, description: string) => {
    if (phase === 'lobby' || phase === 'blocked_permanent' || phase === 'finished') return;

    const newRecord: StudentViolationRecord = {
      id: 'v_' + Math.random().toString(36).substr(2, 8),
      type,
      title,
      description,
      timestamp: Date.now(),
    };

    const nextViolations = [...violations, newRecord];
    setViolations(nextViolations);

    const log: ProctorLog = {
      id: newRecord.id,
      timestamp: Date.now(),
      studentName,
      studentNis,
      type,
      details: `${title}: ${description}`,
      severity: nextViolations.length > security.max_allowed_violations ? 'danger' : 'warning',
    };

    // Check if exceeded max allowed violations
    if (nextViolations.length > security.max_allowed_violations) {
      if (security.action_on_exceed === 'LOCK_PERMANENTLY') {
        setPhase('blocked_permanent');
        playBlockAlarm();
        broadcastMessage({
          type: 'STUDENT_VIOLATION',
          log,
          session: getSessionObject('blocked_permanent', nextViolations, 0),
        });
        return;
      } else if (security.action_on_exceed === 'AUTO_SUBMIT') {
        setPhase('finished');
        broadcastMessage({
          type: 'STUDENT_VIOLATION',
          log,
          session: getSessionObject('finished', nextViolations, 0),
        });
        return;
      }
    }

    // Otherwise apply violation penalty cooldown
    playWarningBeep();
    setPenaltySeconds(security.violation_penalty_seconds || 10);
    setPhase('warning_penalty');

    broadcastMessage({
      type: 'STUDENT_VIOLATION',
      log,
      session: getSessionObject('warning_penalty', nextViolations, security.violation_penalty_seconds || 10),
    });
  };

  // Real-world Browser Hooks: Fullscreen, Visibility, Window Blur, Window Resize (Split-Screen)
  useEffect(() => {
    if (phase === 'lobby' || phase === 'blocked_permanent' || phase === 'finished') return;

    // 1. Anti-Tab Switching via visibilitychange
    const handleVisibilityChange = () => {
      if (document.hidden && security.block_tab_switch) {
        triggerViolation(
          'tab_switch',
          'Anti-Tab Switching Terpicu',
          'Siswa meninggalkan tab ujian, membuka tab baru, atau meminimalkan browser.'
        );
      }
    };

    // 2. Anti-Window Switching / Blur
    const handleWindowBlur = () => {
      if (security.block_tab_switch) {
        triggerViolation(
          'blur',
          'Fokus Jendela Hilang',
          'Kursor atau aplikasi lain di luar browser aktif (indikasi membuka aplikasi eksternal).'
        );
      }
    };

    // 3. Fullscreen Exit Detection
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && security.force_fullscreen) {
        triggerViolation(
          'fullscreen_exit',
          'Keluar dari Mode Layar Penuh',
          'Siswa keluar dari mode fullscreen yang diwajibkan oleh protokol ujian.'
        );
      }
    };

    // 4. Anti-Split Screen & Floating Window detection via window resize ratio
    const originalWidth = window.screen.availWidth || window.innerWidth;
    const handleWindowResize = () => {
      if (security.block_floating_apps) {
        const currentRatio = window.innerWidth / (window.screen.availWidth || window.innerWidth);
        if (currentRatio < 0.7) {
          triggerViolation(
            'split_screen',
            'Split Screen / Floating Apps Terdeteksi',
            'Lebar layar berkurang drastis di bawah 70% (indikasi pembagian layar atau jendela mengambang).'
          );
        }
      }
    };

    // 5. Anti-Cheat Keyboard & Context Menu
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+U, PrintScreen, Alt+Tab, Windows Key
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        triggerViolation(
          'devtools_or_key',
          'Upaya Akses Developer Tools / Source Code',
          `Siswa menekan kombinasi tombol terlarang: ${e.key}`
        );
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [phase, security, violations]);

  // Request Fullscreen helper
  const enterFullscreen = async () => {
    try {
      const el = containerRef.current || document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.debug('Fullscreen request denied or not supported in iframe', err);
    }
  };

  const startExamSession = async () => {
    if (enteredPin !== (currentExam.token_settings.access_pin || 'AMAN-2026')) {
      alert('PIN Token ujian tidak sesuai dengan konfigurasi pengajar!');
      return;
    }

    await enterFullscreen();
    setPhase('active');
    setViolations([]);
    setPenaltySeconds(0);

    broadcastMessage({
      type: 'STUDENT_JOIN',
      session: getSessionObject('active', [], 0),
    });
  };

  const handleManualProctorUnlock = () => {
    if (proctorPinInput === 'AMAN-2026' || proctorPinInput === (currentExam.token_settings.access_pin || 'AMAN-2026')) {
      setPhase('active');
      setPenaltySeconds(0);
      setViolations([]);
      setProctorPinInput('');
      setUnblockError('');
      enterFullscreen();

      broadcastMessage({
        type: 'PROCTOR_UNLOCK',
        studentId: sessionIdRef.current,
      });
    } else {
      setUnblockError('PIN Otorisasi Pengawas Salah!');
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col select-none"
    >
      {/* Simulation Watermark & Top Exit Button for Teachers */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="font-bold text-teal-400">SIMULATOR LINGKUNGAN SISWA</span>
          <span className="text-slate-400 hidden sm:inline">| Menguji respon keamanan peramban</span>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'active' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
              <span>Pelanggaran:</span>
              <span className={`font-bold ${violations.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {violations.length} / {security.max_allowed_violations}
              </span>
            </div>
          )}

          <button
            onClick={onExitPlayer}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Kembali ke Konfigurator
          </button>
        </div>
      </div>

      {/* PHASE 1: LOBBY & PRE-EXAM CHECKLIST */}
      {phase === 'lobby' && (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-xl w-full bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {currentExam.exam_name || 'Ujian Penilaian Sekolah'}
              </h1>
              <p className="text-xs text-slate-400">
                Target: {currentExam.target_class} | Durasi Token hingga: {currentExam.token_settings.expiration_datetime}
              </p>
            </div>

            {/* Student ID Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Nama Lengkap Peserta</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Nomor Induk Siswa (NIS)</label>
                <input
                  type="text"
                  value={studentNis}
                  onChange={(e) => setStudentNis(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-400">PIN Token Masuk Ujian</label>
                <input
                  type="text"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder="Masukkan PIN dari Pengawas"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono text-emerald-400 tracking-wider focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Mandatory Security Rules Agreement */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                <span>Protokol Keamanan Wajib Ujian:</span>
              </div>
              <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-300">
                <li>
                  <strong className="text-amber-200">Wajib Layar Penuh (Fullscreen):</strong> Dilarang keluar dari mode fullscreen.
                </li>
                <li>
                  <strong className="text-amber-200">Dilarang Pindah Tab:</strong> Membuka tab baru atau jendela lain akan langsung terdeteksi.
                </li>
                <li>
                  <strong className="text-amber-200">Dilarang Split Screen & Aplikasi Floating:</strong> Tidak boleh membuka aplikasi mengambang.
                </li>
                <li>
                  <strong className="text-amber-200">Sanksi Blokir Permanen:</strong> Melewati batas ({security.max_allowed_violations}x) akan memblokir ujian permanen!
                </li>
              </ul>
            </div>

            {/* Start Button */}
            <button
              id="start-exam-session-btn"
              onClick={startExamSession}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Maximize className="w-4 h-4" />
              <span>Masuk Mode Aman & Mulai Ujian</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: ACTIVE EXAM EMBED PLAYER */}
      {phase === 'active' && (
        <div className="flex-1 flex flex-col relative">
          {/* Active Security Bar */}
          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono">
                <ShieldCheck className="w-4 h-4" /> SECURE SANDBOX AKTIF
              </span>
              <span className="text-slate-400 hidden md:inline">
                Peserta: {studentName} ({studentNis})
              </span>
            </div>

            {/* Test Violation Triggers for Teachers */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden lg:inline">Tes Simulasi Pelanggaran:</span>
              <button
                onClick={() =>
                  triggerViolation(
                    'tab_switch',
                    'Uji Coba Pindah Tab',
                    'Simulasi manual tombol pindah tab browser oleh penguji'
                  )
                }
                className="px-2.5 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[11px] font-medium"
              >
                Picu Tab Switch
              </button>
              <button
                onClick={() =>
                  triggerViolation(
                    'split_screen',
                    'Uji Coba Split Screen',
                    'Simulasi manual pembagian layar atau floating apps'
                  )
                }
                className="px-2.5 py-1 rounded-md bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 text-[11px] font-medium"
              >
                Picu Split Screen
              </button>
            </div>
          </div>

          {/* Embedded Exam Area */}
          <div className="flex-1 bg-slate-900 relative flex flex-col">
            {useFallbackForm || !currentExam.form_source_url || currentExam.form_source_url.includes('example') ? (
              /* Fallback High-Fidelity Test Questionnaire if form URL is demo or blocked by frame security */
              <div className="max-w-3xl mx-auto w-full p-6 sm:p-10 space-y-6">
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                    Lembar Ujian Digital Terproteksi
                  </span>
                  <h2 className="text-xl font-bold text-white">{currentExam.exam_name}</h2>
                  <p className="text-xs text-slate-400">
                    Link Asli: <code className="text-emerald-300">{currentExam.form_source_url}</code>
                  </p>
                </div>

                {/* Sample Question 1 */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <p className="text-sm font-semibold text-white">
                    1. Dalam sistem pengawasan UjianAman.id, protokol apa yang mendeteksi jika siswa membagi layar perangkat seluler?
                  </p>
                  <div className="space-y-2 text-xs text-slate-300">
                    {['Anti-Tab Switching', 'Anti-Split Screen & Floating Apps', 'GPS Tracking', 'Biometric Scan'].map((opt, i) => (
                      <label key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-900 cursor-pointer border border-transparent hover:border-slate-800">
                        <input type="radio" name="q1" className="accent-emerald-500" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sample Question 2 */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <p className="text-sm font-semibold text-white">
                    2. Apa tindakan otomatis sistem jika siswa melewati batas pelanggaran ({security.max_allowed_violations}x)?
                  </p>
                  <div className="space-y-2 text-xs text-slate-300">
                    {[
                      'LOCK_PERMANENTLY (Blokir akses total hingga dibuka pengawas)',
                      'Diizinkan mengulang dari awal',
                      'Hanya diberi catatan kaki',
                      'Tidak terjadi apa-apa'
                    ].map((opt, i) => (
                      <label key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-900 cursor-pointer border border-transparent hover:border-slate-800">
                        <input type="radio" name="q2" className="accent-emerald-500" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setPhase('finished');
                      broadcastMessage({
                        type: 'STUDENT_HEARTBEAT',
                        session: getSessionObject('finished', violations, 0),
                      });
                    }}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30"
                  >
                    Kirim Jawaban Ujian
                  </button>
                </div>
              </div>
            ) : (
              /* Real Iframe */
              <div className="w-full h-full flex-1 relative">
                <iframe
                  src={currentExam.form_source_url}
                  className="w-full h-[calc(100vh-7.5rem)] border-0 bg-white"
                  title="Form Ujian"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                  onLoad={() => setIframeLoaded(true)}
                  onError={() => setUseFallbackForm(true)}
                />
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-xs text-slate-300 gap-2">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span>Memuat lembar ujian terproteksi...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHASE 3: PENALTY COOLDOWN OVERLAY */}
      {phase === 'warning_penalty' && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 animate-bounce">
              <AlertOctagon className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                PERINGATAN PELANGGARAN TERDETEKSI
              </span>
              <h2 className="text-xl font-black text-white">Layar Dibekukan Sementara</h2>
              <p className="text-xs text-slate-300">
                {violations[violations.length - 1]?.title || 'Siswa berpindah tab atau meminimalkan layar peramban!'}
              </p>
            </div>

            {/* Countdown Box */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400">Jeda Penalti Pelanggaran:</span>
              <div className="text-4xl font-mono font-extrabold text-amber-400 tracking-wider">
                00:{String(penaltySeconds).padStart(2, '0')}
              </div>
              <p className="text-[11px] text-slate-400">
                Toleransi tersisa: {Math.max(0, security.max_allowed_violations - violations.length)}x lagi sebelum akun diblokir permanen.
              </p>
            </div>

            {/* Resume button */}
            <button
              disabled={penaltySeconds > 0}
              onClick={() => {
                setPhase('active');
                enterFullscreen();
              }}
              className="w-full py-3.5 rounded-xl font-bold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30"
            >
              {penaltySeconds > 0 ? `Tunggu ${penaltySeconds} detik...` : 'Lanjutkan Ujian (Masuk Fullscreen)'}
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: BLOCKED PERMANENTLY OVERLAY */}
      {phase === 'blocked_permanent' && (
        <div className="absolute inset-0 z-50 bg-slate-950/98 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border-2 border-rose-600/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <Lock className="w-8 h-8" />
            </div>

            <div className="text-center space-y-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                ACTION: LOCK_PERMANENTLY
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Akses Ujian Telah Diblokir Permanen
              </h2>
              <p className="text-xs text-slate-300">
                Siswa telah melebihi batas pelanggaran keamanan yang ditentukan pengajar ({security.max_allowed_violations}x).
              </p>
            </div>

            {/* Audit Details */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Nama Peserta:</span>
                <span className="text-white font-sans font-medium">{studentName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>NIS:</span>
                <span className="text-white">{studentNis}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Waktu Pemblokiran:</span>
                <span className="text-rose-400">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Pelanggaran:</span>
                <span className="text-rose-400 font-bold">{violations.length} Kali</span>
              </div>
            </div>

            {/* Manual Proctor Unlock */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-300">
                  Hanya Pengawas yang dapat Membuka Blokir Ini
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Buka melalui <strong>Dashboard Pengawas</strong> atau masukkan PIN Otorisasi di bawah:
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={proctorPinInput}
                  onChange={(e) => setProctorPinInput(e.target.value)}
                  placeholder="PIN Pengawas (Default: AMAN-2026)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleManualProctorUnlock}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                >
                  Buka Blokir
                </button>
              </div>
              {unblockError && <p className="text-xs text-rose-400 text-center">{unblockError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 5: FINISHED */}
      {phase === 'finished' && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-3xl border border-slate-800 p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-bold text-white">Sesi Ujian Selesai</h2>
            <p className="text-xs text-slate-300">
              Jawaban dan catatan pengawasan siswa telah terekam secara aman di sistem pengawas.
            </p>
            <button
              onClick={() => setPhase('lobby')}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
            >
              Uji Coba Ulang Simulator
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
