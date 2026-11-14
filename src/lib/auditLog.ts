import { AuditLogEntry, UserRole } from '../types';
import { db, isFirebaseConfigured, doc, setDoc, OperationType, handleFirestoreError } from './firebase';

const AUDIT_STORAGE_KEY = 'bhumi-amin-audit-logs';

export function getLocalAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load local audit logs', err);
    return [];
  }
}

export function saveLocalAuditLog(entry: AuditLogEntry): void {
  try {
    const logs = getLocalAuditLogs();
    const updated = [entry, ...logs].slice(0, 200); // keep last 200 logs locally
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save audit log locally', err);
  }
}

export async function logAuditEvent(params: {
  actorUserId: string;
  actorRole: UserRole | 'system';
  action: string;
  entityType: 'booking' | 'amin' | 'report' | 'survey' | 'complaint' | 'service' | 'user' | 'payment';
  entityId: string;
  details?: string;
}): Promise<AuditLogEntry> {
  const timestamp = new Date().toISOString();
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Redact any sensitive information if present in details
  let sanitizedDetails = params.details;
  if (sanitizedDetails) {
    sanitizedDetails = sanitizedDetails
      .replace(/password[:=]\s*[^\s,]+/gi, 'password=[REDACTED]')
      .replace(/secret[:=]\s*[^\s,]+/gi, 'secret=[REDACTED]')
      .replace(/token[:=]\s*[^\s,]+/gi, 'token=[REDACTED]');
  }

  const entry: AuditLogEntry = {
    id,
    actorUserId: params.actorUserId,
    uid: params.actorUserId,
    actorRole: params.actorRole,
    role: params.actorRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    target: `${params.entityType}/${params.entityId}`,
    timestamp,
    details: sanitizedDetails,
  };

  // Always keep local copy for offline resilience
  saveLocalAuditLog(entry);

  // If cloud is connected, persist to Firestore auditLogs collection
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'auditLogs', id), entry);
    } catch (error) {
      console.warn('Could not write audit log to cloud, retained locally:', error);
      // We do not crash the app on audit write failure
    }
  }

  return entry;
}
