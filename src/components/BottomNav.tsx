import React from 'react';
import {
  Home,
  Compass,
  Layers,
  Split,
  Banknote,
  FileSpreadsheet,
  Map,
  User,
} from 'lucide-react';
import { NavTab, Language } from '../types';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  lang: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, lang }) => {
  const isBn = lang === 'bn';

  // P1 Mobile: 5 tabs as per user final — Home | দখল পরিমাপ | মৌজা ম্যাপ | সার্ভে রিপোর্ট | এডমিন
  const navItems: Array<{
    id: NavTab;
    activeCheck: (tab: NavTab) => boolean;
    label: string;
    icon: React.ReactNode;
    activeClasses: {
      btn: string;
      icon: string;
      dot: string;
    };
  }> = [
    {
      id: 'home',
      activeCheck: (tab) => tab === 'home',
      label: isBn ? 'হোম' : 'Home',
      icon: <Home className="w-5 h-5" />,
      activeClasses: {
        btn: 'text-emerald-950 font-bold bg-emerald-50 scale-[1.02]',
        icon: 'text-emerald-800',
        dot: 'bg-emerald-700',
      },
    },
    {
      id: 'possession',
      activeCheck: (tab) => tab === 'possession' || tab === 'measure' || tab === 'survey',
      label: isBn ? 'দখল পরিমাপ' : 'Possession',
      icon: <Compass className="w-5 h-5" />,
      activeClasses: {
        btn: 'text-emerald-950 font-bold bg-emerald-50 scale-[1.02]',
        icon: 'text-emerald-800',
        dot: 'bg-emerald-700',
      },
    },
    {
      id: 'maps',
      activeCheck: (tab) => tab === 'maps',
      label: isBn ? 'মৌজা ম্যাপ' : 'Mouza Map',
      icon: <Map className="w-5 h-5" />,
      activeClasses: {
        btn: 'text-sky-950 font-bold bg-sky-50 scale-[1.02]',
        icon: 'text-sky-800',
        dot: 'bg-sky-700',
      },
    },
    {
      id: 'reports',
      activeCheck: (tab) => tab === 'reports',
      label: isBn ? 'সার্ভে রিপোর্ট' : 'Reports',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      activeClasses: {
        btn: 'text-violet-950 font-bold bg-violet-50 scale-[1.02]',
        icon: 'text-violet-800',
        dot: 'bg-violet-700',
      },
    },
    {
      id: 'profile',
      activeCheck: (tab) => tab === 'profile',
      label: isBn ? 'এডমিন' : 'Admin',
      icon: <User className="w-5 h-5" />,
      activeClasses: {
        btn: 'text-slate-900 font-bold bg-slate-100 scale-[1.02]',
        icon: 'text-slate-800',
        dot: 'bg-slate-700',
      },
    },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1 safe-area-pb"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const isActive = item.activeCheck(currentTab);
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all ${
                isActive
                  ? item.activeClasses.btn
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? item.activeClasses.icon : 'text-slate-400'
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight mt-0.5 truncate max-w-full text-center">
                {item.label}
              </span>
              {isActive && (
                <div className={`w-1.5 h-1.5 rounded-full ${item.activeClasses.dot} mt-0.5`} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
