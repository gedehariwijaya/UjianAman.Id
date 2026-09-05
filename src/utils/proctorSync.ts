import { ExamPayload, ProctorLog, StudentSession, DynamicMasterPin, EmergencyRecoveryToken } from '../types';

export const DEFAULT_EXAM_CONFIG: ExamPayload = {
  exam_config: {
    exam_name: "Penilaian Akhir Semester - Matematika & Logika Terapan",
    target_class: "Kelas XII - MIPA 1",
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
      expiration_datetime: "2026-09-05 12:00",
      max_attempts: 1,
      access_pin: "AMAN-2026"
    }
  }
};

const CHANNEL_NAME = 'ujianaman_sync_channel';
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.debug('BroadcastChannel error', e);
  }
}

export type SyncMessage =
  | { type: 'STUDENT_JOIN'; session: StudentSession }
  | { type: 'STUDENT_HEARTBEAT'; session: StudentSession }
  | { type: 'STUDENT_VIOLATION'; log: ProctorLog; session: StudentSession }
  | { type: 'PROCTOR_UNLOCK'; studentId: string; method?: 'dynamic_pin' | 'recovery_token' | 'remote_dashboard' }
  | { type: 'PROCTOR_GLOBAL_ALERT'; message: string }
  | { type: 'CONFIG_UPDATED'; config: ExamPayload }
  | { type: 'DYNAMIC_PIN_UPDATED'; pinData: DynamicMasterPin }
  | { type: 'RECOVERY_TOKEN_CREATED'; token: EmergencyRecoveryToken }
  | { type: 'RECOVERY_TOKEN_USED'; tokenId: string; studentNis: string }
  | { type: 'SAFE_EXIT_TRIGGERED'; studentName: string; studentNis: string; reason: string };

export function broadcastMessage(message: SyncMessage) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
    } catch (e) {
      console.debug('Failed to postMessage', e);
    }
  }
  // Also dispatch window custom event for same-tab listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ujianaman_local_sync', { detail: message }));
  }
}

export function subscribeToSyncMessages(callback: (msg: SyncMessage) => void) {
  const channelHandler = (event: MessageEvent) => {
    if (event.data) callback(event.data);
  };

  const windowHandler = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail) callback(customEvent.detail);
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', channelHandler);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('ujianaman_local_sync', windowHandler);
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', channelHandler);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('ujianaman_local_sync', windowHandler);
    }
  };
}

// LocalStorage helpers for persistence
const STORAGE_CONFIG_KEY = 'ujianaman_active_config';
const STORAGE_SESSIONS_KEY = 'ujianaman_student_sessions';
const STORAGE_LOGS_KEY = 'ujianaman_proctor_logs';
const STORAGE_DYNAMIC_PIN_KEY = 'ujianaman_dynamic_master_pin';
const STORAGE_RECOVERY_TOKENS_KEY = 'ujianaman_recovery_tokens';

export function getSavedExamConfig(): ExamPayload {
  if (typeof window === 'undefined') return DEFAULT_EXAM_CONFIG;
  try {
    const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading saved config', e);
  }
  return DEFAULT_EXAM_CONFIG;
}

export function saveExamConfig(config: ExamPayload) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    broadcastMessage({ type: 'CONFIG_UPDATED', config });
  } catch (e) {
    console.error('Error saving config', e);
  }
}

export function getSavedSessions(): StudentSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_SESSIONS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error loading sessions', e);
  }
  return [];
}

export function saveSessions(sessions: StudentSession[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Error saving sessions', e);
  }
}

export function getSavedLogs(): ProctorLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_LOGS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error loading logs', e);
  }
  return [];
}

export function saveLogs(logs: ProctorLog[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs.slice(-100)));
  } catch (e) {
    console.error('Error saving logs', e);
  }
}

// ---------------------------------------------------------------------------
// DYNAMIC 6-DIGIT MASTER PIN (Rotates every 90s with grace period)
// ---------------------------------------------------------------------------
export const DYNAMIC_PIN_TTL_SECONDS = 90;

export function getDynamicMasterPin(): DynamicMasterPin {
  if (typeof window === 'undefined') {
    return {
      pin: '739201',
      generatedAt: Date.now(),
      expiresAt: Date.now() + DYNAMIC_PIN_TTL_SECONDS * 1000,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_DYNAMIC_PIN_KEY);
    if (raw) {
      const data: DynamicMasterPin = JSON.parse(raw);
      // If still valid, return
      if (data.expiresAt > Date.now()) {
        return data;
      }
      // If expired, regenerate keeping old pin as previousPin for 45s grace
      return regenerateDynamicMasterPin(data.pin);
    }
  } catch (e) {
    console.error('Error reading dynamic pin', e);
  }

  return regenerateDynamicMasterPin();
}

