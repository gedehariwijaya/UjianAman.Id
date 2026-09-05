import { ExamPayload, ProctorLog, StudentSession } from '../types';

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
  | { type: 'PROCTOR_UNLOCK'; studentId: string }
  | { type: 'PROCTOR_GLOBAL_ALERT'; message: string }
  | { type: 'CONFIG_UPDATED'; config: ExamPayload };

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
