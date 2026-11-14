/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Briefcase,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';
import { AppNotification, Language, MarketplaceRole } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectBooking?: (bookingId: string) => void;
  lang: Language;
  currentUserRole?: MarketplaceRole;
  currentUserId?: string;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onSelectBooking,
  lang,
  currentUserRole,
  currentUserId,
}) => {
  if (!isOpen) return null;

  const isBn = lang === 'bn';

  // Filter notifications relevant to current user
  const relevantNotifications = notifications.filter((n) => {
    if (n.recipientUid && currentUserId) {
      return n.recipientUid === currentUserId;
    }
    if (n.recipientRole && currentUserRole) {
      if (currentUserRole === 'admin') return true; // Admin sees platform notices
      return n.recipientRole === currentUserRole;
    }
    return true;
  });

  const unreadCount = relevantNotifications.filter((n) => !n.isRead).length;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'assignment':
        return <Briefcase className="w-4 h-4 text-amber-500" />;
      case 'qc':
        return <ShieldCheck className="w-4 h-4 text-purple-500" />;
      case 'report':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'correction':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'booking':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return isBn ? 'এইমাত্র' : 'Just now';
      if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60);
        return isBn ? `${mins} মিনিট আগে` : `${mins}m ago`;
      }
      if (diffSec < 86400) {
        const hrs = Math.floor(diffSec / 3600);
        return isBn ? `${hrs} ঘণ্টা আগে` : `${hrs}h ago`;
      }
      return d.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 bg-slate-950/40 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-slideDown"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'বিজ্ঞপ্তি ও আপডেট' : 'In-App Notifications'}
              </h3>
              <span className="text-[11px] text-slate-500">
                {unreadCount > 0
                  ? isBn
                    ? `${unreadCount}টি অপঠিত নোটিফিকেশন`
                    : `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`
                  : isBn
                  ? 'সব পড়া হয়েছে'
                  : 'All caught up'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 transition"
                title={isBn ? 'সব পড়া হয়েছে হিসেবে মার্ক করুন' : 'Mark all read'}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isBn ? 'সব পড়া' : 'Read all'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100">
          {relevantNotifications.length === 0 ? (
            <div className="p-8 text-center space-y-2 text-slate-400">
              <Bell className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs">{isBn ? 'কোনো নতুন বিজ্ঞপ্তি নেই।' : 'No notifications yet.'}</p>
            </div>
          ) : (
            relevantNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) onMarkRead(notif.id);
                  if (notif.bookingId && onSelectBooking) {
                    onSelectBooking(notif.bookingId);
                    onClose();
                  }
                }}
                className={`p-3 rounded-2xl transition cursor-pointer flex items-start gap-3 ${
                  notif.isRead
                    ? 'bg-white hover:bg-slate-50 text-slate-600'
                    : 'bg-emerald-50/60 hover:bg-emerald-50 text-slate-900 font-medium border border-emerald-100'
                }`}
              >
                <div className="p-2 rounded-xl bg-white shadow-2xs border border-slate-100 shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold truncate">
                      {isBn ? notif.titleBn : notif.titleEn}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimestamp(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                    {isBn ? notif.messageBn : notif.messageEn}
                  </p>

                  {notif.bookingId && (
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {notif.bookingId}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 hover:underline">
                        {isBn ? 'বিস্তারিত দেখুন →' : 'View →'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
