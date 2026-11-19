/**
 * ভূমি ও আমিন — চূড়ান্ত লোগো (প্রিভিউ 19-C)।
 * B গ্রিড (কাছাকাছি): উপরে স্কেল + গুনিয়া, নিচে ক্লিপবোর্ড + চিকন পেন্সিল + বই;
 * সার্কেলের ভেতরে দুই লাইনে "ভূমি ও" / "আমিন"। সবুজ #065f46 বৃত্ত + সোনালি রিং।
 * এই ফাইল শুধু React import করে — কোনো lib/কম্পোনেন্ট import করে না,
 * তাই স্টার্টআপের module গ্রাফে চক্রের ঝুঁকি নেই।
 */
import React, { useId } from 'react';

/** একটা আইকন: 17×17 সেল, কেন্দ্র (cx, cy) — প্রিভিউ 19-এর LAYOUT হুবহু */
function Icon({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.85)`} data-cx={x} data-cy={y}>
      {children}
    </g>
  );
}

const TEXT_ATTRS = {
  fontFamily: "'Noto Sans Bengali', sans-serif",
  fontWeight: 700,
  fill: '#fde68a',
  textAnchor: 'middle' as const,
  fontSize: 8,
};

export const AppLogo: React.FC<{ size?: number; className?: string }> = ({ size = 48, className }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clipId = `appLogoClip${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="ভূমি ও আমিন"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="48" cy="48" r="43" />
        </clipPath>
      </defs>
      <circle cx="48" cy="48" r="45" fill="#065f46" />
      <circle cx="48" cy="48" r="45" fill="none" stroke="#f59e0b" strokeWidth="3" />
      <g clipPath={`url(#${clipId})`}>
        {/* স্কেল */}
        <Icon x={38} y={30}>
          <rect x="-10" y="-4" width="20" height="8" rx="1.5" fill="#f59e0b" />
          <g stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round">
            <line x1="-6" y1="-4" x2="-6" y2="-1" />
            <line x1="-2" y1="-4" x2="-2" y2="-1" />
            <line x1="2" y1="-4" x2="2" y2="-1" />
            <line x1="6" y1="-4" x2="6" y2="-1" />
          </g>
          <line x1="-8" y1="1.5" x2="8" y2="1.5" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
        </Icon>
        {/* গুনিয়া */}
        <Icon x={58} y={30}>
          <polygon
            points="-8,8 -8,-8 8,8"
            fill="rgba(255,255,255,0.10)"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="-3.5" y1="-3.5" x2="-1" y2="-6" stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="1.5" y1="1.5" x2="4" y2="-1" stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="-4" cy="4" r="1.8" fill="#065f46" stroke="#fde68a" strokeWidth="1.2" />
        </Icon>
        {/* ক্লিপবোর্ড */}
        <Icon x={28} y={54}>
          <rect x="-7" y="-8" width="14" height="17" rx="2" fill="#ffffff" />
          <rect x="-3.5" y="-10" width="7" height="4" rx="1.5" fill="#f59e0b" />
          <g stroke="#d97706" strokeWidth="1.2" strokeLinecap="round">
            <line x1="-4" y1="-3" x2="4" y2="-3" />
            <line x1="-4" y1="1" x2="4" y2="1" />
            <line x1="-4" y1="5" x2="2" y2="5" />
          </g>
        </Icon>
        {/* চিকন পেন্সিল (দেহ ৫) */}
        <Icon x={48} y={54}>
          <g transform="rotate(-45)">
            <rect x="-9" y="-2.5" width="2.5" height="5" fill="#f59e0b" />
            <rect x="-6.5" y="-2.5" width="11" height="5" rx="1" fill="#fde68a" />
            <line x1="-5" y1="0" x2="3.5" y2="0" stroke="#d97706" strokeWidth="0.8" />
            <polygon points="4,-2.5 4,2.5 9,0" fill="#ffffff" />
            <polygon points="6.5,-1.2 6.5,1.2 9,0" fill="#0f172a" />
          </g>
        </Icon>
        {/* বই */}
        <Icon x={68} y={54}>
          <rect x="-9" y="-6" width="5" height="13" rx="1" fill="#ffffff" />
          <rect x="-3" y="-8" width="5" height="15" rx="1" fill="#f59e0b" />
          <rect x="3" y="-5" width="5" height="12" rx="1" fill="#fde68a" />
          <line x1="-6.5" y1="-2" x2="-6.5" y2="4" stroke="#d97706" strokeWidth="0.8" />
          <line x1="-0.5" y1="-4" x2="-0.5" y2="4" stroke="#ffffff" strokeWidth="0.8" />
          <line x1="5.5" y1="-1" x2="5.5" y2="4" stroke="#d97706" strokeWidth="0.8" />
        </Icon>
        {/* সার্কেলের ভেতরে দুই লাইনে "ভূমি ও" / "আমিন" */}
        <text x="48" y="74" {...TEXT_ATTRS}>
          ভূমি ও
        </text>
        <text x="48" y="83" {...TEXT_ATTRS}>
          আমিন
        </text>
      </g>
    </svg>
  );
};

export default AppLogo;