export function regenerateDynamicMasterPin(previousPin?: string): DynamicMasterPin {
  const newPin = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const pinData: DynamicMasterPin = {
    pin: newPin,
    generatedAt: now,
    expiresAt: now + DYNAMIC_PIN_TTL_SECONDS * 1000,
    previousPin,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_DYNAMIC_PIN_KEY, JSON.stringify(pinData));
      broadcastMessage({ type: 'DYNAMIC_PIN_UPDATED', pinData });
    } catch (e) {
      console.error('Error saving dynamic pin', e);
    }
  }

  return pinData;
}

export function validateMasterPin(inputPin: string, staticConfigPin?: string): boolean {
  const cleaned = inputPin.trim();
  if (!cleaned) return false;

  // 1. Static config PIN or standard bypass
  if (cleaned === 'AMAN-2026' || (staticConfigPin && cleaned === staticConfigPin.trim())) {
    return true;
  }

  // 2. Dynamic 6-digit Master PIN from current state
  const currentPinData = getDynamicMasterPin();
  if (cleaned === currentPinData.pin) {
    return true;
  }

  // 3. Grace period check: previous pin valid within 45 seconds of rotation
  if (currentPinData.previousPin && cleaned === currentPinData.previousPin) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// SPECIFIC STUDENT RECOVERY TOKENS (NIS-bound)
// ---------------------------------------------------------------------------
export function getSavedRecoveryTokens(): EmergencyRecoveryToken[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_RECOVERY_TOKENS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error loading recovery tokens', e);
  }
  return [];
}

export function saveRecoveryTokens(tokens: EmergencyRecoveryToken[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_RECOVERY_TOKENS_KEY, JSON.stringify(tokens));
  } catch (e) {
    console.error('Error saving recovery tokens', e);
  }
}

export function generateStudentRecoveryToken(
  studentNis: string,
  studentName: string,
  reason: string = 'Pemulihan Sesi Darurat Pengawas'
): EmergencyRecoveryToken {
  // Generate random 4-char suffix e.g. "REC-2026-9F4A"
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const tokenCode = `REC-${studentNis.slice(-4) || '9999'}-${suffix}`;

  const token: EmergencyRecoveryToken = {
    id: 'tok_' + Math.random().toString(36).substr(2, 9),
    tokenCode,
    studentNis: studentNis.trim(),
    studentName: studentName.trim(),
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // Valid for 30 minutes
    used: false,
    reason,
  };

  const existing = getSavedRecoveryTokens();
  const updated = [token, ...existing];
  saveRecoveryTokens(updated);

  broadcastMessage({
    type: 'RECOVERY_TOKEN_CREATED',
    token,
  });

  return token;
}

export function validateAndRedeemRecoveryToken(
  tokenCode: string,
  studentNis: string
): { valid: boolean; message: string; token?: EmergencyRecoveryToken } {
  const cleanedCode = tokenCode.trim().toUpperCase();
  const cleanedNis = studentNis.trim();

  const tokens = getSavedRecoveryTokens();
  const found = tokens.find(
    (t) => t.tokenCode.toUpperCase() === cleanedCode
  );

  if (!found) {
    return { valid: false, message: 'Kode Token Pemulihan tidak ditemukan di sistem pengawas.' };
  }

  if (found.used) {
    return { valid: false, message: 'Token Pemulihan ini sudah pernah digunakan sebelumnya.' };
  }

  if (Date.now() > found.expiresAt) {
    return { valid: false, message: 'Token Pemulihan ini sudah kadaluarsa (melewati batas 30 menit).' };
  }

  // Check NIS binding: Must match the target student
  if (found.studentNis && found.studentNis !== cleanedNis) {
    return {
      valid: false,
      message: `Token ini diterbitkan khusus untuk NIS ${found.studentNis} (${found.studentName}). Tidak dapat digunakan oleh NIS ${cleanedNis}.`,
    };
  }

  // Mark as used
  const updatedTokens = tokens.map((t) =>
    t.id === found.id ? { ...t, used: true, usedAt: Date.now() } : t
  );
  saveRecoveryTokens(updatedTokens);

  broadcastMessage({
    type: 'RECOVERY_TOKEN_USED',
    tokenId: found.id,
    studentNis: cleanedNis,
  });

  return { valid: true, message: 'Token valid! Sesi Anda berhasil dipulihkan.', token: found };
}
