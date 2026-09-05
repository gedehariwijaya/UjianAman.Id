import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory store for active exam sessions and real-time proctor monitoring
interface StudentSession {
  studentId: string;
  studentName: string;
  studentNis: string;
  examId: string;
  status: 'active' | 'warning' | 'blocked' | 'submitted';
  device: string;
  os: string;
  browser: string;
  violationsCount: number;
  maxViolations: number;
  penaltySecondsLeft: number;
  lastHeartbeat: number;
  joinedAt: number;
  recentViolations: Array<{
    id: string;
    type: 'tab_switch' | 'fullscreen_exit' | 'split_screen' | 'blur' | 'devtools_or_key';
    description: string;
    timestamp: number;
  }>;
}

const activeSessions = new Map<string, StudentSession>();
const proctorAuditLogs: Array<{
  id: string;
  timestamp: number;
  studentName: string;
  type: string;
  details: string;
  severity: 'info' | 'warning' | 'danger';
}> = [];

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!apiKey });
});

// API: AI Assistant chat & config generator
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message, history, currentConfig } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Pesan pengguna tidak boleh kosong.' });
    }

    const systemInstruction = `Kamu adalah asisten AI spesialis sistem keamanan dan pengawasan ujian online bernama "UjianAman.id". Tugas utama kamu adalah membantu pengajar/administrator dalam merancang, mengonfigurasi, dan mengelola parameter keamanan ujian berbasis web (Secure Exam Player) untuk mencegah kecurangan siswa.

TUGAS UTAMA:
1. Integrasi Link Ujian: Menerima link ujian (seperti Google Forms, Jotform, atau platform lain) dan membungkusnya dalam sistem pengawasan.
2. Konfigurasi Keamanan: Mengatur aturan penguncian layar, batas pelanggaran, durasi token, dan sanksi otomatis bagi siswa yang melanggar.
3. Generator Payload Sistem: Menghasilkan struktur data/JSON konfigurasi keamanan yang siap diproses oleh aplikasi frontend/backend pengunci browser.

ATURAN KEAMANAN WAJIB (System Security Rules):
Setiap konfigurasi ujian yang diolah harus menerapkan protokol keamanan berikut:
- Lock Fullscreen: Mewajibkan siswa masuk ke mode layar penuh secara otomatis.
- Anti-Tab Switching: Mendeteksi saat siswa berpindah tab, membuka jendela baru, atau meminimalkan browser.
- Anti-Split Screen & Floating Apps: Mendeteksi penggunaan aplikasi mengambang atau pembagian layar di perangkat seluler (Android/iOS).
- Auto-Block Enforcement: Memblokir akses ujian secara permanen jika batas pelanggaran terlampaui.

FORMAT OUTPUT KONFIGURASI KEAMANAN (JSON):
Setiap kali pengajar memasukkan tautan ujian dan aturan yang diinginkan, sertakan blok JSON valid berikut di akhir jawabanmu:
\`\`\`json
{
  "exam_config": {
    "exam_name": "[Nama Ujian/Mata Pelajaran]",
    "target_class": "[Kelas/Grup]",
    "form_source_url": "[URL Google Forms atau platform ujian lain]",
    "security_rules": {
      "force_fullscreen": true,
      "block_tab_switch": true,
      "block_floating_apps": true,
      "max_allowed_violations": 1,
      "violation_penalty_seconds": 10,
      "action_on_exceed": "LOCK_PERMANENTLY"
    },
    "token_settings": {
      "expiration_datetime": "[YYYY-MM-DD HH:MM]",
      "max_attempts": 1
    }
  }
}
\`\`\`

GAYA BAHASA & INTERAKSI:
- Gunakan bahasa Indonesia yang tegas, jelas, dan profesional.
- Fokus penuh pada teknis pengamanan ujian, batas waktu, dan prosedur penanganan pelanggaran.
- Jika pengguna (guru) hanya memberikan link ujian tanpa menyebutkan aturan, berikan rekomendasi konfigurasi keamanan standar (misal: Maksimal 1x pelanggaran, penalti 10 detik, auto-block permanen) lalu minta konfirmasi, serta jelaskan deteksi tab baru untuk mencegah kecurangan selama sesi berlangsung.
- Jelaskan bahwa sistem berjalan real-time dengan notifikasi instan kepada pengawas melalui dashboard pemantauan.`;

    if (ai) {
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Add relevant history if available
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history.slice(-6)) {
          contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.content }],
          });
        }
      }

      const promptWithContext = `Konfigurasi saat ini: ${JSON.stringify(currentConfig || {})}
Permintaan Pengajar: ${message}`;

      contents.push({
        role: 'user',
        parts: [{ text: promptWithContext }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      const text = response.text || '';
      return res.json({ reply: text });
    } else {
      // Fallback deterministic smart assistant if no API key is provided
      const fallbackReply = generateFallbackResponse(message, currentConfig);
      return res.json({ reply: fallbackReply });
    }
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    // Provide robust fallback response
    const fallbackReply = generateFallbackResponse(req.body.message || '', req.body.currentConfig);
    return res.json({
      reply: fallbackReply,
      warning: 'Menggunakan generator cerdas bawaan UjianAman.id.',
    });
  }
});

