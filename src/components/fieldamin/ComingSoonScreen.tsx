/** যে ফিচার পরের ধাপে তৈরি হবে, তার জন্য সাময়িক পাতা (সাইড প্যানেলের মেনু যেন কাজ করে)। */
import React from 'react';
import { Spline, Lock, Compass } from 'lucide-react';

interface Props {
  kind: 'handmap' | 'admin';
  onGoMeasure: () => void;
}

export const ComingSoonScreen: React.FC<Props> = ({ kind, onGoMeasure }) => {
  const isMap = kind === 'handmap';
  return (
    <div className="pt-2 space-y-3 animate-fadeIn">
      <div className="bg-white rounded-[28px] p-6 text-center shadow-[0_4px_14px_rgba(15,23,42,.06)]">
        <div
          className={`w-[72px] h-[72px] mx-auto rounded-3xl flex items-center justify-center ${
            isMap ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isMap ? <Spline className="w-10 h-10" /> : <Lock className="w-10 h-10" />}
        </div>
        <h2 className="mt-3 text-[22px] font-extrabold text-slate-900">{isMap ? 'হ্যান্ড ম্যাপ' : 'এডমিন'}</h2>
        <p className="mt-1 text-base font-semibold text-slate-600 leading-relaxed">
          {isMap
            ? 'এই অংশ ধাপ ৬-এ তৈরি হবে: আঁকা নকশা থেকে হাতে আঁকা ধাঁচের ম্যাপ, দাগ নম্বর, বাহুর মাপ, উত্তর দিক।'
            : 'এই অংশ ধাপ ৮-এ তৈরি হবে: PIN দিয়ে খুলবে; রিপোর্ট, সেটিংস (নাম, ফোন, ছবি, লোগো) ও ব্যাকআপ।'}
        </p>
        <span className="inline-block mt-3 text-sm font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          শীঘ্রই আসছে
        </span>
      </div>
      {isMap && (
        <button
          onClick={onGoMeasure}
          className="w-full min-h-[60px] rounded-[22px] bg-[#065f46] text-white text-[17px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
        >
          <Compass className="w-6 h-6" />
          এখন দখল পরিমাপে যান
        </button>
      )}
    </div>
  );
};
