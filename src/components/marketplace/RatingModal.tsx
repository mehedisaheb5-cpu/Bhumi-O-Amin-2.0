import React, { useState } from 'react';
import { X, Star, CheckCircle2 } from 'lucide-react';
import { Language, CustomerBooking, CustomerRating } from '../../types';

interface RatingModalProps {
  booking: CustomerBooking | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitRating: (rating: CustomerRating) => void;
  lang: Language;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSubmitRating,
  lang,
}) => {
  if (!isOpen || !booking) return null;

  const isBn = lang === 'bn';
  const [stars, setStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRating: CustomerRating = {
      id: `rate-${Date.now()}`,
      bookingId: booking.id,
      aminId: booking.assignedAminId || 'amin-unknown',
      customerName: booking.customer.name,
      rating: stars,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    };
    onSubmitRating(newRating);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <span className="font-mono text-[11px] text-slate-400">{booking.id}</span>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {isBn ? 'আমিন মূল্যায়ন ও রিভিউ' : 'Rate Surveyor Experience'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center space-y-2">
            <span className="text-xs text-slate-600 block">
              {booking.assignedAminName
                ? isBn
                  ? `${booking.assignedAminName}-এর সেবার মান কেমন ছিল?`
                  : `How was your experience with ${booking.assignedAminName}?`
                : isBn
                ? 'সেবার মান কেমন ছিল?'
                : 'How was the service?'}
            </span>

            {/* Stars */}
            <div className="flex justify-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5].map((st) => (
                <button
                  type="button"
                  key={st}
                  onMouseEnter={() => setHoverStars(st)}
                  onMouseLeave={() => setHoverStars(null)}
                  onClick={() => setStars(st)}
                  className="p-1 transition transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      (hoverStars !== null ? st <= hoverStars : st <= stars)
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-amber-900 font-mono">
              {stars} / 5
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'আপনার মন্তব্য (ঐচ্ছিক)' : 'Feedback (Optional)'}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isBn ? 'পরিমাপের নির্ভুলতা, সময়ানুবর্তিতা বা আচরণ সম্পর্কে লিখুন...' : 'Write about accuracy, punctuality...'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isBn ? 'রেটিং জমা দিন' : 'Submit Rating'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
