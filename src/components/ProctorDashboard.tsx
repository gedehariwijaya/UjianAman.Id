import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Radio, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Volume2, 
  VolumeX, 
  Download, 
  Bell, 
  UserX, 
  RefreshCw, 
  Clock, 
  Smartphone, 
  Monitor, 
  Search, 
  Send,
  Printer,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { ProctorLog, StudentSession, ExamPayload } from '../types';
import { playChimeAlert } from '../utils/audioAlerts';
import { 
  getSavedLogs, 
  getSavedSessions, 
  saveLogs, 
  saveSessions, 
  subscribeToSyncMessages, 
  broadcastMessage 
} from '../utils/proctorSync';

interface ProctorDashboardProps {
  config: ExamPayload;
  onOpenPlayer: () => void;
}

export const ProctorDashboard: React.FC<ProctorDashboardProps> = ({ config, onOpenPlayer }) => {
  const [sessions, setSessions] = useState<StudentSession[]>(() => getSavedSessions());
  const [logs, setLogs] = useState<ProctorLog[]>(() => getSavedLogs());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'warning' | 'blocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentSession | null>(null);
  const [broadcastAlertText, setBroadcastAlertText] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Sync with incoming real-time events
  useEffect(() => {
    const unsub = subscribeToSyncMessages((msg) => {
      if (msg.type === 'STUDENT_JOIN' || msg.type === 'STUDENT_HEARTBEAT') {
        setSessions((prev) => {
          const index = prev.findIndex((s) => s.studentId === msg.session.studentId);
          let next: StudentSession[];
          if (index >= 0) {
            next = [...prev];
            next[index] = msg.session;
          } else {
            next = [msg.session, ...prev];
          }
          saveSessions(next);
          return next;
        });
      } else if (msg.type === 'STUDENT_VIOLATION') {
        if (soundEnabled) {
          playChimeAlert();
        }

        // Add to logs
        setLogs((prev) => {
          const next = [msg.log, ...prev].slice(0, 100);
          saveLogs(next);
          return next;
        });

        // Update session
        setSessions((prev) => {
          const index = prev.findIndex((s) => s.studentId === msg.session.studentId);
          let next: StudentSession[];
          if (index >= 0) {
            next = [...prev];
            next[index] = msg.session;
          } else {
            next = [msg.session, ...prev];
          }
          saveSessions(next);
          return next;
        });
      } else if (msg.type === 'PROCTOR_UNLOCK') {
        setSessions((prev) => {
          const next = prev.map((s) =>
            s.studentId === msg.studentId
              ? { ...s, status: 'active' as const, violationsCount: 0, penaltySecondsLeft: 0 }
              : s
          );
          saveSessions(next);
          return next;
        });
      }
    });

    return () => unsub();
  }, [soundEnabled]);

  // Unlock student remotely
  const handleRemoteUnlock = (studentId: string, studentName: string) => {
    broadcastMessage({
      type: 'PROCTOR_UNLOCK',
      studentId,
    });

    const unlockLog: ProctorLog = {
      id: 'unlock_' + Date.now(),
      timestamp: Date.now(),
      studentName,
      studentNis: '',
      type: 'manual_unlock',
      details: 'Pengawas membuka blokir dan mereset token ujian peserta.',
      severity: 'info',
    };

    setLogs((prev) => {
      const next = [unlockLog, ...prev];
      saveLogs(next);
      return next;
    });

    setSessions((prev) => {
      const next = prev.map((s) =>
        s.studentId === studentId
          ? { ...s, status: 'active' as const, violationsCount: 0, penaltySecondsLeft: 0 }
          : s
      );
      saveSessions(next);
      return next;
    });
  };

  // Send global alert to students
  const handleSendGlobalAlert = () => {
    if (!broadcastAlertText.trim()) return;
    broadcastMessage({
      type: 'PROCTOR_GLOBAL_ALERT',
      message: broadcastAlertText.trim(),
    });
    setBroadcastAlertText('');
    setShowBroadcastModal(false);
    alert('Peringatan telah dikirimkan ke layar semua peserta ujian!');
  };

  // Seed sample classroom simulation
  const handleSeedSimulationClass = () => {
    const names = [
      'Budi Santoso', 'Siti Rahmawati', 'Dimas Setiawan', 'Anisa Maharani',
      'Muhammad Rizky', 'Fajar Ramadhan', 'Putri Ayu Wandira', 'Kevin Pratama',
      'Dewi Lestari', 'Ahmad Fauzi', 'Tiara Andini', 'Gede Wijaya'
    ];

    const seeded: StudentSession[] = names.map((name, i) => {
      const isBlocked = i === 2; // 1 blocked student
      const isWarning = i === 6; // 1 student in penalty
      const violationsCount = isBlocked ? 2 : isWarning ? 1 : 0;

      return {
        studentId: 'sim_stu_' + (1000 + i),
        studentName: name,
        studentNis: `2026110${10 + i}`,
        examId: config.exam_config.exam_name,
        status: isBlocked ? 'blocked' : isWarning ? 'warning' : 'active',
        device: i % 3 === 0 ? 'Samsung Galaxy Tab (Android)' : 'Laptop Windows 11',
        os: i % 3 === 0 ? 'Android 14' : 'Windows 11 x64',
        browser: 'UjianAman Secure Sandbox',
        violationsCount,
        maxViolations: config.exam_config.security_rules.max_allowed_violations,
        penaltySecondsLeft: isWarning ? 7 : 0,
        lastHeartbeat: Date.now(),
        joinedAt: Date.now() - (i * 120000),
        recentViolations: violationsCount > 0 ? [
          {
            id: 'v_seed_' + i,
            type: 'tab_switch',
            title: 'Berpindah Tab / Alt+Tab',
            description: 'Siswa terdeteksi meminimalkan jendela ujian.',
            timestamp: Date.now() - 30000,
          }
        ] : [],
      };
    });

    setSessions(seeded);
    saveSessions(seeded);

    const initialLogs: ProctorLog[] = [
      {
        id: 'log_seed_1',
        timestamp: Date.now() - 60000,
        studentName: 'Dimas Setiawan',
        studentNis: '202611012',
        type: 'tab_switch',
        details: 'Pelanggaran ke-2: Siswa membuka jendela baru. Sistem menerapkan sanksi LOCK_PERMANENTLY.',
        severity: 'danger',
      },
      {
        id: 'log_seed_2',
        timestamp: Date.now() - 120000,
        studentName: 'Putri Ayu Wandira',
        studentNis: '202611016',
        type: 'fullscreen_exit',
        details: 'Keluar dari mode layar penuh. Penalti 10 detik diaktifkan.',
        severity: 'warning',
      },
    ];

    setLogs(initialLogs);
    saveLogs(initialLogs);
  };

  // Reset all
  const handleClearSessions = () => {
    if (confirm('Bersihkan seluruh daftar sesi dan catatan pengawas?')) {
      setSessions([]);
      setLogs([]);
      saveSessions([]);
      saveLogs([]);
    }
  };

  // Print audit report
  const handlePrintAuditReport = () => {
    window.print();
  };

  // Metrics
  const totalCount = sessions.length;
  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const warningCount = sessions.filter((s) => s.status === 'warning').length;
  const blockedCount = sessions.filter((s) => s.status === 'blocked').length;

  const filteredSessions = sessions.filter((s) => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.studentName.toLowerCase().includes(q) ||
        s.studentNis.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
              PUSAT PENGAWASAN REAL-TIME
            </span>
            <span className="text-xs text-slate-400">Proctoring Telemetry Feed</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Dashboard Pemantauan Pengawas Ujian
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Ujian: <strong className="text-white">{config.exam_config.exam_name}</strong> | Target: {config.exam_config.target_class}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sound alert toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition flex items-center gap-2 text-xs font-semibold ${
              soundEnabled
                ? 'bg-slate-800 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
            title={soundEnabled ? 'Alarm Suara Aktif' : 'Alarm Suara Mati'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Alarm Aktif' : 'Alarm Bisu'}</span>
          </button>

          <button
            onClick={() => setShowBroadcastModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Kirim Pesan Global</span>
          </button>

          <button
            onClick={handleSeedSimulationClass}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Simulasi 12 Siswa</span>
          </button>

          <button
            onClick={handlePrintAuditReport}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Cetak Berita Acara</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Siswa Terkoneksi</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-2">{totalCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Peserta ujian terdaftar</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-emerald-400 text-xs">
            <span>Fokus & Aman</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">{activeCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Layar penuh terkunci normal</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-amber-400 text-xs">
            <span>Masa Penalti (10s)</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2">{warningCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Pernah terdeteksi melanggar</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-rose-900/40 shadow-md">
          <div className="flex items-center justify-between text-rose-400 text-xs">
            <span>Diblokir Permanen</span>
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-400 mt-2">{blockedCount}</div>
          <p className="text-[11px] text-rose-400/70 mt-1">Melebihi batas pelanggaran</p>
        </div>
      </div>

      {/* Main Grid: Student Roster & Live Logs Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Student Roster Grid */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau NIS siswa..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua ({totalCount})
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterStatus === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fokus ({activeCount})
              </button>
              <button
                onClick={() => setFilterStatus('blocked')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterStatus === 'blocked' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Terkunci ({blockedCount})
              </button>
            </div>
          </div>

          {/* Student Cards Grid */}
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800/80 space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">Belum Ada Siswa yang Terkoneksi</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Buka tab <strong>Simulator Siswa</strong> untuk menguji satu sesi langsung, atau klik tombol <strong>"Simulasi 12 Siswa"</strong> di atas.
              </p>
              <button
                onClick={onOpenPlayer}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold mt-2"
              >
                Buka Simulator Siswa
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSessions.map((student) => {
                const isBlocked = student.status === 'blocked';
                const isWarning = student.status === 'warning';

                return (
                  <div
                    key={student.studentId}
                    className={`p-4 rounded-2xl border transition-all space-y-3 bg-slate-900/90 ${
                      isBlocked
                        ? 'border-rose-600/80 shadow-lg shadow-rose-950/20'
                        : isWarning
                        ? 'border-amber-500/60 shadow-lg shadow-amber-950/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white leading-tight">
                          {student.studentName}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          NIS: {student.studentNis}
                        </p>
                      </div>

                      {/* Badge */}
                      {isBlocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-mono">
                          <Lock className="w-3 h-3" /> TERBLOKIR
                        </span>
                      ) : isWarning ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 animate-spin" /> PENALTI 10S
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3 h-3" /> AMAN & FOKUS
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] space-y-1 text-slate-400">
                      <div className="flex justify-between">
                        <span>Perangkat:</span>
                        <span className="text-slate-200">{student.device}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pelanggaran:</span>
                        <span className={`font-mono font-bold ${student.violationsCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {student.violationsCount} / {student.maxViolations} kali
                        </span>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center justify-between pt-1 gap-2">
                      {isBlocked ? (
                        <button
                          onClick={() => handleRemoteUnlock(student.studentId, student.studentName)}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Buka Blokir & Beri Toleransi</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                          >
                            Riwayat Log
                          </button>
                          <button
                            onClick={() => {
                              broadcastMessage({
                                type: 'PROCTOR_GLOBAL_ALERT',
                                message: `Peringatan khusus untuk ${student.studentName}: Harap tetap fokus pada layar ujian Anda!`,
                              });
                              alert(`Peringatan telah dikirim ke layar ${student.studentName}`);
                            }}
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium transition"
                          >
                            Peringatkan
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Real-Time Activity Feed & Telemetry */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Live Audit Feed
                </h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">AKTIF</span>
            </div>

            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Belum ada log pelanggaran terdeteksi. Sesi ujian berlangsung tertib.
                </div>
              ) : (
                logs.map((log) => {
                  const isDanger = log.severity === 'danger';
                  const isWarning = log.severity === 'warning';

                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        isDanger
                          ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                          : isWarning
                          ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-white">{log.studentName}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">{log.details}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">{logs.length} catatan aktivitas</span>
              <button
                onClick={handleClearSessions}
                className="text-rose-400 hover:text-rose-300 text-[11px] underline"
              >
                Bersihkan Log
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Kirim Notifikasi / Peringatan Global</h3>
            <p className="text-xs text-slate-400">
              Pesan ini akan langsung muncul sebagai pop-up notifikasi darurat pada layar seluruh siswa yang sedang aktif.
            </p>
            <textarea
              rows={4}
              value={broadcastAlertText}
              onChange={(e) => setBroadcastAlertText(e.target.value)}
              placeholder="Contoh: Waktu ujian tersisa 15 menit lagi. Tetap berada di layar penuh!"
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleSendGlobalAlert}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Kirim Peringatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Details Dialog */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{selectedStudent.studentName}</h3>
                <p className="text-xs text-slate-400 font-mono">NIS: {selectedStudent.studentNis}</p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
              <div>Perangkat: <strong>{selectedStudent.device}</strong></div>
              <div>Sistem Operasi: <strong>{selectedStudent.os}</strong></div>
              <div>Status Saat Ini: <strong className="uppercase font-mono">{selectedStudent.status}</strong></div>
              <div>Total Pelanggaran: <strong className="text-amber-400 font-mono">{selectedStudent.violationsCount} Kali</strong></div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Riwayat Pelanggaran:</span>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {selectedStudent.recentViolations.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Tidak ada catatan pelanggaran.</p>
                ) : (
                  selectedStudent.recentViolations.map((v) => (
                    <div key={v.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      <div className="font-semibold text-white">{v.title}</div>
                      <div className="text-slate-400 text-[11px]">{v.description}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300"
              >
                Tutup
              </button>
              {selectedStudent.status === 'blocked' && (
                <button
                  onClick={() => {
                    handleRemoteUnlock(selectedStudent.studentId, selectedStudent.studentName);
                    setSelectedStudent(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Buka Blokir Siswa Ini
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
