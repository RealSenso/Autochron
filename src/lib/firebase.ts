import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { UserScheduleData } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function saveScheduleBySyncCode(syncCode: string, data: UserScheduleData): Promise<void> {
  if (!syncCode || syncCode.length < 6) return;
  const formattedCode = syncCode.toUpperCase().trim();
  const path = `sync_schedules/${formattedCode}`;
  try {
    const docRef = doc(db, 'sync_schedules', formattedCode);
    
    const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
      return value === undefined ? null : value;
    }));
    cleaned.updatedAt = new Date().toISOString();
    
    await setDoc(docRef, cleaned, { merge: true });
  } catch (err) {
    console.error('Failed to save data directly to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchScheduleBySyncCode(syncCode: string): Promise<UserScheduleData | null> {
  if (!syncCode || syncCode.length < 6) return null;
  const formattedCode = syncCode.toUpperCase().trim();
  const path = `sync_schedules/${formattedCode}`;
  try {
    const docRef = doc(db, 'sync_schedules', formattedCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserScheduleData;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch data directly from Firestore:', err);
    handleFirestoreError(err, OperationType.GET, path);
  }
}
