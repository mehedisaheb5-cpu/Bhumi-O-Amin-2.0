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
 * সব আইকনের নিচে নাম থাকে (আগে শুধু চালু ট্যাবে নাম দেখা যেত);
 * চালু ট্যাব সবুজ পিল হয়।
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, lang }) => {
  const isBn = lang === 'bn';

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: isBn ? 'হোম' : 'Home', icon: <House className="w-6 h-6" /> },
    { id: 'possession', label: isBn ? 'দখল পরিমাপ' : 'Measure', icon: <Compass className="w-6 h-6" /> },
    { id: 'converter', label: isBn ? 'কনভার্টার' : 'Converter', icon: <ArrowLeftRight className="w-6 h-6" /> },
    { id: 'reports', label: isBn ? 'রিপোর্ট' : 'Reports', icon: <FileText className="w-6 h-6" /> },
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
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-0 rounded-full font-extrabold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                isActive ? 'bg-[#065f46] text-white px-1' : 'text-slate-600'
              }`}
            >
              {item.icon}
              <span className="text-[12px] leading-none truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
