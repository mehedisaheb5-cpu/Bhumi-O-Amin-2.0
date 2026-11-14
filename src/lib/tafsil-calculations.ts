import { LandAreaUnit } from '../types';
import {
  calculateLandUnits,
  convertAreaToSqFt,
  formatNumberByLang,
  getAreaUnitLabel,
  roundClean,
} from './land-units';

export type TafsilDistributionMode = 'proportional' | 'manual';

export interface TafsilMetadata {
  district: string;       // জেলা
  upazila: string;        // উপজেলা / থানা
  union: string;          // ইউনিয়ন / পৌরসভা
  mouza: string;          // মৌজা
  jlNo: string;           // জে.এল. নং
  dagNo: string;          // দাগ নং (সিএস/এসএ/আরএস/বিএস)
  khatianNo: string;      // খতিয়ান নং
  landClass: string;      // জমির শ্রেণি (নাল, ভিটি, বাগান, ইত্যাদি)
  generalNotes: string;   // সাধারণ মন্তব্য / চৌহদ্দি বিবরণ
}

export interface TafsilOwnerInput {
  id: string;
  name: string;
  relationOrFather?: string; // পিতা/স্বামীর নাম
  shareType: 'percent' | 'fraction';
  requestedPercent: string;
  numeratorStr: string;
  denominatorStr: string;
  manualDecimalStr: string;  // Direct decimal allocation in manual mode
  allottedSide: string;      // নির্ধারিত অংশ/চৌহদ্দি (উদা: উত্তর পার্শ্ব, রাস্তা সংলগ্ন)
  notes: string;             // ব্যক্তিগত মন্তব্য
}

export interface TafsilOwnerCalculated {
  id: string;
  name: string;
  relationOrFather?: string;
  shareType: 'percent' | 'fraction';
  allottedSide: string;
  notes: string;

  // Requested Share Info
  requestedFraction: number;
  requestedPercent: number;
  requestedFractionStr: string;
  requestedDecimal: number;

  // Actual Allocated Land Info
  allocatedPercent: number;
  allocatedSqFt: number;
  allocatedDecimal: number;
  allocatedKatha: number;
  allocatedBigha: number;
  allocatedAcre: number;

  // Variance between requested vs allocated
  varianceDecimal: number;
  variancePercent: number;
  hasVariance: boolean;
}

export interface TafsilDistributionResult {
  mode: TafsilDistributionMode;
  metadata: TafsilMetadata;
  totalLandInput: number;
  areaUnit: LandAreaUnit;
  totalSqFt: number;
  totalDecimal: number;
  totalKatha: number;
  totalBigha: number;
  totalAcre: number;

  owners: TafsilOwnerCalculated[];

  totalAllocatedSqFt: number;
  totalAllocatedDecimal: number;
  totalAllocatedPercent: number;

  remainingSqFt: number;
  remainingDecimal: number;
  remainingKatha: number;
  remainingBigha: number;
  remainingAcre: number;
  remainingPercent: number;

  isExceeded: boolean;
  excessDecimal: number;
  excessPercent: number;
  isBalanced: boolean;
}

export interface TafsilReportA4Data {
  reportTitleBn: string;
  reportTitleEn: string;
  disclaimerBn: string;
  disclaimerEn: string;
  generatedAt: string;
  metadata: TafsilMetadata;
  totalLand: {
    amount: number;
    unit: LandAreaUnit;
    sqFt: number;
    decimal: number;
    katha: number;
    bigha: number;
    acre: number;
  };
  distributionMode: TafsilDistributionMode;
  owners: TafsilOwnerCalculated[];
  allocationSummary: {
    totalAllocatedDecimal: number;
    totalAllocatedPercent: number;
    remainingDecimal: number;
    remainingPercent: number;
    isBalanced: boolean;
  };
}

/**
 * Calculate Tafsil distribution across owners with proportional vs manual modes
 */
