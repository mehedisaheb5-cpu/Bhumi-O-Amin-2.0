import React, { useState, useEffect } from 'react';
import { Globe, Compass, MessageSquare, User, Shield, Briefcase, LogIn, LogOut, Bell } from 'lucide-react';
import { Language, AppNotification } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './auth/AuthModal';
import { NotificationDrawer } from './notifications/NotificationDrawer';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../lib/notifications';

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  onOpenChat: () => void;
  onSelectBooking?: (bookingId: string) => void;
  onHomeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLang,
  onOpenChat,
  onSelectBooking,
  onHomeClick,
}) => {
  const isBn = lang === 'bn';
  const { currentUser, role, loading, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const displayRoleLabel =
    role === 'admin'
      ? (isBn ? 'অ্যাডমিন' : 'Admin')
      : role === 'amin'
      ? (isBn ? 'আমিন' : 'Amin')
      : (isBn ? 'জমির মালিক' : 'Landowner');

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, []);

  const relevantNotifications = notifications.filter((n) => {
    if (n.recipientUid && currentUser?.id) {
      return n.recipientUid === currentUser.id;
    }
    if (n.recipientRole && role) {
      if (role === 'admin') return true;
      return n.recipientRole === role;
    }
    return true;
  });

  const unreadCount = relevantNotifications.filter((n) => !n.isRead).length;

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur-md text-slate-900 shadow-2xs border-b border-emerald-100/90"
    >
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand Identity - Clickable to go to Home */}
        <button
          id="header-brand-btn"
          onClick={onHomeClick}
          className="flex items-center gap-2.5 text-left focus:outline-hidden group min-w-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center shadow-2xs group-hover:bg-emerald-800 group-hover:text-white transition-colors">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-emerald-900 transition-colors whitespace-nowrap truncate">
                {isBn ? 'ভূমি ও আমিন' : 'Bhumi O Amin'}
              </h1>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-md bg-emerald-100/80 text-emerald-950 border border-emerald-200 hidden sm:inline-block">
                {role === 'admin'
                  ? (isBn ? 'অ্যাডমিন' : 'Admin')
                  : role === 'amin'
                  ? (isBn ? 'আমিন' : 'Amin')
                  : (isBn ? 'ডিজিটাল' : 'Pro')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              {isBn ? 'জমি বুঝুন, ঝুঁকি কমান' : 'Understand Land, Minimize Risk'}
            </p>
          </div>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Notifications Bell */}
          <button
            id="header-notifications-btn"
            onClick={() => setIsNotificationDrawerOpen(true)}
            className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 transition active:scale-95"
            title={isBn ? 'নোটিফিকেশন ও অ্যালার্ট' : 'Notifications'}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-slate-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-2xs animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Auth Status Controls */}
          {loading && !currentUser ? (
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-xs text-slate-500">
              <span className="w-3 h-3 border-2 border-slate-300 border-t-emerald-700 rounded-full animate-spin" />
              <span className="text-[11px] font-medium">{isBn ? 'লোড হচ্ছে...' : 'Loading...'}</span>
            </div>
          ) : currentUser ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                id="header-user-badge-btn"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 sm:px-2.5 py-1 text-xs text-emerald-950 font-bold transition active:scale-95"
                title={`${currentUser.name} (${currentUser.email})`}
              >
                {role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5 text-emerald-800" />
                ) : role === 'amin' ? (
                  <Briefcase className="w-3.5 h-3.5 text-emerald-800" />
                ) : (
                  <User className="w-3.5 h-3.5 text-emerald-800" />
                )}
                <span className="max-w-[75px] sm:max-w-[95px] truncate text-[11px] hidden sm:inline">
                  {displayRoleLabel}
                </span>
              </button>

              <button
                id="header-logout-btn"
                onClick={async () => {
                  await logout();
                }}
                className="flex items-center gap-1 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200/90 text-red-700 px-2 sm:px-2.5 py-1 text-xs font-semibold transition active:scale-95"
                title={isBn ? 'লগআউট করুন' : 'Logout'}
              >
                <LogOut className="w-3.5 h-3.5 text-red-600" />
                <span className="text-[11px] hidden sm:inline">{isBn ? 'লগআউট করুন' : 'Logout'}</span>
              </button>
            </div>
          ) : (
            <button
              id="header-login-btn"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-bold shadow-2xs transition active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="text-[11px]">{isBn ? 'লগইন করুন' : 'Log In'}</span>
            </button>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton lang={lang} />

          {/* Language Switch */}
          <button
            id="lang-toggle-btn"
            onClick={onToggleLang}
            className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 px-2 sm:px-2.5 py-1 text-xs font-bold text-slate-700 transition active:scale-95"
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px]">{isBn ? 'EN' : 'বাং'}</span>
          </button>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        lang={lang}
        initialMode={currentUser ? undefined : 'login'}
      />

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        onMarkRead={markNotificationAsRead}
        onMarkAllRead={markAllNotificationsAsRead}
        onSelectBooking={(bId) => {
          setIsNotificationDrawerOpen(false);
          if (onSelectBooking) onSelectBooking(bId);
        }}
        lang={lang}
        currentUserRole={role}
        currentUserId={currentUser?.id}
      />
    </header>
  );
};
