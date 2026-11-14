import { AnaGondaValue, LandAreaUnit } from '../types';
import {
  ANA_GONDA_CONSTANTS,
  anaGondaToShareFraction,
  calculateLandUnits,
  convertAreaToSqFt,
  formatNumberByLang,
  roundClean,
  tilToAnaGonda,
} from './land-units';

export type HisshaShareMode = 'percent' | 'fraction' | 'traditional';

export interface HisshaOwnerInput {
  id: string;
  name: string;
  shareMode: HisshaShareMode;
  // Percentage mode
  percentStr: string;
  // Fraction mode (numerator / denominator)
  numeratorStr: string;
  denominatorStr: string;
  // Traditional Ana-Gonda mode
  anaStr: string;
  gondaStr: string;
  koraStr: string;
  krantiStr: string;
  tilStr: string;
}

export interface HisshaOwnerResult {
  id: string;
  name: string;
  shareMode: HisshaShareMode;
  shareDescription: string;
  shareFraction: number; // 0.0 to 1.0
  sharePercent: number; // 0 to 100
  sqFt: number;
  decimal: number;
  katha: number;
  bigha: number;
  acre: number;
  traditional?: AnaGondaValue;
}

export interface HisshaCalculationResult {
  totalSqFt: number;
  totalDecimal: number;
  totalKatha: number;
  totalBigha: number;
  totalAcre: number;
  owners: HisshaOwnerResult[];
  allocatedPercent: number;
  allocatedFraction: number;
  remainingPercent: number;
  remainingSqFt: number;
  remainingDecimal: number;
  remainingKatha: number;
  remainingBigha: number;
  remainingAcre: number;
  isExceeded: boolean;
  isComplete: boolean;
}

/**
 * Compute the fractional share (0.0 to 1.0) and formatted representation for an owner
 */
export function computeOwnerShareFraction(owner: HisshaOwnerInput, lang: 'bn' | 'en'): {
  fraction: number;
  percent: number;
  description: string;
  traditional?: AnaGondaValue;
} {
  const isBn = lang === 'bn';

  if (owner.shareMode === 'percent') {
    const raw = parseFloat(owner.percentStr);
    const safePercent = isNaN(raw) || raw < 0 ? 0 : raw;
    const fraction = safePercent / 100;
    const desc = `${formatNumberByLang(roundClean(safePercent, 3), lang)}%`;
    return {
      fraction,
      percent: safePercent,
      description: desc,
    };
  }

  if (owner.shareMode === 'fraction') {
    const num = Math.max(0, parseFloat(owner.numeratorStr) || 0);
    const den = Math.max(0.0001, parseFloat(owner.denominatorStr) || 1);
    const fraction = num / den;
    const percent = fraction * 100;
    const desc = `${formatNumberByLang(num, lang)}/${formatNumberByLang(den, lang)} (${formatNumberByLang(roundClean(percent, 2), lang)}%)`;
    return {
      fraction,
      percent,
      description: desc,
    };
  }

  if (owner.shareMode === 'traditional') {
    const ana = Math.max(0, parseInt(owner.anaStr, 10) || 0);
    const gonda = Math.max(0, parseInt(owner.gondaStr, 10) || 0);
    const kora = Math.max(0, parseInt(owner.koraStr, 10) || 0);
    const kranti = Math.max(0, parseInt(owner.krantiStr, 10) || 0);
    const til = Math.max(0, parseInt(owner.tilStr, 10) || 0);

    const val: AnaGondaValue = { ana, gonda, kora, kranti, til };
    const fraction = anaGondaToShareFraction(val);
    const percent = fraction * 100;

    const parts: string[] = [];
    if (ana > 0) parts.push(`${formatNumberByLang(ana, lang)} ${isBn ? 'আনা' : 'Ana'}`);
    if (gonda > 0) parts.push(`${formatNumberByLang(gonda, lang)} ${isBn ? 'গন্ডা' : 'Gonda'}`);
    if (kora > 0) parts.push(`${formatNumberByLang(kora, lang)} ${isBn ? 'কড়া' : 'Kora'}`);
    if (kranti > 0) parts.push(`${formatNumberByLang(kranti, lang)} ${isBn ? 'ক্রান্তি' : 'Kranti'}`);
    if (til > 0) parts.push(`${formatNumberByLang(til, lang)} ${isBn ? 'তিল' : 'Til'}`);

    const tradStr = parts.length > 0 ? parts.join(', ') : (isBn ? '০ আনা' : '0 Ana');
    const desc = `${tradStr} (${formatNumberByLang(roundClean(percent, 2), lang)}%)`;

    return {
      fraction,
      percent,
      description: desc,
      traditional: val,
    };
  }

  return { fraction: 0, percent: 0, description: '0%' };
}

/**
 * Calculate full Hissha breakdown across all owners
 */
export function calculateHisshaDistribution(
  totalLandAmount: number,
  areaUnit: LandAreaUnit,
  owners: HisshaOwnerInput[],
  lang: 'bn' | 'en' = 'bn'
): HisshaCalculationResult {
  const safeTotalAmount = Math.max(0, totalLandAmount || 0);
  const totalSqFt = convertAreaToSqFt(safeTotalAmount, areaUnit);
  const totalUnits = calculateLandUnits(totalSqFt);

  let totalAllocatedFraction = 0;

  const ownerResults: HisshaOwnerResult[] = owners.map((owner) => {
    const { fraction, percent, description, traditional } = computeOwnerShareFraction(owner, lang);
    totalAllocatedFraction += fraction;

    const ownerSqFt = totalSqFt * fraction;
    const units = calculateLandUnits(ownerSqFt);

    return {
      id: owner.id,
      name: owner.name.trim() || (lang === 'bn' ? 'অংশীদার' : 'Owner'),
      shareMode: owner.shareMode,
      shareDescription: description,
      shareFraction: fraction,
      sharePercent: roundClean(percent, 3),
      sqFt: roundClean(ownerSqFt, 2),
      decimal: roundClean(units.shatangsha, 3),
      katha: roundClean(units.katha, 3),
      bigha: roundClean(units.bigha, 4),
      acre: roundClean(units.acre, 4),
      traditional,
    };
  });

  const allocatedPercent = roundClean(totalAllocatedFraction * 100, 3);
  const isExceeded = totalAllocatedFraction > 1.00001;
  const isComplete = Math.abs(totalAllocatedFraction - 1.0) <= 0.0001;

  const remainingFraction = Math.max(0, 1.0 - totalAllocatedFraction);
  const remainingPercent = roundClean(remainingFraction * 100, 3);
  const remainingSqFt = Math.max(0, totalSqFt * remainingFraction);
  const remainingUnits = calculateLandUnits(remainingSqFt);

  return {
    totalSqFt: roundClean(totalSqFt, 2),
    totalDecimal: roundClean(totalUnits.shatangsha, 3),
    totalKatha: roundClean(totalUnits.katha, 3),
    totalBigha: roundClean(totalUnits.bigha, 4),
    totalAcre: roundClean(totalUnits.acre, 4),
    owners: ownerResults,
    allocatedPercent,
    allocatedFraction: roundClean(totalAllocatedFraction, 5),
    remainingPercent,
    remainingSqFt: roundClean(remainingSqFt, 2),
    remainingDecimal: roundClean(remainingUnits.shatangsha, 3),
    remainingKatha: roundClean(remainingUnits.katha, 3),
    remainingBigha: roundClean(remainingUnits.bigha, 4),
    remainingAcre: roundClean(remainingUnits.acre, 4),
    isExceeded,
    isComplete,
  };
}
