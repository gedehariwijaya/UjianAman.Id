import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Check, 
  Copy, 
  ArrowRight, 
  ShieldAlert, 
  ShieldCheck, 
  Bot, 
  User, 
  RefreshCcw, 
  Zap,
  HelpCircle,
  Play
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ExamPayload } from '../types';
import { saveExamConfig } from '../utils/proctorSync';

interface AiAssistantProps {
  currentConfig: ExamPayload;
  onApplyConfig: (config: ExamPayload) => void;
  onLaunchPlayer: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  currentConfig,
  onApplyConfig,
  onLaunchPlayer,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Selamat datang di konsol spesialis pengamanan ujian **UjianAman.id**.

Saya adalah asisten AI yang siap mengonfigurasi protokol keamanan ujian berbasis web (Secure Exam Player) untuk mencegah segala bentuk kecurangan siswa.

### Protokol Wajib yang Saya Terapkan:
- **Lock Fullscreen**: Masuk mode layar penuh seketika saat ujian dimulai.
- **Anti-Tab Switching**: Mendeteksi jika siswa membuka tab baru, beralih aplikasi, atau meminimalkan layar.
- **Anti-Split Screen & Floating Apps**: Mendeteksi pembagian layar atau jendela mengambang di Android/iOS.
- **Auto-Block Enforcement**: Mengunci akses permanen (\`LOCK_PERMANENTLY\`) jika melewati batas pelanggaran toleransi.

**Silakan masukkan tautan Google Forms, Jotform, atau detail ujian Anda di bawah.** Jika Anda hanya memberikan link, saya akan langsung merekomendasikan konfigurasi standar keamanan tinggi.`,
      timestamp: Date.now(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Extract JSON configuration from text if present
  const extractExamPayload = (text: string): ExamPayload | null => {
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.exam_config && parsed.exam_config.security_rules) {
          return parsed;
        }
      }
      // Or if raw JSON is directly in text
      const rawMatch = text.match(/\{\s*"exam_config":[\s\S]*\}\s*\}/);
      if (rawMatch) {
        const parsed = JSON.parse(rawMatch[0]);
        if (parsed.exam_config && parsed.exam_config.security_rules) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignored
    }
    return null;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputPrompt).trim();
    if (!messageContent || loading) return;

    const userMessage: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          currentConfig: currentConfig.exam_config,
        }),
      });

      const data = await res.json();
      const replyText = data.reply || 'Maaf, terjadi kendala komunikasi dengan asisten keamanan.';
      const extracted = extractExamPayload(replyText);

      const assistantMessage: ChatMessage = {
        id: 'ast_' + Date.now(),
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
        extractedConfig: extracted || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: 'Terjadi kesalahan teknis saat menghubungi server. Mohon periksa koneksi Anda.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (msgId: string, payload: ExamPayload) => {
    onApplyConfig(payload);
    saveExamConfig(payload);
    setAppliedId(msgId);
    setTimeout(() => setAppliedId(null), 3000);
  };

  const handleCopyPayload = (msgId: string, payload: ExamPayload) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    {
      title: 'Tautkan Google Form Baru',
      prompt: 'Ini link Google Form ujian Matematika saya: https://docs.google.com/forms/d/e/1FAIpQLSe_MATH_EXAM/viewform untuk kelas XII MIPA. Tolong buatkan konfigurasi keamanan standar.',
    },
    {
      title: 'Konfigurasi Tanpa Toleransi (0x)',
      prompt: 'Buatkan konfigurasi ketat tanpa toleransi (max_allowed_violations: 0) untuk Ujian Akhir Semester Fisika dengan link https://form.jotform.com/231984729182061.',
    },
    {
      title: 'Cara Kerja Deteksi Tab Baru',
      prompt: 'Jelaskan bagaimana sistem UjianAman.id mendeteksi secara real-time saat siswa membuka tab baru atau berpindah aplikasi.',
    },
    {
      title: 'Prosedur Pembukaan Blokir',
      prompt: 'Bagaimana prosedur penanganan jika ada siswa yang terblokir permanen saat ujian berlangsung?',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Asisten AI UjianAman.id</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AI CO-PILOT
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Spesialis Parameter Keamanan Ujian, Sandbox Browser Lock, & Generator Payload JSON
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                id: 'welcome_reset',
                role: 'assistant',
                content: `Sesi percakapan diatur ulang. Silakan berikan link ujian atau instruksi keamanan baru untuk diproses ke format JSON.`,
                timestamp: Date.now(),
              },
            ]);
          }}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Reset Percakapan"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages Container */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[560px]">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const payload = msg.extractedConfig || extractExamPayload(msg.content);

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                  }`}
                >
                  <div className="prose prose-invert prose-xs max-w-none space-y-2 leading-relaxed font-sans">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* If assistant generated a valid JSON payload, show action bar */}
                  {!isUser && payload && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 p-3 rounded-xl">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Payload Terdeteksi: {payload.exam_config.exam_name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyPayload(msg.id, payload)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin JSON</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleApply(msg.id, payload)}
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                            appliedId === msg.id
                              ? 'bg-emerald-500 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {appliedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Telah Diterapkan!</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>Terapkan ke Konfigurasi</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            handleApply(msg.id, payload);
                            onLaunchPlayer();
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Uji di Player</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mt-1">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-slate-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Asisten UjianAman.id sedang merumuskan parameter keamanan & JSON payload...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Suggestions */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> Contoh Cepat:
          </span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-[11px] whitespace-nowrap border border-slate-700/50 transition shrink-0"
            >
              {qp.title}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              id="ai-chat-input"
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ketik link Google Forms, nama ujian, atau pertanyaan keamanan..."
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder-slate-500 outline-none disabled:opacity-50"
            />
            <button
              id="ai-chat-send-btn"
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