// Helper for fallback response if Gemini key is not configured
function generateFallbackResponse(userPrompt: string, currentConfig: any): string {
  const urlMatch = userPrompt.match(/https?:\/\/[^\s]+/i);
  const foundUrl = urlMatch ? urlMatch[0] : (currentConfig?.form_source_url || 'https://forms.google.com/example-exam');
  
  // Extract potential exam name or class
  let examName = 'Ujian Online Penilaian Akhir';
  let targetClass = 'Kelas XII - MIPA / IPS';

  if (/matematika/i.test(userPrompt)) examName = 'Penilaian Akhir Semester - Matematika';
  else if (/fisika/i.test(userPrompt)) examName = 'Ujian Blok - Fisika Terapan';
  else if (/biologi/i.test(userPrompt)) examName = 'Asesmen Sumatif - Biologi';
  else if (/bahasa/i.test(userPrompt)) examName = 'Ujian Kemahiran Berbahasa Indonesia';
  else if (/sejarah/i.test(userPrompt)) examName = 'Penilaian Harian - Sejarah';
  else if (currentConfig?.exam_name && currentConfig.exam_name !== '[Nama Ujian/Mata Pelajaran]') {
    examName = currentConfig.exam_name;
  }

  const dateNow = new Date();
  dateNow.setHours(dateNow.getHours() + 3);
  const expDateStr = `${dateNow.getFullYear()}-${String(dateNow.getMonth() + 1).padStart(2, '0')}-${String(dateNow.getDate()).padStart(2, '0')} ${String(dateNow.getHours()).padStart(2, '0')}:00`;

  const generatedJson = {
    exam_config: {
      exam_name: examName,
      target_class: targetClass,
      form_source_url: foundUrl,
      security_rules: {
        force_fullscreen: true,
        block_tab_switch: true,
        block_floating_apps: true,
        max_allowed_violations: 1,
        violation_penalty_seconds: 10,
        action_on_exceed: "LOCK_PERMANENTLY"
      },
      token_settings: {
        expiration_datetime: expDateStr,
        max_attempts: 1
      }
    }
  };

  return `Halo Bapak/Ibu Pengajar. Saya asisten keamanan **UjianAman.id**.

Tautan ujian Anda telah berhasil diidentifikasi:
🔗 **URL Sumber:** \`${foundUrl}\`

### Rekomendasi Protokol Keamanan Standar:
1. **Lock Fullscreen (Otomatis):** Wajib masuk mode layar penuh saat sesi ujian dimulai. Keluar dari fullscreen akan dihitung sebagai pelanggaran berat.
2. **Anti-Tab Switching & New Window Detection:** Mendeteksi secara instan jika siswa membuka tab baru, berganti aplikasi (Alt+Tab), atau meminimalkan browser.
3. **Anti-Split Screen & Floating Apps:** Mengunci aspek rasio tampilan untuk mendeteksi pembagian layar atau aplikasi kalkulator/browser mengambang di Android/iOS.
4. **Toleransi Pelanggaran:** Maksimal **1x pelanggaran toleransi** dengan jeda penalti beku layar **10 detik**.
5. **Sanksi:** **LOCK_PERMANENTLY** (Siswa langsung diblokir permanen dan hanya dapat dibuka kembali oleh pengawas melalui Dashboard Pemantauan Real-time).

Berikut payload konfigurasi keamanan siap pakai untuk sistem pengunci ujian:

\`\`\`json
${JSON.stringify(generatedJson, null, 2)}
\`\`\`

Silakan klik tombol **"Terapkan ke Konfigurasi"** untuk mengaktifkan aturan ini atau sesuaikan parameter di panel generator.`;
}

// API: Real-time sessions management for Proctor Dashboard
app.get('/api/proctor/sessions', (req, res) => {
  res.json({
    sessions: Array.from(activeSessions.values()),
    auditLogs: proctorAuditLogs.slice(-50).reverse(),
  });
});

app.post('/api/proctor/session-heartbeat', (req, res) => {
  const session: StudentSession = req.body;
  if (!session || !session.studentId) {
    return res.status(400).json({ error: 'Data sesi tidak valid' });
  }

  session.lastHeartbeat = Date.now();
  activeSessions.set(session.studentId, session);
  res.json({ status: 'updated' });
});

app.post('/api/proctor/report-violation', (req, res) => {
  const { studentId, studentName, violationType, details } = req.body;
  const session = activeSessions.get(studentId);

  const logEntry = {
    id: 'log_' + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    studentName: studentName || session?.studentName || 'Peserta Ujian',
    type: violationType,
    details: details || 'Pelanggaran keamanan terdeteksi',
    severity: (violationType === 'split_screen' || violationType === 'tab_switch' ? 'danger' : 'warning') as 'danger' | 'warning',
  };

  proctorAuditLogs.push(logEntry);

  if (session) {
    session.violationsCount += 1;
    if (session.violationsCount >= session.maxViolations) {
      session.status = 'blocked';
    } else {
      session.status = 'warning';
      session.penaltySecondsLeft = 10;
    }
    session.recentViolations.push({
      id: logEntry.id,
      type: violationType,
      description: details,
      timestamp: Date.now(),
    });
    activeSessions.set(studentId, session);
  }

  res.json({ status: 'recorded', log: logEntry });
});

app.post('/api/proctor/unlock-student', (req, res) => {
  const { studentId, reason } = req.body;
  const session = activeSessions.get(studentId);
  if (session) {
    session.status = 'active';
    session.violationsCount = 0;
    session.penaltySecondsLeft = 0;
    activeSessions.set(studentId, session);

    proctorAuditLogs.push({
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      studentName: session.studentName,
      type: 'manual_unlock',
      details: `Pengawas membuka blokir: ${reason || 'Izin khusus pengawas'}`,
      severity: 'info',
    });

    return res.json({ status: 'unlocked', session });
  }
  res.status(404).json({ error: 'Siswa tidak ditemukan' });
});

app.post('/api/proctor/reset-all', (req, res) => {
  activeSessions.clear();
  proctorAuditLogs.length = 0;
  res.json({ status: 'cleared' });
});

// Vite middleware for development & static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UjianAman.id server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
