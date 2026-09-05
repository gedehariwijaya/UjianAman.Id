import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  ExamPayload, 
  SavedExamItem, 
  StudentSession, 
  ProctorLog, 
  EmergencyRecoveryToken, 
  DynamicMasterPin 
} from '../types';
import { 
  DEFAULT_EXAM_CONFIG, 
  DEFAULT_EXAM_LIST, 
  getSavedExamList as getLocalExamList, 
  saveExamList as saveLocalExamList,
  getSavedExamConfig as getLocalExamConfig,
  saveExamConfig as saveLocalExamConfig,
  getSavedSessions as getLocalSessions,
  saveSessions as saveLocalSessions,
  getSavedLogs as getLocalLogs,
  saveLogs as saveLocalLogs,
  getSavedRecoveryTokens as getLocalRecoveryTokens,
  saveRecoveryTokens as saveLocalRecoveryTokens,
  getDynamicMasterPin as getLocalDynamicMasterPin,
  saveDynamicMasterPin as saveLocalDynamicMasterPin,
  broadcastMessage
} from './proctorSync';

// Firestore Collection Names
export const FS_COLLECTIONS = {
  EXAMS: 'ujianaman_exams',
  SETTINGS: 'ujianaman_settings',
  SESSIONS: 'ujianaman_sessions',
  LOGS: 'ujianaman_logs',
  TOKENS: 'ujianaman_recovery_tokens',
};

// ---------------------------------------------------------------------------
// 1. CLOUD SYNC: EXAMS LIST & ACTIVE CONFIG
// ---------------------------------------------------------------------------

/**
 * Initializes default exams in Firestore if collection is empty
 */