export function calculateTafsilDistribution(
  mode: TafsilDistributionMode,
  totalLandAmount: number,
  areaUnit: LandAreaUnit,
  metadata: TafsilMetadata,
  owners: TafsilOwnerInput[],
  lang: 'bn' | 'en' = 'bn'
): TafsilDistributionResult {
  const isBn = lang === 'bn';
  const safeTotal = Math.max(0, totalLandAmount || 0);
  const totalSqFt = convertAreaToSqFt(safeTotal, areaUnit);
  const totalUnits = calculateLandUnits(totalSqFt);
  const totalDecimal = totalUnits.shatangsha;

  let totalAllocatedSqFt = 0;
  let totalAllocatedDecimal = 0;

  const calculatedOwners: TafsilOwnerCalculated[] = owners.map((owner) => {
    // 1. Determine requested fraction and percent
    let reqFraction = 0;
    let reqPercent = 0;
    let reqFractionStr = '';

    if (owner.shareType === 'percent') {
      const p = Math.max(0, parseFloat(owner.requestedPercent) || 0);
      reqPercent = p;
      reqFraction = p / 100;
      reqFractionStr = `${formatNumberByLang(roundClean(p, 2), lang)}%`;
    } else {
      const num = Math.max(0, parseFloat(owner.numeratorStr) || 0);
      const den = Math.max(0.0001, parseFloat(owner.denominatorStr) || 1);
      reqFraction = num / den;
      reqPercent = reqFraction * 100;
      reqFractionStr = `${formatNumberByLang(num, lang)}/${formatNumberByLang(den, lang)} (${formatNumberByLang(roundClean(reqPercent, 2), lang)}%)`;
    }

    const requestedDecimal = roundClean(totalDecimal * reqFraction, 3);

    // 2. Determine actual allocated land based on mode
    let allocatedSqFt = 0;
    let allocatedDec = 0;
    let allocatedPct = 0;

    if (mode === 'proportional') {
      // In proportional mode, allocated follows the requested fraction directly
      allocatedSqFt = totalSqFt * reqFraction;
      allocatedDec = totalDecimal * reqFraction;
      allocatedPct = reqPercent;
    } else {
      // In manual mode, user specifies manual decimal allocation directly
      allocatedDec = Math.max(0, parseFloat(owner.manualDecimalStr) || 0);
      allocatedSqFt = allocatedDec * 435.6;
      allocatedPct = totalDecimal > 0 ? (allocatedDec / totalDecimal) * 100 : 0;
    }

    totalAllocatedSqFt += allocatedSqFt;
    totalAllocatedDecimal += allocatedDec;

    const units = calculateLandUnits(allocatedSqFt);

    const varianceDec = roundClean(allocatedDec - requestedDecimal, 3);
    const variancePct = roundClean(allocatedPct - reqPercent, 3);
    const hasVariance = mode === 'manual' && Math.abs(varianceDec) >= 0.005;

    return {
      id: owner.id,
      name: owner.name.trim() || (isBn ? 'অংশীদার' : 'Owner'),
      relationOrFather: owner.relationOrFather?.trim(),
      shareType: owner.shareType,
      allottedSide: owner.allottedSide.trim(),
      notes: owner.notes.trim(),

      requestedFraction: reqFraction,
      requestedPercent: roundClean(reqPercent, 3),
      requestedFractionStr: reqFractionStr,
      requestedDecimal,

      allocatedPercent: roundClean(allocatedPct, 3),
      allocatedSqFt: roundClean(allocatedSqFt, 2),
      allocatedDecimal: roundClean(allocatedDec, 3),
      allocatedKatha: roundClean(units.katha, 3),
      allocatedBigha: roundClean(units.bigha, 4),
      allocatedAcre: roundClean(units.acre, 4),

      varianceDecimal: varianceDec,
      variancePercent: variancePct,
      hasVariance,
    };
  });

  const totalAllocatedPercent = totalDecimal > 0 ? (totalAllocatedDecimal / totalDecimal) * 100 : 0;
  const isExceeded = totalAllocatedDecimal > totalDecimal + 0.005;
  const isBalanced = Math.abs(totalAllocatedDecimal - totalDecimal) <= 0.005;

  const excessDecimal = isExceeded ? roundClean(totalAllocatedDecimal - totalDecimal, 3) : 0;
  const excessPercent = isExceeded ? roundClean(totalAllocatedPercent - 100, 3) : 0;

  const remainingDecimal = Math.max(0, roundClean(totalDecimal - totalAllocatedDecimal, 3));
  const remainingSqFt = Math.max(0, roundClean(remainingDecimal * 435.6, 2));
  const remainingPercent = Math.max(0, roundClean(100 - totalAllocatedPercent, 3));
  const remainingUnits = calculateLandUnits(remainingSqFt);

  return {
    mode,
    metadata,
    totalLandInput: safeTotal,
    areaUnit,
    totalSqFt: roundClean(totalSqFt, 2),
    totalDecimal: roundClean(totalDecimal, 3),
    totalKatha: roundClean(totalUnits.katha, 3),
    totalBigha: roundClean(totalUnits.bigha, 4),
    totalAcre: roundClean(totalUnits.acre, 4),

    owners: calculatedOwners,

    totalAllocatedSqFt: roundClean(totalAllocatedSqFt, 2),
    totalAllocatedDecimal: roundClean(totalAllocatedDecimal, 3),
    totalAllocatedPercent: roundClean(totalAllocatedPercent, 3),

    remainingSqFt,
    remainingDecimal,
    remainingKatha: roundClean(remainingUnits.katha, 3),
    remainingBigha: roundClean(remainingUnits.bigha, 4),
    remainingAcre: roundClean(remainingUnits.acre, 4),
    remainingPercent,

    isExceeded,
    excessDecimal,
    excessPercent,
    isBalanced,
  };
}

/**
 * Prepares formatted A4 report structure
 */
export function prepareTafsilReportData(
  result: TafsilDistributionResult,
  lang: 'bn' | 'en' = 'bn'
): TafsilReportA4Data {
  return {
    reportTitleBn: 'ডিজিটাল খসড়া বণ্টননামা ও জমি জরিপ তফসিল',
    reportTitleEn: 'Digital Land Partition Draft & Survey Tafsil',
    disclaimerBn:
      'ডিজিটাল হিসাব/খসড়া — এটি আইনগত দলিল বা চূড়ান্ত বণ্টননামা নয়। দলিল রেজিস্ট্রি ও চূড়ান্ত বণ্টনের জন্য সংশ্লিষ্ট সাব-রেজিস্ট্রি অফিস বা দেওয়ানি আদালতের প্রামাণ্য বিধান অনুসরণীয়।',
    disclaimerEn:
      'DIGITAL DRAFT / CALCULATION — Not a legally registered partition deed. For statutory deed registration, consult the sub-registry office or civil court.',
    generatedAt: new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    metadata: result.metadata,
    totalLand: {
      amount: result.totalLandInput,
      unit: result.areaUnit,
      sqFt: result.totalSqFt,
      decimal: result.totalDecimal,
      katha: result.totalKatha,
      bigha: result.totalBigha,
      acre: result.totalAcre,
    },
    distributionMode: result.mode,
    owners: result.owners,
    allocationSummary: {
      totalAllocatedDecimal: result.totalAllocatedDecimal,
      totalAllocatedPercent: result.totalAllocatedPercent,
      remainingDecimal: result.remainingDecimal,
      remainingPercent: result.remainingPercent,
      isBalanced: result.isBalanced,
    },
  };
}
