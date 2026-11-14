import React from 'react';
import { House, Compass, ArrowLeftRight, FileText } from 'lucide-react';
import { NavTab, Language } from '../types';

interface BottomNavProps {
  currentTab: NavTab | null;
  onSelectTab: (tab: NavTab) => void;
  lang: Language;
}

/**
 * ফিল্ড আমিন — নিচের বার: ডিজাইন C-এর ভাসমান পিল (design-previews/01-home.html)
 * ৪টা ট্যাব: হোম · দখল পরিমাপ · কনভার্টার · রিপোর্ট।
 * চালু ট্যাব চওড়া সবুজ পিল হয়ে নাম দেখায়; বাকিগুলো বড় আইকন।
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, lang }) => {
  const isBn = lang === 'bn';

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: isBn ? 'হোম' : 'Home', icon: <House className="w-[26px] h-[26px]" /> },
    { id: 'possession', label: isBn ? 'দখল পরিমাপ' : 'Measure', icon: <Compass className="w-[26px] h-[26px]" /> },
    { id: 'converter', label: isBn ? 'কনভার্টার' : 'Converter', icon: <ArrowLeftRight className="w-[26px] h-[26px]" /> },
    { id: 'reports', label: isBn ? 'রিপোর্ট' : 'Reports', icon: <FileText className="w-[26px] h-[26px]" /> },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      aria-label={isBn ? 'প্রধান মেনু' : 'Main menu'}
      className="fixed left-3.5 right-3.5 z-30 pointer-events-none"
      style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto max-w-md mx-auto flex gap-1 bg-white rounded-full p-1.5 shadow-[0_10px_30px_rgba(15,23,42,.18)] border border-slate-100">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{ flexGrow: isActive ? 2.2 : 1, flexBasis: 0 }}
              className={`flex items-center justify-center gap-1.5 min-h-[56px] rounded-full font-extrabold text-[15px] whitespace-nowrap transition-all duration-200 active:scale-95 ${
                isActive ? 'bg-[#065f46] text-white px-3' : 'text-slate-600'
              }`}
            >
              {item.icon}
              {isActive && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
