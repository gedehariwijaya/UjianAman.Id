import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Volume2,
  Key,
  Fingerprint,
  LogOut,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  RefreshCw,
  Cloud
} from 'lucide-react';
import { ExamPayload, StudentSession, StudentViolationRecord, ProctorLog, EmergencyRecoveryToken, SavedExamItem } from '../types';
import { playWarningBeep, playBlockAlarm, playChimeAlert } from '../utils/audioAlerts';
import { 
  broadcastMessage, 
  subscribeToSyncMessages, 
  validateMasterPin, 
  validateAndRedeemRecoveryToken,
  getDynamicMasterPin,
  getSavedExamList,
  getSavedExamConfig
} from '../utils/proctorSync';
import {
  subscribeToCloudExams,
  subscribeToCloudActiveConfig,
  cloudSyncStudentSession,
  cloudLogViolation,
  cloudRedeemRecoveryToken,
  subscribeToCloudDynamicPin
} from '../utils/firebaseSync';

interface SecurePlayerProps {
  config: ExamPayload;
  onExitPlayer: () => void;
}

export const SecurePlayer: React.FC<SecurePlayerProps> = ({ config, onExitPlayer }) => {
  const [availableExams, setAvailableExams] = useState<SavedExamItem[]>(() => getSavedExamList());
  const [activeConfig, setActiveConfig] = useState<ExamPayload>(() => {
    const list = getSavedExamList();
    const match = list.find((e) => e.name === config.exam_config.exam_name);
    return match ? match.payload : (list[0]?.payload || config);
  });
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    const list = getSavedExamList();
    const match = list.find((e) => e.name === config.exam_config.exam_name);
    return match ? match.id : (list[0]?.id || 'default');
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Baru saja');

  const currentExam = activeConfig.exam_config;
  const security = currentExam.security_rules;

  // Student details in simulator
  const [studentName, setStudentName] = useState('Gede Hari Wijaya');
  const [studentClass, setStudentClass] = useState('XII MIPA 1');
  const [studentAbsen, setStudentAbsen] = useState('14');
  const [studentNis, setStudentNis] = useState('14');
  const [enteredPin, setEnteredPin] = useState(currentExam.token_settings.access_pin || 'AMAN-2026');

  // Unified sync function that always pulls the latest exam list & preserves / updates active selection
  const syncExams = useCallback((preferredExamId?: string, incomingConfig?: ExamPayload) => {
    const list = getSavedExamList();
    setAvailableExams(list);
    setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    setSelectedExamId((prevSelectedId) => {
      let targetId = preferredExamId || prevSelectedId;

      // If incomingConfig provided (from CONFIG_UPDATED or prop change), match by exam_name
      if (incomingConfig) {
        const matchByConfig = list.find((e) => e.name === incomingConfig.exam_config.exam_name);
        if (matchByConfig) {
          targetId = matchByConfig.id;
        }
      }

      const found = list.find((e) => e.id === targetId);
      if (found) {
        setActiveConfig(found.payload);
        setEnteredPin((prevPin) => {
          const freshPin = found.payload.exam_config.token_settings.access_pin || '';
          return freshPin;
        });
        return found.id;
      } else if (list.length > 0) {
        // Fallback to first available exam
        setActiveConfig(list[0].payload);
        setEnteredPin(list[0].payload.exam_config.token_settings.access_pin || '');
        return list[0].id;
      } else if (incomingConfig) {
        setActiveConfig(incomingConfig);
        setEnteredPin(incomingConfig.exam_config.token_settings.access_pin || '');
      }
      return targetId;
    });
  }, []);

  // Sync when prop config changes
  useEffect(() => {
    syncExams(undefined, config);
  }, [config, syncExams]);

  // Keep available exams and selected exam updated in real-time from Firestore Cloud
  useEffect(() => {
    syncExams();

    // 1. Listen to real-time updates from Firestore Database (works across phones and any network)
    const unsubCloudExams = subscribeToCloudExams((cloudList) => {
      setAvailableExams(cloudList);
      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSelectedExamId((prevSelectedId) => {
        const found = cloudList.find((e) => e.id === prevSelectedId);
        if (found) {
          setActiveConfig(found.payload);
          setEnteredPin(found.payload.exam_config.token_settings.access_pin || '');
          return found.id;
        } else if (cloudList.length > 0) {
          setActiveConfig(cloudList[0].payload);
          setEnteredPin(cloudList[0].payload.exam_config.token_settings.access_pin || '');
          return cloudList[0].id;
        }
        return prevSelectedId;
      });
    });

    const unsubCloudActive = subscribeToCloudActiveConfig((activePayload) => {
      setActiveConfig(activePayload);
      setEnteredPin(activePayload.exam_config.token_settings.access_pin || '');
      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    });

    const unsubCloudPin = subscribeToCloudDynamicPin(() => {
      // Keep master pin fresh
    });

    // 2. Broadcast and local fallback listeners
    const unsub = subscribeToSyncMessages((msg) => {
      if (msg.type === 'CONFIG_UPDATED') {
        syncExams(undefined, msg.config);
      } else if (msg.type === 'EXAM_LIST_UPDATED') {
        syncExams();
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ujianaman_saved_exams_list' || e.key === 'ujianaman_active_config') {
        syncExams();
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleFocus = () => {
      syncExams();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubCloudExams();
      unsubCloudActive();
      unsubCloudPin();
      unsub();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [syncExams]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    syncExams();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  };

  const handleExamSelect = (examId: string) => {
    setSelectedExamId(examId);
    const list = getSavedExamList();
    const found = list.find((e) => e.id === examId);
    if (found) {
      setActiveConfig(found.payload);
      setEnteredPin(found.payload.exam_config.token_settings.access_pin || '');
    }
  };

  // Keep studentNis synced with studentAbsen for token and network checks
  useEffect(() => {
    setStudentNis(studentAbsen);
  }, [studentAbsen]);

  // Exam phase: 'lobby' | 'active' | 'warning_penalty' | 'blocked_permanent' | 'finished'
  const [phase, setPhase] = useState<'lobby' | 'active' | 'warning_penalty' | 'blocked_permanent' | 'finished'>('lobby');

  const [violations, setViolations] = useState<StudentViolationRecord[]>([]);
  const [penaltySeconds, setPenaltySeconds] = useState(10);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [useFallbackForm, setUseFallbackForm] = useState(false);

  // Student answers mock state to demonstrate resume capability without loss of answers
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({
    q1: 'Anti-Split Screen & Floating Apps',
    q2: '',
  });

  // Emergency Unblock Modal State (PIN / Token Pemulihan)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyTab, setEmergencyTab] = useState<'dynamic_pin' | 'recovery_token'>('dynamic_pin');
  const [emergencyPinInput, setEmergencyPinInput] = useState('');
  const [emergencyTokenInput, setEmergencyTokenInput] = useState('');
  const [emergencyError, setEmergencyError] = useState('');
  const [emergencySuccess, setEmergencySuccess] = useState('');

  // Panic Combo / Force Exit Gesture State
  const [isHoldingPanic, setIsHoldingPanic] = useState(false);
  const [panicHoldSeconds, setPanicHoldSeconds] = useState(0); // 0 to 5 seconds
  const [showPanicExitModal, setShowPanicExitModal] = useState(false);
  const [panicExitPin, setPanicExitPin] = useState('');
  const [panicExitReason, setPanicExitReason] = useState('Kondisi Medis / Izin Khusus Pengawas');
  const [panicExitError, setPanicExitError] = useState('');

  // Student session ID
  const sessionIdRef = useRef('stu_' + Math.random().toString(36).substr(2, 9));
  const containerRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Create student session object
  const getSessionObject = (
    currentPhase = phase, 
    violationList = violations, 
    penaltyTime = penaltySeconds,
    statusOverride?: StudentSession['status']
  ): StudentSession => {
    let status: StudentSession['status'] = 'active';
    if (statusOverride) {
      status = statusOverride;
    } else if (currentPhase === 'blocked_permanent') {
      status = 'blocked';
    } else if (currentPhase === 'warning_penalty') {
      status = 'warning';
    } else if (currentPhase === 'finished') {
      status = 'submitted';
    }

    return {
      studentId: sessionIdRef.current,
      studentName,
      studentNis: studentAbsen,
      studentAbsen,
      studentClass,
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

  // Broadcast and sync student heartbeat to cloud
  useEffect(() => {
    if (phase === 'lobby') return;

    // Send initial or state-change session to cloud immediately
    const currentSession = getSessionObject();
    cloudSyncStudentSession(currentSession, true);

    // Concurrency-safe heartbeat interval (20s) to prevent quota exhaustion with 150+ students
    const interval = setInterval(() => {
      const sess = getSessionObject();
      broadcastMessage({
        type: 'STUDENT_HEARTBEAT',
        session: sess,
      });
      cloudSyncStudentSession(sess);
    }, 20000);

    return () => clearInterval(interval);
  }, [phase, violations.length, studentName, studentNis]);

  // Listen for remote unblock messages from proctor dashboard
  useEffect(() => {
    const unsub = subscribeToSyncMessages((msg) => {
      if (msg.type === 'PROCTOR_UNLOCK' && msg.studentId === sessionIdRef.current) {
        setPhase('active');
        setPenaltySeconds(0);
        setViolations([]);
        setShowEmergencyModal(false);
        setEmergencyError('');
        playChimeAlert();
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
    if (phase === 'lobby' || phase === 'blocked_permanent' || phase === 'finished' || showPanicExitModal) return;

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
        const blockedSession = getSessionObject('blocked_permanent', nextViolations, 0);
        broadcastMessage({
          type: 'STUDENT_VIOLATION',
          log,
          session: blockedSession,
        });
        cloudLogViolation(log, blockedSession);
        return;
      } else if (security.action_on_exceed === 'AUTO_SUBMIT') {
        setPhase('finished');
        const finishedSession = getSessionObject('finished', nextViolations, 0);
        broadcastMessage({
          type: 'STUDENT_VIOLATION',
          log,
          session: finishedSession,
        });
        cloudLogViolation(log, finishedSession);
        return;
      }
    }

    // Otherwise apply violation penalty cooldown
    playWarningBeep();
    setPenaltySeconds(security.violation_penalty_seconds || 10);
    setPhase('warning_penalty');

    const warningSession = getSessionObject('warning_penalty', nextViolations, security.violation_penalty_seconds || 10);
    broadcastMessage({
      type: 'STUDENT_VIOLATION',
      log,
      session: warningSession,
    });
    cloudLogViolation(log, warningSession);
  };

  // Real-world Browser Hooks: Fullscreen, Visibility, Window Blur, Window Resize (Split-Screen)
  useEffect(() => {
    if (phase === 'lobby' || phase === 'blocked_permanent' || phase === 'finished') return;

    // 1. Anti-Tab Switching via visibilitychange (Authoritative browser standard)
    const handleVisibilityChange = () => {
      if (document.hidden && security.block_tab_switch && !showPanicExitModal) {
        triggerViolation(
          'tab_switch',
          'Anti-Tab Switching Terpicu',
          'Siswa meninggalkan tab ujian, membuka tab baru, atau meminimalkan browser.'
        );
      }
    };

    // 2. Anti-Window Switching / Blur with intelligent debounce and iframe interaction detection
    let blurTimeout: NodeJS.Timeout | null = null;

    const handleWindowBlur = () => {
      if (blurTimeout) clearTimeout(blurTimeout);

      // Debounce window blur (750ms) to prevent false violations from fast scrolling, momentum flings, or iframe focus
      blurTimeout = setTimeout(() => {
        // A. If student tapped or scrolled inside the exam iframe (e.g. Google Form) -> NORMAL INTERACTION, NEVER A VIOLATION!
        if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
          return;
        }

        // B. If document is still visible on screen, this was a momentary scroll gesture, touch edge fling, or browser focus event
        if (document.visibilityState === 'visible' && !document.hidden) {
          return;
        }

        // C. Only trigger if tab switch detection is enabled, modal is closed, and page is genuinely hidden/switched
        if (document.hidden && security.block_tab_switch && !showPanicExitModal) {
          triggerViolation(
            'tab_switch',
            'Anti-Tab Switching Terpicu',
            'Siswa meninggalkan tab ujian, membuka tab baru, atau meminimalkan browser.'
          );
        }
      }, 750);
    };

    const handleWindowFocus = () => {
      // If window regained focus quickly (e.g. fast scrolling bounce or quick touch tap), cancel any pending blur penalty
      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }
    };

    // 3. Fullscreen Exit Detection with Debounce
    let fullscreenTimeout: NodeJS.Timeout | null = null;
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);

      if (fullscreenTimeout) clearTimeout(fullscreenTimeout);

      if (!isCurrentlyFullscreen && security.force_fullscreen && !showPanicExitModal) {
        fullscreenTimeout = setTimeout(() => {
          const stillNotFullscreen = !(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement
          );
          if (stillNotFullscreen && document.visibilityState === 'visible' && !showPanicExitModal) {
            triggerViolation(
              'fullscreen_exit',
              'Keluar dari Mode Layar Penuh',
              'Siswa keluar dari mode fullscreen yang diwajibkan oleh protokol ujian.'
            );
          }
        }, 800);
      }
    };

    // 4. Anti-Split Screen & Floating Window detection (Robust against mobile fast-scroll address bar collapse)
    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastKnownWidth = window.innerWidth;

    const handleWindowResize = () => {
      if (!security.block_floating_apps || showPanicExitModal) return;

      if (resizeTimeout) clearTimeout(resizeTimeout);

      // Debounce resize to prevent false positives when mobile address bar hides/shows during fast scrolling!
      resizeTimeout = setTimeout(() => {
        const currentWidth = window.innerWidth;
        const screenWidth = window.screen.availWidth || window.screen.width || currentWidth;

        // If width changed by less than 40px, it's purely vertical height variation (mobile address bar collapse on scroll or keyboard) -> IGNORE!
        if (Math.abs(currentWidth - lastKnownWidth) < 40) {
          lastKnownWidth = currentWidth;
          return;
        }
        lastKnownWidth = currentWidth;

        // Only trigger if screen is persistently split (width is under 65% of screen width)
        const currentRatio = currentWidth / screenWidth;
        if (currentRatio < 0.65) {
          triggerViolation(
            'split_screen',
            'Split Screen / Floating Apps Terdeteksi',
            'Lebar layar berkurang drastis di bawah 65% (indikasi pembagian layar atau jendela mengambang).'
          );
        }
      }, 1200);
    };

    // 5. Anti-Cheat Keyboard & Panic Combo Shortcut (Ctrl + Alt + Shift + Q)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Panic Exit Combo for Proctors on Keyboard: Ctrl + Alt + Shift + Q
      if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
        e.preventDefault();
        setShowPanicExitModal(true);
        return;
      }

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
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      if (fullscreenTimeout) clearTimeout(fullscreenTimeout);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [phase, security, violations, showPanicExitModal]);

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

  // ---------------------------------------------------------------------------
  // FEATURE 1: EMERGENCY ACCESS / TOKEN PEMULIHAN HANDLER
  // ---------------------------------------------------------------------------
  const handleVerifyEmergencyUnlock = async () => {
    setEmergencyError('');
    setEmergencySuccess('');

    if (emergencyTab === 'dynamic_pin') {
      // Validate with 6-digit dynamic master pin or static bypass
      const isValid = validateMasterPin(emergencyPinInput, currentExam.token_settings.access_pin);
      if (isValid) {
        setEmergencySuccess('PIN Pengawas Terverifikasi! Membuka kembali lembar ujian...');
        playChimeAlert();

        setTimeout(() => {
          setPhase('active');
          setPenaltySeconds(0);
          setViolations([]);
          setShowEmergencyModal(false);
          setEmergencyPinInput('');
          setEmergencySuccess('');
          enterFullscreen();

          broadcastMessage({
            type: 'PROCTOR_UNLOCK',
            studentId: sessionIdRef.current,
            method: 'dynamic_pin',
          });
        }, 1200);
      } else {
        setEmergencyError('6-Digit PIN Dinamis Pengawas salah atau sudah kadaluarsa! Periksa layar dashboard pengawas.');
      }
    } else {
      // Validate NIS-specific recovery token with Firestore Cloud & local fallback
      const result = await cloudRedeemRecoveryToken(emergencyTokenInput, studentNis);
      if (result.valid) {
        setEmergencySuccess('Token Pemulihan Valid! Sesi ujian Anda telah dipulihkan.');
        playChimeAlert();

        setTimeout(() => {
          setPhase('active');
          setPenaltySeconds(0);
          setViolations([]);
          setShowEmergencyModal(false);
          setEmergencyTokenInput('');
          setEmergencySuccess('');
          enterFullscreen();

          broadcastMessage({
            type: 'PROCTOR_UNLOCK',
            studentId: sessionIdRef.current,
            method: 'recovery_token',
          });
        }, 1200);
      } else {
        setEmergencyError(result.message);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // FEATURE 2: PANIC GESTURE & FORCE EXIT (3-FINGER 5S HOLD OR TOP CORNER HOLD)
  // ---------------------------------------------------------------------------
  const startPanicHold = useCallback(() => {
    if (showPanicExitModal) return;
    setIsHoldingPanic(true);
    setPanicHoldSeconds(0);

    let count = 0;
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);

    holdTimerRef.current = setInterval(() => {
      count += 0.5;
      setPanicHoldSeconds(count);

      if (count >= 5) {
        // Trigger verification modal
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        setIsHoldingPanic(false);
        setPanicHoldSeconds(0);
        setShowPanicExitModal(true);
        playChimeAlert();
      }
    }, 500);
  }, [showPanicExitModal]);

  const cancelPanicHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHoldingPanic(false);
    setPanicHoldSeconds(0);
  }, []);

  // Multi-touch 3-finger detection on window/container
  const handleTouchStart = (e: React.TouchEvent) => {
    // If 3 or more fingers touch in top 35% of the screen
    if (e.touches.length >= 3) {
      const touchesInTop = Array.from(e.touches).some((t) => t.clientY < window.innerHeight * 0.35);
      if (touchesInTop) {
        startPanicHold();
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 3) {
      cancelPanicHold();
    }
  };

  const handleTouchMove = () => {
    // If user is actively scrolling or moving fingers, cancel any panic hold so normal gestures never trigger violations
    cancelPanicHold();
  };

  // Safe Exit Verification Execution
  const handleConfirmPanicExit = () => {
    setPanicExitError('');
    const isValid = validateMasterPin(panicExitPin, currentExam.token_settings.access_pin);

    if (isValid) {
      // Broadcast safe exit telemetry to proctor
      broadcastMessage({
        type: 'SAFE_EXIT_TRIGGERED',
        studentName,
        studentNis,
        reason: panicExitReason,
      });

      // Exit fullscreen gracefully
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }

      setShowPanicExitModal(false);
      alert(`[OTORISASI PENGAWAS BERHASIL]\nSesi siswa ${studentName} (${studentNis}) telah ditutup secara aman tanpa membekukan perangkat.`);
      onExitPlayer();
    } else {
      setPanicExitError('PIN Pengawas salah! Masukkan 6-digit PIN dinamis atau PIN Ujian pengajar.');
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={cancelPanicHold}
      className="relative min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col select-none"
    >
      {/* Simulation Top Bar & Hidden/Tactile Panic Hotspot */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs relative">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="font-bold text-teal-400">SECURE PLAYER SANDBOX</span>
          <span className="text-slate-400 hidden sm:inline">| Perlindungan Kiosk & Protokol Anti-Curang</span>
        </div>

        {/* Panic Corner Hotspot & Status */}
        <div className="flex items-center gap-2">
          {phase === 'active' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                <span>Pelanggaran:</span>
                <span className={`font-bold ${violations.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {violations.length} / {security.max_allowed_violations}
                </span>
              </div>
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

      {/* Floating Panic Hold Ring / Progress Indicator */}
      {isHoldingPanic && (
        <div className="fixed top-14 right-6 z-[100] bg-slate-900/95 border-2 border-rose-500 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 animate-in fade-in zoom-in-95">
          <div className="relative w-12 h-12 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-12 h-12 -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-slate-700"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                className="stroke-rose-500 transition-all duration-300"
                strokeWidth="4"
                strokeDasharray="113"
                strokeDashoffset={113 - (113 * (panicHoldSeconds / 5))}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="absolute text-xs font-mono font-bold text-rose-400">
              {Math.max(0, 5 - Math.floor(panicHoldSeconds))}s
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
              <AlertOctagon className="w-4 h-4 animate-spin" />
              <span>Gestur Darurat Terdeteksi (3 Jari / Panic Hold)</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Tahan hingga {5 - Math.floor(panicHoldSeconds)} detik untuk memicu Dialog Verifikasi Pengawas...
            </p>
          </div>
        </div>
      )}

      {/* PHASE 1: LOBBY & PRE-EXAM CHECKLIST */}
      {phase === 'lobby' && (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-xl w-full bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                ASESMEN SISWA
              </h1>
            </div>

            {/* Student ID Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              {/* Dropdown Pilihan Mata Pelajaran / Asesmen */}
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pilih Mata Pelajaran / Ujian yang Diikuti:</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/80 font-mono">
                      <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {availableExams.length} Mata Pelajaran Cloud
                    </span>

                    <button
                      type="button"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      title="Segarkan daftar ujian dan data terkini dari Firebase Cloud"
                      className="flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                      <span>{isRefreshing ? 'Menyinkron...' : 'Segarkan'}</span>
                    </button>
                  </div>
                </div>

                <select
                  id="select-exam-dropdown"
                  value={selectedExamId}
                  onChange={(e) => handleExamSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:border-emerald-500 outline-none cursor-pointer shadow-sm transition"
                >
                  {availableExams.length === 0 ? (
                    <option value="">-- Belum ada ujian terbit --</option>
                  ) : (
                    availableExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name} — ({exam.targetClass})
                      </option>
                    ))
                  )}
                </select>

                {/* Detail Mata Pelajaran Terpilih (Selalu Terupdate) */}
                {currentExam && (
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs space-y-2 mt-1.5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{currentExam.exam_name || 'Ujian Tanpa Judul'}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                        Target: {currentExam.target_class || 'Semua Kelas'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1.5 border-t border-slate-800">
                      <span className="flex items-center gap-1">
                        <span className="text-slate-300">Sumber Soal:</span>{' '}
                        <strong className="text-slate-200">
                          {currentExam.form_source_url ? (currentExam.form_source_url.includes('google.com') ? 'Google Forms Terhubung' : 'Form / LMS Terhubung') : 'Simulasi Internal'}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-slate-300">Protokol:</span>{' '}
                        <span className="text-emerald-400 font-medium">
                          {security.force_fullscreen ? 'Layar Penuh' : ''} • {security.block_tab_switch ? 'Anti-Pindah Tab' : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 sm:ml-auto text-[10px] text-slate-400">
                        Sinkronisasi: {lastSyncTime}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Daftar mata pelajaran dan aturan ujian di atas otomatis diperbarui setiap ada perubahan dari guru pengawas.
                </p>
              </div>

              {/* Form Nama Lengkap */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-400">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Contoh: Gede Hari Wijaya"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Form Kelas */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Kelas</label>
                <input
                  type="text"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder="Contoh: XII MIPA 1"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Form Nomor Absen */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Nomor Absen</label>
                <input
                  type="text"
                  value={studentAbsen}
                  onChange={(e) => setStudentAbsen(e.target.value)}
                  placeholder="Contoh: 14"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              {/* PIN Token Masuk */}
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

            {/* Mandatory Security Rules & Emergency Protocol info */}
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
                  <strong className="text-amber-200">Dilarang Split Screen & Floating Apps:</strong> Tidak boleh membuka aplikasi mengambang.
                </li>
                <li>
                  <strong className="text-amber-200">Akses Pemulihan & Token Darurat:</strong> Jika layar terkunci, pengawas kelas dapat memasukkan 6-Digit PIN Dinamis atau Token Pemulihan Spesifik NIS Anda tanpa kehilangan jawaban.
                </li>
                <li>
                  <strong className="text-amber-200">Panic Exit Pengawas:</strong> Tekan & tahan 3 jari selama 5 detik di pojok atas layar untuk keluar aman tanpa membekukan perangkat.
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
                Peserta: {studentName} ({studentClass} - No. Absen: {studentAbsen})
              </span>
            </div>

            {/* Student Exam Status: Clean, focused, no test violation buttons or panic buttons */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 border border-emerald-800/80 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Terkoneksi Aman</span>
              </span>
            </div>
          </div>

          {/* Embedded Exam Area */}
          <div className="flex-1 bg-slate-900 relative flex flex-col">
            {useFallbackForm || !currentExam.form_source_url || currentExam.form_source_url.includes('example') ? (
              /* Fallback High-Fidelity Test Questionnaire if form URL is demo or blocked by frame security */
              <div className="max-w-3xl mx-auto w-full p-6 sm:p-10 space-y-6">
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                      Lembar Ujian Digital Terproteksi
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Jawaban Tersimpan Otomatis
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{currentExam.exam_name}</h2>
                  <p className="text-xs text-slate-400">
                    Sumber Soal: <code className="text-emerald-300">{currentExam.form_source_url}</code>
                  </p>
                </div>

                {/* Sample Question 1 */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <p className="text-sm font-semibold text-white">
                    1. Dalam sistem pengawasan UjianAman.id, protokol apa yang mendeteksi jika siswa membagi layar perangkat seluler?
                  </p>
                  <div className="space-y-2 text-xs text-slate-300">
                    {['Anti-Tab Switching', 'Anti-Split Screen & Floating Apps', 'GPS Tracking', 'Biometric Scan'].map((opt, i) => (
                      <label 
                        key={i} 
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition ${
                          savedAnswers.q1 === opt 
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
                            : 'hover:bg-slate-900 border-transparent hover:border-slate-800'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="q1" 
                          checked={savedAnswers.q1 === opt}
                          onChange={() => setSavedAnswers(prev => ({ ...prev, q1: opt }))}
                          className="accent-emerald-500" 
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sample Question 2 */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <p className="text-sm font-semibold text-white">
                    2. Apa tindakan sistem jika siswa menghadapi kendala darurat atau terkunci permanen?
                  </p>
                  <div className="space-y-2 text-xs text-slate-300">
                    {[
                      'Pengawas dapat memasukkan 6-Digit PIN Dinamis atau Token Pemulihan Spesifik NIS untuk resume ujian',
                      'Siswa harus mengulang ujian dari nomor 1 dan kehilangan jawaban',
                      'Perangkat siswa akan dibekukan total tanpa jalan keluar',
                      'Tidak ada mekanisme pembukaan akses darurat'
                    ].map((opt, i) => (
                      <label 
                        key={i} 
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition ${
                          savedAnswers.q2 === opt 
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
                            : 'hover:bg-slate-900 border-transparent hover:border-slate-800'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="q2" 
                          checked={savedAnswers.q2 === opt}
                          onChange={() => setSavedAnswers(prev => ({ ...prev, q2: opt }))}
                          className="accent-emerald-500" 
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <div className="text-[11px] text-slate-400">
                    💡 Tips: Jika terjadi kendala darurat, pengawas dapat menggunakan <strong className="text-slate-200">Tekan 3 Jari 5 Detik</strong> di pojok layar.
                  </div>
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

            {/* Buttons: Resume countdown OR Buka Akses Darurat */}
            <div className="space-y-2.5">
              <button
                disabled={penaltySeconds > 0}
                onClick={() => {
                  setPhase('active');
                  enterFullscreen();
                }}
                className="w-full py-3 rounded-xl font-bold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30"
              >
                {penaltySeconds > 0 ? `Tunggu ${penaltySeconds} detik...` : 'Lanjutkan Ujian (Masuk Fullscreen)'}
              </button>

              <button
                onClick={() => setShowEmergencyModal(true)}
                className="w-full py-2.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Buka Akses Darurat (PIN Pengawas / Token Pemulihan)</span>
              </button>
            </div>
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
                STATUS: DIBLOKIR PERMANEN
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Akses Ujian Telah Dikunci Sistem
              </h2>
              <p className="text-xs text-slate-300">
                Siswa telah melebihi batas pelanggaran keamanan yang diizinkan ({security.max_allowed_violations}x).
              </p>
            </div>

            {/* Audit Details */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Nama Peserta:</span>
                <span className="text-white font-sans font-medium">{studentName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Kelas:</span>
                <span className="text-white font-bold">{studentClass}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Nomor Absen:</span>
                <span className="text-white font-bold">{studentAbsen}</span>
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

            {/* Action: Open Emergency Access Modal Button */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-300">
                  Akses Hanya Dapat Dipulihkan oleh Pengawas Kelas
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pengawas dapat membuka blokir langsung dari Dashboard atau memasukkan PIN Darurat / Token Pemulihan Khusus NIS di bawah:
                </p>
              </div>

              <button
                id="emergency-unblock-btn"
                onClick={() => setShowEmergencyModal(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                <span>Buka Akses Darurat (Emergency Unblock Token)</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
                <Fingerprint className="w-3.5 h-3.5 text-rose-400" />
                <span>Panic Exit Pengawas: Tekan & tahan 3 jari selama 5 detik di pojok atas</span>
              </div>
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

      {/* =================================================================== */}
      {/* MODAL 1: MODE DARURAT & AKSES TOKEN PEMULIHAN (EMERGENCY UNBLOCK)   */}
      {/* =================================================================== */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Mode Darurat & Akses Token Pemulihan
                  </h3>
                  <p className="text-xs text-slate-400">
                    Otorisasi Pengawas untuk membuka kunci dan melanjutkan ujian
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Target Student Identity Verification */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-400">Siswa:</span>{' '}
                <strong className="text-white">{studentName}</strong>{' '}
                <span className="text-slate-400 font-mono">({studentClass})</span>
              </div>
              <div>
                <span className="text-slate-400">No. Absen:</span>{' '}
                <strong className="text-emerald-400 font-mono">{studentAbsen}</strong>
              </div>
            </div>

            {/* Switch Tabs: Dynamic Master PIN vs Specific Student Recovery Token */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => {
                  setEmergencyTab('dynamic_pin');
                  setEmergencyError('');
                  setEmergencySuccess('');
                }}
                className={`py-2 rounded-lg transition ${
                  emergencyTab === 'dynamic_pin'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                6-Digit PIN Dinamis
              </button>
              <button
                onClick={() => {
                  setEmergencyTab('recovery_token');
                  setEmergencyError('');
                  setEmergencySuccess('');
                }}
                className={`py-2 rounded-lg transition ${
                  emergencyTab === 'recovery_token'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Token Pemulihan Absen
              </button>
            </div>

            {/* Content for Tab 1: Dynamic Master PIN */}
            {emergencyTab === 'dynamic_pin' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Master PIN Dinamis Pengawas</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Pengawas kelas memasukkan 6 digit PIN dinamis yang saat ini aktif di <strong>Dashboard Pengawas</strong> (diperbarui berkala secara aman).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Masukkan 6-Digit PIN Dinamis Pengawas:
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={emergencyPinInput}
                    onChange={(e) => setEmergencyPinInput(e.target.value)}
                    placeholder="Contoh: 739201"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xl font-bold tracking-widest text-emerald-400 outline-none focus:border-emerald-500 placeholder:text-slate-700"
                  />
                  <p className="text-[11px] text-slate-500">
                    *Tersedia juga PIN darurat statis: <code className="text-slate-400 font-mono">AMAN-2026</code>
                  </p>
                </div>
              </div>
            )}

            {/* Content for Tab 2: NIS-Specific Recovery Token */}
            {emergencyTab === 'recovery_token' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Key className="w-4 h-4" />
                    <span>Token Pemulihan Khusus Siswa (Absen-Bound)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Token ini diterbitkan khusus oleh pengawas untuk Nomor Absen <strong>{studentAbsen}</strong> ({studentClass}). Siswa dapat <strong>resume ujian dari titik terakhir tanpa kehilangan lembar jawaban</strong>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Masukkan Kode Token Pemulihan:
                  </label>
                  <input
                    type="text"
                    value={emergencyTokenInput}
                    onChange={(e) => setEmergencyTokenInput(e.target.value.toUpperCase())}
                    placeholder="Contoh: REC-1048-A9F2"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-lg font-bold tracking-wider text-indigo-400 outline-none focus:border-indigo-500 placeholder:text-slate-700 uppercase"
                  />
                  <p className="text-[11px] text-slate-500">
                    *Minta pengawas untuk mengklik tombol <strong>"Token Pemulihan"</strong> pada nama Anda di dashboard pengawas.
                  </p>
                </div>
              </div>
            )}

            {/* Error or Success feedback */}
            {emergencyError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{emergencyError}</span>
              </div>
            )}
            {emergencySuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{emergencySuccess}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                onClick={handleVerifyEmergencyUnlock}
                className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Verifikasi & Resume Ujian</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: PANIC EXIT VERIFICATION PROTOCOL (SAFE FORCE EXIT DIALOG)  */}
      {/* =================================================================== */}
      {showPanicExitModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-600/70 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Protokol Keluar Darurat (Panic Exit)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mekanisme force exit aman berbasis verifikasi pengawas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPanicExitModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" />
                <span>Kombinasi Gestur Darurat Terverifikasi</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Karena tombol Home / Back diblokir di browser aman, kombinasi <strong>tahan 3 jari selama 5 detik</strong> digunakan untuk keluar secara aman tanpa membekukan perangkat siswa.
              </p>
            </div>

            {/* Reason selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Alasan Keluar Darurat:</label>
              <select
                value={panicExitReason}
                onChange={(e) => setPanicExitReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-rose-500"
              >
                <option value="Kondisi Medis / Izin Khusus Siswa">Kondisi Medis / Izin Khusus Siswa</option>
                <option value="Kendala Teknis Perangkat / Baterai Drop">Kendala Teknis Perangkat / Baterai Drop</option>
                <option value="Pindah ke Perangkat Komputer Cadangan">Pindah ke Perangkat Komputer Cadangan</option>
                <option value="Sesi Telah Selesai & Disetujui Pengawas">Sesi Telah Selesai & Disetujui Pengawas</option>
              </select>
            </div>

            {/* Proctor Master PIN for authorization */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Otorisasi PIN Pengawas (6-Digit Dinamis / Master PIN):
              </label>
              <input
                type="password"
                value={panicExitPin}
                onChange={(e) => setPanicExitPin(e.target.value)}
                placeholder="Masukkan PIN Pengawas (Contoh: AMAN-2026)"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-rose-400 tracking-wider outline-none focus:border-rose-500"
              />
            </div>

            {panicExitError && (
              <p className="text-xs text-rose-400 font-medium">{panicExitError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPanicExitModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Batal / Lanjutkan Ujian
              </button>
              <button
                onClick={handleConfirmPanicExit}
                className="flex-[1.5] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Otorisasi & Keluar Aman</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
