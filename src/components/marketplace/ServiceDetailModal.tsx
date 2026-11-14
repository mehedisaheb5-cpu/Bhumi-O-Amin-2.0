import React from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Calendar,
  Compass,
  Ruler,
  ShieldCheck,
  PenTool,
  Layers,
  FileCheck,
  FileText,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import { Language, MarketplaceService } from '../../types';

interface ServiceDetailModalProps {
  service: MarketplaceService | null;
  isOpen: boolean;
  onClose: () => void;
  onBookService: (service: MarketplaceService) => void;
  lang: Language;
}

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  service,
  isOpen,
  onClose,
  onBookService,
  lang,
}) => {
  if (!isOpen || !service) return null;

  const isBn = lang === 'bn';

  const renderIcon = (iconName: string) => {
    const props = { className: 'w-6 h-6 text-emerald-800' };
    switch (iconName) {
      case 'Compass':
        return <Compass {...props} />;
      case 'Ruler':
        return <Ruler {...props} />;
      case 'ShieldCheck':
        return <ShieldCheck {...props} />;
      case 'PenTool':
        return <PenTool {...props} />;
      case 'Layers':
        return <Layers {...props} />;
      case 'FileCheck':
        return <FileCheck {...props} />;
      case 'FileText':
        return <FileText {...props} />;
      case 'Wrench':
      default:
        return <Wrench {...props} />;
    }
  };

  const includedList = isBn ? service.includedBn : service.includedEn;
  const customerInfoList = isBn ? service.requiredCustomerInfoBn : service.requiredCustomerInfoEn;
  const landInfoList = isBn ? service.requiredLandInfoBn : service.requiredLandInfoEn;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-xl max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 flex items-center justify-center shrink-0">
              {renderIcon(service.iconName)}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isBn ? service.nameBn : service.nameEn}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? service.shortDescBn : service.shortDescEn}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-slate-700">
          {/* Main Description */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <p className="leading-relaxed text-slate-800">
              {isBn ? service.descriptionBn : service.descriptionEn}
            </p>
          </div>

          {/* Quick Metrics (Pricing & Time) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] text-slate-500 block font-medium">
                {isBn ? 'প্রাক্কলিত সার্ভিস ফি' : 'Estimated Base Fee'}
              </span>
              <span className="text-base sm:text-lg font-bold text-emerald-800">
                ৳{service.baseFee.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {isBn ? `+ প্ল্যাটফর্ম ফি ৳${service.platformFee}` : `+ Platform Fee ৳${service.platformFee}`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] text-slate-500 block font-medium">
                {isBn ? 'সম্ভাব্য সময়সীমা' : 'Completion Time'}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm sm:text-base font-bold text-slate-800">
                  {service.estimatedDays}
                </span>
              </div>
            </div>
          </div>

          {/* What is included */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{isBn ? 'এই সেবায় যা অন্তর্ভুক্ত রয়েছে:' : 'What is Included in this Service:'}</span>
            </h4>
            <ul className="space-y-1.5 pl-1">
              {includedList.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Required Information */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
              <FileCheck2 className="w-4 h-4 text-blue-700" />
              <span>{isBn ? 'প্রয়োজনীয় তথ্য ও নথিপত্র:' : 'Required Customer & Land Information:'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] sm:text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-1">
                  {isBn ? 'গ্রাহকের তথ্য:' : 'Customer Details:'}
                </span>
                <ul className="space-y-1 text-slate-600 list-disc list-inside">
                  {customerInfoList.map((info, i) => (
                    <li key={i}>{info}</li>
                  ))}
                </ul>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-1">
                  {isBn ? 'জমির তথ্য:' : 'Land Details:'}
                </span>
                <ul className="space-y-1 text-slate-600 list-disc list-inside">
                  {landInfoList.map((info, i) => (
                    <li key={i}>{info}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Legal Disclaimer */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 text-amber-900 text-[11px] leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">
                {isBn ? 'আইনি ও পেশাদার সতর্কতা:' : 'Legal & Professional Notice:'}
              </span>
              <p>{isBn ? service.disclaimerBn : service.disclaimerEn}</p>
            </div>
          </div>
        </div>

        {/* Footer with Action Button */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">
              {isBn ? 'মোট সম্ভাব্য ফি' : 'Total Estimated Fee'}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-900">
              ৳{(service.baseFee + service.platformFee).toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => onBookService(service)}
            className="px-6 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm hover:shadow transition active:scale-95"
          >
            <span>{isBn ? 'সেবা বুক করুন' : 'Book Service'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
