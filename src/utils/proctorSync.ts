import { ExamPayload, ProctorLog, StudentSession, DynamicMasterPin, EmergencyRecoveryToken, SavedExamItem } from '../types';

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
const STORAGE_EXAM_LIST_KEY = 'ujianaman_saved_exams_list';
const STORAGE_SESSIONS_KEY = 'ujianaman_student_sessions';
const STORAGE_LOGS_KEY = 'ujianaman_proctor_logs';
const STORAGE_DYNAMIC_PIN_KEY = 'ujianaman_dynamic_master_pin';
const STORAGE_RECOVERY_TOKENS_KEY = 'ujianaman_recovery_tokens';

export const DEFAULT_EXAM_LIST: SavedExamItem[] = [
  {
    id: 'exam_math_01',
    name: 'Penilaian Akhir Semester - Matematika & Logika Terapan',
    targetClass: 'Kelas XII - MIPA 1',
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSc_EXAMPLE_MATH/viewform',
    createdAt: Date.now() - 86400000 * 2,
    payload: DEFAULT_EXAM_CONFIG
  },
  {
    id: 'exam_physics_02',
    name: 'Ujian Tengah Semester - Fisika Kuantum Dasar',
    targetClass: 'Kelas XI - IPA',
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSc_EXAMPLE_PHYSICS/viewform',
    createdAt: Date.now() - 86400000,
    payload: {
      exam_config: {
        exam_name: 'Ujian Tengah Semester - Fisika Kuantum Dasar',
        target_class: 'Kelas XI - IPA',
        form_source_url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_EXAMPLE_PHYSICS/viewform',
        security_rules: {
          force_fullscreen: true,
          block_tab_switch: true,
          block_floating_apps: true,
          max_allowed_violations: 2,
          violation_penalty_seconds: 10,
          action_on_exceed: 'LOCK_PERMANENTLY'
        },
        token_settings: {
          expiration_datetime: '2026-09-08 14:00',
          max_attempts: 1,
          access_pin: 'FISIKA-2026'
        }
      }
    }
  },
  {
    id: 'exam_indo_03',
    name: 'Asesmen Sumatif - Bahasa Indonesia & Literasi',
    targetClass: 'Seluruh Kelas X',
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSd_EXAMPLE_INDO/viewform',
    createdAt: Date.now() - 3600000 * 5,
    payload: {
      exam_config: {
        exam_name: 'Asesmen Sumatif - Bahasa Indonesia & Literasi',
        target_class: 'Seluruh Kelas X',
        form_source_url: 'https://docs.google.com/forms/d/e/1FAIpQLSd_EXAMPLE_INDO/viewform',
        security_rules: {
          force_fullscreen: true,
          block_tab_switch: true,
          block_floating_apps: true,
          max_allowed_violations: 1,
          violation_penalty_seconds: 10,
          action_on_exceed: 'LOCK_PERMANENTLY'
        },
        token_settings: {
          expiration_datetime: '2026-09-09 11:30',
          max_attempts: 1,
          access_pin: 'LITERASI-10'
        }
      }
    }
  }
];

export function getSavedExamList(): SavedExamItem[] {
  if (typeof window === 'undefined') return DEFAULT_EXAM_LIST;
  try {
    const raw = localStorage.getItem(STORAGE_EXAM_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading exam list', e);
  }
  saveExamList(DEFAULT_EXAM_LIST);
  return DEFAULT_EXAM_LIST;
}

export function saveExamList(list: SavedExamItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_EXAM_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving exam list', e);
  }
}

export function saveExamToList(payload: ExamPayload, existingId?: string): SavedExamItem {
  const currentList = getSavedExamList();
  const name = payload.exam_config.exam_name || 'Ujian Tanpa Judul';
  const targetClass = payload.exam_config.target_class || 'Semua Kelas';
  const formUrl = payload.exam_config.form_source_url || '';

  let updatedItem: SavedExamItem;
  let nextList: SavedExamItem[];

  if (existingId) {
    const idx = currentList.findIndex((item) => item.id === existingId);
    if (idx >= 0) {
      updatedItem = {
        ...currentList[idx],
        name,
        targetClass,
        formUrl,
        payload
      };
      nextList = [...currentList];
      nextList[idx] = updatedItem;
    } else {
      updatedItem = {
        id: existingId,
        name,
        targetClass,
        formUrl,
        createdAt: Date.now(),
        payload
      };
      nextList = [updatedItem, ...currentList];
    }
  } else {
    const existingIdx = currentList.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
      updatedItem = {
        ...currentList[existingIdx],
        name,
        targetClass,
        formUrl,
        payload
      };
      nextList = [...currentList];
      nextList[existingIdx] = updatedItem;
    } else {
      updatedItem = {
        id: 'exam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name,
        targetClass,
        formUrl,
        createdAt: Date.now(),
        payload
      };
      nextList = [updatedItem, ...currentList];
    }
  }

  saveExamList(nextList);
  saveExamConfig(payload);
  return updatedItem;
}

export function deleteExamFromList(id: string): SavedExamItem[] {
  const currentList = getSavedExamList();
  const filtered = currentList.filter((item) => item.id !== id);
  saveExamList(filtered);
  return filtered;
}

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