export async function initializeFirestoreExamsIfNeeded(): Promise<void> {
  try {
    const examsCol = collection(db, FS_COLLECTIONS.EXAMS);
    const snap = await getDocs(examsCol);
    if (snap.empty) {
      console.log('Seeding initial exams to Firestore cloud database...');
      for (const exam of DEFAULT_EXAM_LIST) {
        await setDoc(doc(db, FS_COLLECTIONS.EXAMS, exam.id), {
          ...exam,
          updatedAt: serverTimestamp(),
        });
      }
      await setDoc(doc(db, FS_COLLECTIONS.SETTINGS, 'active_config'), {
        payload: DEFAULT_EXAM_CONFIG,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.warn('Could not seed Firestore exams (will use local fallback):', error);
  }
}

/**
 * Saves or updates an exam in Firestore and local fallback
 */
export async function cloudSaveExam(payload: ExamPayload, existingId?: string): Promise<SavedExamItem> {
  const currentLocalList = getLocalExamList();
  const name = payload.exam_config.exam_name || 'Ujian Tanpa Judul';
  const targetClass = payload.exam_config.target_class || 'Semua Kelas';
  const formUrl = payload.exam_config.form_source_url || '';

  const examId = existingId || 'exam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const examItem: SavedExamItem = {
    id: examId,
    name,
    targetClass,
    formUrl,
    createdAt: Date.now(),
    payload,
  };

  // 1. Immediately update local storage & broadcast for instantaneous UI responsiveness
  const existingIdx = currentLocalList.findIndex((i) => i.id === examId || i.name.toLowerCase() === name.toLowerCase());
  let nextLocalList: SavedExamItem[];
  if (existingIdx >= 0) {
    nextLocalList = [...currentLocalList];
    nextLocalList[existingIdx] = examItem;
  } else {
    nextLocalList = [examItem, ...currentLocalList];
  }
  saveLocalExamList(nextLocalList);
  saveLocalExamConfig(payload);

  // 2. Persist to Firestore cloud database so all phones and devices receive the change
  try {
    const examDocRef = doc(db, FS_COLLECTIONS.EXAMS, examId);
    await setDoc(examDocRef, {
      ...examItem,
      updatedAt: serverTimestamp(),
    });

    const activeConfigRef = doc(db, FS_COLLECTIONS.SETTINGS, 'active_config');
    await setDoc(activeConfigRef, {
      payload,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to sync exam to Firestore:', err);
  }

  return examItem;
}

/**
 * Deletes an exam in Firestore & local fallback
 */
export async function cloudDeleteExam(examId: string): Promise<SavedExamItem[]> {
  const nextList = getLocalExamList().filter((e) => e.id !== examId);
  saveLocalExamList(nextList);

  try {
    await deleteDoc(doc(db, FS_COLLECTIONS.EXAMS, examId));
  } catch (err) {
    console.error('Failed to delete exam from Firestore:', err);
  }

  return nextList;
}

/**
 * Real-time listener for all exams in Firestore
 * Calls callback whenever any exam is added/edited/deleted from ANY device or phone.
 */
export function subscribeToCloudExams(onUpdate: (exams: SavedExamItem[]) => void): () => void {
  try {
    const examsCol = collection(db, FS_COLLECTIONS.EXAMS);
    const unsub = onSnapshot(examsCol, (snapshot) => {
      if (!snapshot.empty) {
        const cloudExams: SavedExamItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.name && data.payload) {
            cloudExams.push({
              id: docSnap.id,
              name: data.name,
              targetClass: data.targetClass || '',
              formUrl: data.formUrl || '',
              createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
              payload: data.payload as ExamPayload,
            });
          }
        });

        // Sort latest first
        cloudExams.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (cloudExams.length > 0) {
          saveLocalExamList(cloudExams);
          onUpdate(cloudExams);
        }
      } else {
        // Fallback to local list if cloud empty initially
        const local = getLocalExamList();
        onUpdate(local);
      }
    }, (error) => {
      console.warn('Firestore exams listener error, falling back to local:', error);
      onUpdate(getLocalExamList());
    });

    return unsub;
  } catch (err) {
    console.warn('Firestore subscription failed, using local storage:', err);
    onUpdate(getLocalExamList());
    return () => {};
  }
}

/**
 * Real-time listener for active exam configuration in Firestore
 */
export function subscribeToCloudActiveConfig(onUpdate: (config: ExamPayload) => void): () => void {
  try {
    const configDoc = doc(db, FS_COLLECTIONS.SETTINGS, 'active_config');
    const unsub = onSnapshot(configDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.payload) {
          saveLocalExamConfig(data.payload as ExamPayload);
          onUpdate(data.payload as ExamPayload);
        }
      }
    }, (err) => {
      console.warn('Active config snapshot error:', err);
    });
    return unsub;
  } catch (err) {
    console.warn('Active config subscription error:', err);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// 2. CLOUD SYNC: STUDENT SESSIONS & PROCTOR SUPERVISION
// ---------------------------------------------------------------------------

/**
 * Sends student session update / heartbeat to Firestore
 * This allows proctor dashboard on teacher's laptop to monitor student phones anywhere!
 */
export async function cloudSyncStudentSession(session: StudentSession): Promise<void> {
  // Update local session
  const localSessions = getLocalSessions();
  const idx = localSessions.findIndex((s) => s.studentId === session.studentId);
  let nextSessions: StudentSession[];
  if (idx >= 0) {
    nextSessions = [...localSessions];
    nextSessions[idx] = session;
  } else {
    nextSessions = [session, ...localSessions];
  }
  saveLocalSessions(nextSessions);

  // Sync to Firestore
  try {
    const sessionDocRef = doc(db, FS_COLLECTIONS.SESSIONS, session.studentId);
    await setDoc(sessionDocRef, {
      ...session,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.debug('Failed to sync student session to Firestore:', err);
  }
}

/**
 * Proctor listens to real-time student sessions across all devices & phones
 */
export function subscribeToCloudSessions(onUpdate: (sessions: StudentSession[]) => void): () => void {
  try {
    const sessionsCol = collection(db, FS_COLLECTIONS.SESSIONS);
    const unsub = onSnapshot(sessionsCol, (snapshot) => {
      const cloudSessions: StudentSession[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StudentSession;
        if (data && data.studentId && data.studentName) {
          cloudSessions.push(data);
        }
      });

      if (cloudSessions.length > 0) {
        saveLocalSessions(cloudSessions);
        onUpdate(cloudSessions);
      } else {
        onUpdate(getLocalSessions());
      }
    }, (err) => {
      console.warn('Firestore sessions subscription error:', err);
      onUpdate(getLocalSessions());
    });

    return unsub;
  } catch (err) {
    console.warn('Failed to subscribe to Firestore sessions:', err);
    onUpdate(getLocalSessions());
    return () => {};
  }
}

/**
 * Logs a proctor audit event to Firestore
 */
export async function cloudLogViolation(log: ProctorLog, session: StudentSession): Promise<void> {
  // 1. Update local
  const currentLogs = getLocalLogs();
  saveLocalLogs([log, ...currentLogs]);

  // 2. Push to Firestore
  try {
    await setDoc(doc(db, FS_COLLECTIONS.LOGS, log.id), {
      ...log,
      serverTime: serverTimestamp(),
    });
    await cloudSyncStudentSession(session);
  } catch (err) {
    console.debug('Failed to write violation log to Firestore:', err);
  }
}

// ---------------------------------------------------------------------------
// 3. CLOUD SYNC: DYNAMIC MASTER PIN & RECOVERY TOKENS
// ---------------------------------------------------------------------------

/**
 * Saves dynamic master PIN to Firestore
 */
export async function cloudSaveDynamicPin(pinData: DynamicMasterPin): Promise<void> {
  saveLocalDynamicMasterPin(pinData);
  try {
    await setDoc(doc(db, FS_COLLECTIONS.SETTINGS, 'master_pin'), {
      ...pinData,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.debug('Failed to sync dynamic PIN to Firestore:', err);
  }
}

/**
 * Real-time listener for Dynamic Master PIN (rotates simultaneously on all devices)
 */
export function subscribeToCloudDynamicPin(onUpdate: (pinData: DynamicMasterPin) => void): () => void {
  try {
    const pinDoc = doc(db, FS_COLLECTIONS.SETTINGS, 'master_pin');
    const unsub = onSnapshot(pinDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as DynamicMasterPin;
        if (data && data.pin) {
          saveLocalDynamicMasterPin(data);
          onUpdate(data);
        }
      }
    }, (err) => {
      console.debug('Master pin subscription error:', err);
    });
    return unsub;
  } catch (err) {
    return () => {};
  }
}

/**
 * Saves emergency recovery token to Firestore (so student on phone can unlock)
 */
export async function cloudSaveRecoveryToken(token: EmergencyRecoveryToken): Promise<void> {
  const current = getLocalRecoveryTokens();
  saveLocalRecoveryTokens([token, ...current]);

  try {
    await setDoc(doc(db, FS_COLLECTIONS.TOKENS, token.id), {
      ...token,
      serverTime: serverTimestamp(),
    });
  } catch (err) {
    console.debug('Failed to sync recovery token to Firestore:', err);
  }
}

/**
 * Validates and redeems recovery token in Firestore
 */
export async function cloudRedeemRecoveryToken(tokenCode: string, studentNis: string): Promise<{ valid: boolean; message: string }> {
  try {
    // 1. Check local first for instantaneous response
    const localTokens = getLocalRecoveryTokens();
    const localMatch = localTokens.find((t) => t.tokenCode.toUpperCase() === tokenCode.trim().toUpperCase());

    if (localMatch) {
      if (localMatch.used) return { valid: false, message: 'Token Pemulihan ini sudah pernah digunakan.' };
      if (Date.now() > localMatch.expiresAt) return { valid: false, message: 'Token Pemulihan ini sudah kadaluarsa (30 menit).' };
      if (localMatch.studentNis && localMatch.studentNis !== studentNis.trim()) {
        return { valid: false, message: `Token ini diterbitkan khusus untuk Absen/NIS ${localMatch.studentNis}.` };
      }
      localMatch.used = true;
      localMatch.usedAt = Date.now();
      saveLocalRecoveryTokens(localTokens);
    }

    // 2. Check and mark in Firestore
    const tokensCol = collection(db, FS_COLLECTIONS.TOKENS);
    const snap = await getDocs(tokensCol);
    let matchedDoc: any = null;

    snap.forEach((d) => {
      const t = d.data() as EmergencyRecoveryToken;
      if (t.tokenCode && t.tokenCode.toUpperCase() === tokenCode.trim().toUpperCase()) {
        matchedDoc = { id: d.id, ...t };
      }
    });

    if (!matchedDoc && !localMatch) {
      return { valid: false, message: 'Kode Token Pemulihan tidak ditemukan di database cloud pengawas.' };
    }

    const activeToken = matchedDoc || localMatch;
    if (activeToken.used && (!localMatch || localMatch.used)) {
      return { valid: false, message: 'Token ini telah terpakai sebelumnya.' };
    }

    if (matchedDoc) {
      await setDoc(doc(db, FS_COLLECTIONS.TOKENS, matchedDoc.id), {
        used: true,
        usedAt: Date.now(),
      }, { merge: true });
    }

    return { valid: true, message: 'Token valid! Sesi ujian Anda berhasil dipulihkan.' };
  } catch (err) {
    console.error('Error redeeming token in Firestore:', err);
    return { valid: false, message: 'Terjadi kesalahan saat memvalidasi token ke cloud.' };
  }
}
