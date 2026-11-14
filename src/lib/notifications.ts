/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppNotification, MarketplaceRole } from '../types';
import { isFirebaseConfigured, db, doc, setDoc, updateDoc } from './firebase';

const NOTIFICATIONS_STORAGE_KEY = 'bhumi_in_app_notifications';

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_welcome_1',
    recipientRole: 'customer',
    titleBn: 'স্বাগতম ভূমি ও আমিন প্ল্যাটফর্মে',
    titleEn: 'Welcome to Bhumi O Amin',
    messageBn: 'ডিজিটাল ভূমি পরিমাপ ও অভিজ্ঞ আমিন বুকিং সেবা চালু রয়েছে।',
    messageEn: 'Digital land survey and verified surveyor booking services are active.',
    type: 'system',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function getStoredNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATIONS;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load notifications from storage:', err);
    return DEFAULT_NOTIFICATIONS;
  }
}

export function saveStoredNotifications(list: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
    // Emit notification event for real-time reactivity in UI
    window.dispatchEvent(new CustomEvent('bhumi_notification_event', { detail: list }));
  } catch (err) {
    console.error('Failed to save notifications to storage:', err);
  }
}

export async function sendAppNotification(
  params: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>
): Promise<AppNotification> {
  const notif: AppNotification = {
    ...params,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  const current = getStoredNotifications();
  const updated = [notif, ...current].slice(0, 50); // keep 50 most recent
  saveStoredNotifications(updated);

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'notifications', notif.id), notif);
    } catch (err) {
      console.warn('Firestore notification sync notice:', err);
    }
  }

  return notif;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const current = getStoredNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  saveStoredNotifications(updated);

  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      console.warn('Firestore mark read notice:', err);
    }
  }
}

export async function markAllNotificationsAsRead(
  recipientUid?: string,
  recipientRole?: MarketplaceRole
): Promise<void> {
  const current = getStoredNotifications();
  const updated = current.map((n) => {
    const matchUid = !recipientUid || n.recipientUid === recipientUid;
    const matchRole = !recipientRole || n.recipientRole === recipientRole;
    if (matchUid && matchRole) {
      return { ...n, isRead: true };
    }
    return n;
  });
  saveStoredNotifications(updated);
}

export function subscribeToNotifications(
  callback: (notifications: AppNotification[]) => void
): () => void {
  // Initial emit
  callback(getStoredNotifications());

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<AppNotification[]>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getStoredNotifications());
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === NOTIFICATIONS_STORAGE_KEY) {
      callback(getStoredNotifications());
    }
  };

  window.addEventListener('bhumi_notification_event', handleCustomEvent);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('bhumi_notification_event', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
}

