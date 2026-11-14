import React, { useState } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';
import { Language, CustomerBooking, CustomerComplaint } from '../../types';

interface ComplaintModalProps {
  booking: CustomerBooking | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitComplaint: (complaint: CustomerComplaint) => void;
  lang: Language;
}

export const ComplaintModal: React.FC<ComplaintModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSubmitComplaint,
  lang,
}) => {
  if (!isOpen || !booking) return null;

  const isBn = lang === 'bn';
  const [issueType, setIssueType] = useState<string>(
    isBn ? 'পরিমাপ সংক্রান্ত অমিল' : 'Measurement Discrepancy'
  );
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError(isBn ? 'অনুগ্রহ করে সমস্যার বিবরণ লিখুন।' : 'Please describe the issue.');
      return;
    }

    const newComplaint: CustomerComplaint = {
      id: `comp-${Date.now()}`,
      bookingId: booking.id,
      customerName: booking.customer.name,
      customerMobile: booking.customer.mobile,
      aminId: booking.assignedAminId,
      issueType,
      description: description.trim(),
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };

    onSubmitComplaint(newComplaint);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {isBn ? 'অভিযোগ বা আপত্তি দাখিল' : 'File a Complaint / Dispute'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
          {isBn
            ? 'প্ল্যাটফর্ম সুপারভাইজার আপনার অভিযোগটি নিরপেক্ষভাবে তদন্ত করবে এবং প্রয়োজনে পুনঃপরিমাপ বা সংশোধন নিশ্চিত করবে।'
            : 'Platform administration independently investigates complaints and may mandate re-survey if needed.'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'অভিযোগের ধরন' : 'Issue Category'}
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white outline-none focus:border-rose-500"
            >
              <option value={isBn ? 'পরিমাপ সংক্রান্ত অমিল' : 'Measurement Discrepancy'}>
                {isBn ? 'পরিমাপ সংক্রান্ত অমিল' : 'Measurement Discrepancy'}
              </option>
              <option value={isBn ? 'সময়ানুবর্তিতা বা অনুপস্থিতি' : 'Surveyor Delay / Absent'}>
                {isBn ? 'সময়ানুবর্তিতা বা অনুপস্থিতি' : 'Surveyor Delay / Absent'}
              </option>
              <option value={isBn ? 'অপ্রত্যাশিত অতিরিক্ত ফি দাবি' : 'Unexpected Fee Demand'}>
                {isBn ? 'অপ্রত্যাশিত অতিরিক্ত ফি দাবি' : 'Unexpected Fee Demand'}
              </option>
              <option value={isBn ? 'রিপোর্ট বা নকশায় ভুল' : 'Report / Drawing Inaccuracy'}>
                {isBn ? 'রিপোর্ট বা নকশায় ভুল' : 'Report / Drawing Inaccuracy'}
              </option>
              <option value={isBn ? 'অন্যান্য পেশাদার সমস্যা' : 'Other Professional Concern'}>
                {isBn ? 'অন্যান্য পেশাদার সমস্যা' : 'Other Professional Concern'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'সমস্যার বিস্তারিত বিবরণ *' : 'Detailed Description *'}
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError('');
              }}
              placeholder={isBn ? 'ঘটনাবলী ও আপনার দাবি স্পষ্টভাবে লিখুন...' : 'Describe what occurred...'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-rose-500"
            />
            {error && <span className="text-[11px] text-rose-600 block mt-0.5">{error}</span>}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isBn ? 'অভিযোগ জমা দিন' : 'Submit to Admin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
