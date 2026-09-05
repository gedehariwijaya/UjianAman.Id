export interface SecurityRules {
  force_fullscreen: boolean;
  block_tab_switch: boolean;
  block_floating_apps: boolean;
  max_allowed_violations: number;
  violation_penalty_seconds: number;
  action_on_exceed: 'LOCK_PERMANENTLY' | 'AUTO_SUBMIT' | 'WARN_ONLY';
}

export interface TokenSettings {
  expiration_datetime: string;
  max_attempts: number;
  access_pin?: string;
}

export interface ExamConfig {
  exam_name: string;
  target_class: string;
  form_source_url: string;
  security_rules: SecurityRules;
  token_settings: TokenSettings;
}

export interface ExamPayload {
  exam_config: ExamConfig;
}

export interface SavedExamItem {
  id: string;
  name: string;
  targetClass: string;
  formUrl: string;
  createdAt: number;
  payload: ExamPayload;
}

export interface StudentViolationRecord {
  id: string;
  type: 'tab_switch' | 'fullscreen_exit' | 'split_screen' | 'blur' | 'devtools_or_key' | 'floating_app';
  title: string;
  description: string;
  timestamp: number;
}

export interface StudentSession {
  studentId: string;
  studentName: string;
  studentNis: string;
  studentAbsen?: string;
  studentClass?: string;
  examId: string;
  status: 'active' | 'warning' | 'blocked' | 'submitted' | 'safe_exited';
  device: string;
  os: string;
  browser: string;
  violationsCount: number;
  maxViolations: number;
  penaltySecondsLeft: number;
  lastHeartbeat: number;
  joinedAt: number;
  recentViolations: StudentViolationRecord[];
  safeExitReason?: string;
}

export interface EmergencyRecoveryToken {
  id: string;
  tokenCode: string; // e.g. "REC-8492-X9"
  studentNis: string;
  studentName: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  reason?: string;
}

export interface DynamicMasterPin {
  pin: string; // 6 digits e.g. "729410"
  generatedAt: number;
  expiresAt: number;
  previousPin?: string;
}

export interface ProctorLog {
  id: string;
  timestamp: number;
  studentName: string;
  studentNis: string;
  type: string;
  details: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  extractedConfig?: ExamPayload;
}
