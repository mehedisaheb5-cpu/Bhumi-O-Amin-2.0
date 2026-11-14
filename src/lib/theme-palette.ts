/**
 * Professional Light Multi-Color Palette Tokens for "ভূমি ও আমিন"
 * 
 * Coordinated palette of soft, light colors:
 * - Primary Green: soft mint / light green
 * - Land Measurement: pale sage green
 * - Mouza Map & Drawing: soft sky blue
 * - Khatian Analysis: pale golden yellow / warm cream
 * - Survey Reports: soft lavender
 * - Mouza Rates: light peach / sand
 * - Amin AI: soft aqua / pale teal
 * - Secondary actions: very light neutral gray
 */

export const THEME_PALETTE = {
  primary: {
    bgLight: 'bg-emerald-50',
    borderLight: 'border-emerald-100',
    borderMedium: 'border-emerald-200',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-800',
    badgeBg: 'bg-emerald-100/90',
    badgeText: 'text-emerald-950',
    actionText: 'text-emerald-800 hover:text-emerald-950',
    buttonSolid: 'bg-emerald-800 hover:bg-emerald-700 text-white',
  },
  landMeasure: {
    bgLight: 'bg-emerald-50/70',
    borderLight: 'border-emerald-100',
    borderHover: 'hover:border-emerald-400',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-800',
    badgeBg: 'bg-emerald-100/90',
    badgeText: 'text-emerald-950',
    actionText: 'text-emerald-800 group-hover:text-emerald-950',
  },
  mouzaMap: {
    bgLight: 'bg-sky-50/70',
    borderLight: 'border-sky-100',
    borderHover: 'hover:border-sky-400',
    iconBg: 'bg-sky-50',
    iconText: 'text-sky-800',
    badgeBg: 'bg-sky-100/90',
    badgeText: 'text-sky-950',
    actionText: 'text-sky-800 group-hover:text-sky-950',
    buttonSolid: 'bg-sky-800 hover:bg-sky-700 text-white',
  },
  khatian: {
    bgLight: 'bg-amber-50/60',
    borderLight: 'border-amber-200/80',
    borderHover: 'hover:border-amber-400',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-800',
    badgeBg: 'bg-amber-100/90',
    badgeText: 'text-amber-950',
    actionText: 'text-amber-800 group-hover:text-amber-950',
    buttonSolid: 'bg-amber-800 hover:bg-amber-700 text-white',
  },
  surveyReport: {
    bgLight: 'bg-violet-50/60',
    borderLight: 'border-violet-100',
    borderHover: 'hover:border-violet-400',
    iconBg: 'bg-violet-50',
    iconText: 'text-violet-800',
    badgeBg: 'bg-violet-100/90',
    badgeText: 'text-violet-950',
    actionText: 'text-violet-800 group-hover:text-violet-950',
    buttonSolid: 'bg-violet-800 hover:bg-violet-700 text-white',
  },
  mouzaRate: {
    bgLight: 'bg-orange-50/60',
    borderLight: 'border-orange-100',
    borderHover: 'hover:border-orange-400',
    iconBg: 'bg-orange-50',
    iconText: 'text-orange-800',
    badgeBg: 'bg-orange-100/90',
    badgeText: 'text-orange-950',
    actionText: 'text-orange-800 group-hover:text-orange-950',
    buttonSolid: 'bg-orange-800 hover:bg-orange-700 text-white',
  },
  aminAi: {
    bgLight: 'bg-teal-50/70',
    borderLight: 'border-teal-200/80',
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-800',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-950',
    actionText: 'text-teal-800 hover:text-teal-950',
    buttonSolid: 'bg-teal-800 hover:bg-teal-700 text-white',
  },
} as const;
