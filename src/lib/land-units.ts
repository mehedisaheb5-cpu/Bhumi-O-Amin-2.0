import { AnaGondaValue, CalculationResult, LandAreaUnit, LengthUnit } from '../types';

/**
 * Bangladesh Standard Land Measurement Units and Constants
 * --------------------------------------------------------
 * Verified core Bangladesh area standards:
 * - 1 decimal / shotok = 435.6 sq ft
 * - 1 katha = 720 sq ft
 * - 1 bigha = 20 katha = 14,400 sq ft
 * - 1 acre = 100 decimal = 43,560 sq ft
 * - 1 sq meter = 10.76391 sq ft (1 sq ft = 0.092903 sq meter)
 */

export const LAND_CONSTANTS = {
  // Core Area Standards in Square Feet
  SQFT_PER_DECIMAL: 435.6,
  SQFT_PER_KATHA: 720.0,
  KATHA_PER_BIGHA: 20.0,
  SQFT_PER_BIGHA: 14400.0, // 20 * 720
  DECIMAL_PER_ACRE: 100.0,
  SQFT_PER_ACRE: 43560.0, // 100 * 435.6
  SQFT_PER_SQMETER: 10.76391, // 1 sq meter = 10.76391 sq ft

  // Length Units in Feet
  FEET_PER_METER: 3.28084,
  FEET_PER_LINK: 0.66, // 1 Gunter link = 7.92 inches = 0.66 ft
  FEET_PER_YARD: 3.0, // 1 Yard / গজ = 3 ft
  FEET_PER_HAAT: 1.5, // 1 Haat / হাত = 18 inches = 1.5 ft (standard BD land measure)

  // Traditional / Regional Units (Standard Surveyor Baseline)
  // Note: Regional definitions like Gonda, Kani may vary in Chittagong, Sylhet, Barishal, etc.
  SQFT_PER_GONDA: 180.0, // 1 Katha = 4 Gonda (180 sq ft each)
  SQFT_PER_KORA: 45.0, // 1 Gonda = 4 Kora (45 sq ft each)
  SQFT_PER_KRANTI: 15.0, // 1 Kora = 3 Kranti (15 sq ft each)
  SQFT_PER_TIL: 0.75, // 1 Kranti = 20 Til (0.75 sq ft each)
} as const;

/**
 * Convert any linear dimension in the selected unit to Feet
 */
export function convertToFeet(value: number, unit: LengthUnit): number {
  if (!value || isNaN(value) || value <= 0) return 0;
  switch (unit) {
    case 'meter':
      return value * LAND_CONSTANTS.FEET_PER_METER;
    case 'link':
      return value * LAND_CONSTANTS.FEET_PER_LINK;
    case 'yard':
      return value * LAND_CONSTANTS.FEET_PER_YARD;
    case 'haat':
      return value * LAND_CONSTANTS.FEET_PER_HAAT;
    case 'feet':
    default:
      return value;
  }
}

/**
 * Convert Feet to target linear unit
 */
export function convertFeetToUnit(feet: number, unit: LengthUnit): number {
  if (!feet || isNaN(feet) || feet <= 0) return 0;
  switch (unit) {
    case 'meter':
      return feet / LAND_CONSTANTS.FEET_PER_METER;
    case 'link':
      return feet / LAND_CONSTANTS.FEET_PER_LINK;
    case 'yard':
      return feet / LAND_CONSTANTS.FEET_PER_YARD;
    case 'haat':
      return feet / LAND_CONSTANTS.FEET_PER_HAAT;
    case 'feet':
    default:
      return feet;
  }
}

/**
 * Calculate all Bangladesh core and regional area units from square feet.
 * Uses strict verified ratios and clean precision formatting.
 */
export function calculateLandUnits(sqFt: number, perimeterFt?: number): CalculationResult {
  const safeSqFt = Math.max(0, sqFt || 0);

  const sqMeter = safeSqFt / LAND_CONSTANTS.SQFT_PER_SQMETER;
  const shatangsha = safeSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL;
  const katha = safeSqFt / LAND_CONSTANTS.SQFT_PER_KATHA;
  const bigha = safeSqFt / LAND_CONSTANTS.SQFT_PER_BIGHA;
  const acre = safeSqFt / LAND_CONSTANTS.SQFT_PER_ACRE;

  // Traditional regional breakdowns
  const gonda = safeSqFt / LAND_CONSTANTS.SQFT_PER_GONDA;
  const kora = safeSqFt / LAND_CONSTANTS.SQFT_PER_KORA;
  const kranti = safeSqFt / LAND_CONSTANTS.SQFT_PER_KRANTI;
  const til = safeSqFt / LAND_CONSTANTS.SQFT_PER_TIL;

  return {
    sqFt: roundClean(safeSqFt, 2),
    sqMeter: roundClean(sqMeter, 2),
    shatangsha: roundClean(shatangsha, 3),
    katha: roundClean(katha, 3),
    bigha: roundClean(bigha, 4),
    acre: roundClean(acre, 4),
    perimeterFt: perimeterFt !== undefined ? roundClean(perimeterFt, 2) : undefined,
    gonda: roundClean(gonda, 2),
    kora: roundClean(kora, 2),
    kranti: roundClean(kranti, 2),
    til: roundClean(til, 1),
  };
}

/**
 * Clean floating point rounding without exponential noise or unnecessary trailing zeros
 */
export function roundClean(value: number, decimals: number = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Convert numbers to Bengali digits
 */
export function toBengaliNumerals(num: number | string): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (w) => bnDigits[+w]);
}

/**
 * Format number according to app language
 */
export function formatNumberByLang(num: number | string, lang: 'bn' | 'en'): string {
  if (lang === 'bn') {
    return toBengaliNumerals(num);
  }
  return String(num);
}

/**
 * Returns human-readable label for length unit
 */
export function getUnitLabel(unit: LengthUnit, lang: 'bn' | 'en'): string {
  if (lang === 'bn') {
    switch (unit) {
      case 'feet':
        return 'ফুট';
      case 'meter':
        return 'মিটার';
      case 'link':
        return 'লিংক (কড়ি)';
      case 'yard':
        return 'গজ';
      case 'haat':
        return 'হাত';
      default:
        return unit;
    }
  } else {
    switch (unit) {
      case 'feet':
        return 'Feet (ft)';
      case 'meter':
        return 'Meter (m)';
      case 'link':
        return 'Link';
      case 'yard':
        return 'Yard (yd)';
      case 'haat':
        return 'Haat';
      default:
        return unit;
    }
  }
}

/**
 * Convert any area in specified unit to Square Feet
 */
export function convertAreaToSqFt(value: number, unit: LandAreaUnit): number {
  if (!value || isNaN(value) || value <= 0) return 0;
  switch (unit) {
    case 'decimal':
      return value * LAND_CONSTANTS.SQFT_PER_DECIMAL;
    case 'katha':
      return value * LAND_CONSTANTS.SQFT_PER_KATHA;
    case 'bigha':
      return value * LAND_CONSTANTS.SQFT_PER_BIGHA;
    case 'acre':
      return value * LAND_CONSTANTS.SQFT_PER_ACRE;
    case 'sqMeter':
      return value * LAND_CONSTANTS.SQFT_PER_SQMETER;
    case 'sqFt':
    default:
      return value;
  }
}

/**
 * Convert Square Feet to target area unit
 */
export function convertSqFtToAreaUnit(sqFt: number, unit: LandAreaUnit): number {
  if (!sqFt || isNaN(sqFt) || sqFt <= 0) return 0;
  switch (unit) {
    case 'decimal':
      return sqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL;
    case 'katha':
      return sqFt / LAND_CONSTANTS.SQFT_PER_KATHA;
    case 'bigha':
      return sqFt / LAND_CONSTANTS.SQFT_PER_BIGHA;
    case 'acre':
      return sqFt / LAND_CONSTANTS.SQFT_PER_ACRE;
    case 'sqMeter':
      return sqFt / LAND_CONSTANTS.SQFT_PER_SQMETER;
    case 'sqFt':
    default:
      return sqFt;
  }
}

/**
 * Returns human-readable label for land area unit
 */
export function getAreaUnitLabel(unit: LandAreaUnit, lang: 'bn' | 'en'): string {
  if (lang === 'bn') {
    switch (unit) {
      case 'decimal':
        return 'শতাংশ (শতক)';
      case 'sqFt':
        return 'বর্গফুট';
      case 'katha':
        return 'কাঠা';
      case 'bigha':
        return 'বিঘা';
      case 'acre':
        return 'একর';
      case 'sqMeter':
        return 'বর্গমিটার';
      default:
        return unit;
    }
  } else {
    switch (unit) {
      case 'decimal':
        return 'Decimal';
      case 'sqFt':
        return 'Sq. Ft.';
      case 'katha':
        return 'Katha';
      case 'bigha':
        return 'Bigha';
      case 'acre':
        return 'Acre';
      case 'sqMeter':
        return 'Sq. Meter';
      default:
        return unit;
    }
  }
}

/**
 * Traditional Ana-Gonda Land Math Constants
 * In Bangladesh Land Records (CS, SA, RS, BS):
 * - 16 Ana = 1 whole (100% share / সম্পূর্ণ অংশ)
 * - 1 Ana = 20 Gonda
 * - 1 Gonda = 4 Kora
 * - 1 Kora = 3 Kranti
 * - 1 Kranti = 20 Til
 * Total Til in 1 whole (16 Ana) = 16 * 20 * 4 * 3 * 20 = 76,800 Til.
 */
export const ANA_GONDA_CONSTANTS = {
  TIL_PER_KRANTI: 20,
  KRANTI_PER_KORA: 3,
  KORA_PER_GONDA: 4,
  GONDA_PER_ANA: 20,
  ANA_PER_WHOLE: 16,
  TOTAL_TIL_IN_WHOLE: 76800, // 16 * 20 * 4 * 3 * 20
  TIL_PER_KORA: 60, // 3 * 20
  TIL_PER_GONDA: 240, // 4 * 60
  TIL_PER_ANA: 4800, // 20 * 240
} as const;

/**
 * Convert Ana-Gonda-Kora-Kranti-Til to total Til
 */
export function anaGondaToTil(v: AnaGondaValue): number {
  const ana = Math.max(0, v.ana || 0);
  const gonda = Math.max(0, v.gonda || 0);
  const kora = Math.max(0, v.kora || 0);
  const kranti = Math.max(0, v.kranti || 0);
  const til = Math.max(0, v.til || 0);

  return (
    ana * ANA_GONDA_CONSTANTS.TIL_PER_ANA +
    gonda * ANA_GONDA_CONSTANTS.TIL_PER_GONDA +
    kora * ANA_GONDA_CONSTANTS.TIL_PER_KORA +
    kranti * ANA_GONDA_CONSTANTS.TIL_PER_KRANTI +
    til
  );
}

/**
 * Normalize total Til into canonical Ana, Gonda, Kora, Kranti, Til
 */
export function tilToAnaGonda(totalTil: number): AnaGondaValue {
  const safeTil = Math.max(0, Math.round(totalTil || 0));
  const t = safeTil % ANA_GONDA_CONSTANTS.TIL_PER_KRANTI;
  const rem1 = Math.floor(safeTil / ANA_GONDA_CONSTANTS.TIL_PER_KRANTI);

  const kr = rem1 % ANA_GONDA_CONSTANTS.KRANTI_PER_KORA;
  const rem2 = Math.floor(rem1 / ANA_GONDA_CONSTANTS.KRANTI_PER_KORA);

  const ko = rem2 % ANA_GONDA_CONSTANTS.KORA_PER_GONDA;
  const rem3 = Math.floor(rem2 / ANA_GONDA_CONSTANTS.KORA_PER_GONDA);

  const g = rem3 % ANA_GONDA_CONSTANTS.GONDA_PER_ANA;
  const a = Math.floor(rem3 / ANA_GONDA_CONSTANTS.GONDA_PER_ANA);

  return {
    ana: a,
    gonda: g,
    kora: ko,
    kranti: kr,
    til: t,
  };
}

/**
 * Normalize an AnaGondaValue structure (e.g. if kora >= 4 or til >= 20)
 */
export function normalizeAnaGonda(v: AnaGondaValue): AnaGondaValue {
  return tilToAnaGonda(anaGondaToTil(v));
}

/**
 * Add two AnaGonda values with proper carry
 */
export function addAnaGonda(a: AnaGondaValue, b: AnaGondaValue): AnaGondaValue {
  const tilA = anaGondaToTil(a);
  const tilB = anaGondaToTil(b);
  return tilToAnaGonda(tilA + tilB);
}

/**
 * Subtract AnaGonda value B from A (returns normalized result clamped at 0)
 */
export function subtractAnaGonda(a: AnaGondaValue, b: AnaGondaValue): AnaGondaValue {
  const tilA = anaGondaToTil(a);
  const tilB = anaGondaToTil(b);
  return tilToAnaGonda(Math.max(0, tilA - tilB));
}

/**
 * Calculate share fraction (0.0 to 1.0) of a traditional AnaGonda value against 16 Ana whole
 */
export function anaGondaToShareFraction(v: AnaGondaValue): number {
  const til = anaGondaToTil(v);
  return til / ANA_GONDA_CONSTANTS.TOTAL_TIL_IN_WHOLE;
}

/**
 * Convert AnaGonda value to area in square feet using standard baseline (1 Gonda = 180 sq ft)
 */
export function anaGondaToSqFt(v: AnaGondaValue): number {
  const til = anaGondaToTil(v);
  // 1 Til = 0.75 sq ft (since 1 Kranti = 20 Til = 15 sq ft; 1 Kora = 45 sq ft; 1 Gonda = 180 sq ft)
  return til * LAND_CONSTANTS.SQFT_PER_TIL;
}

/**
 * Convert square feet to traditional Ana-Gonda units
 */
export function sqFtToAnaGonda(sqFt: number): AnaGondaValue {
  const safeSqFt = Math.max(0, sqFt || 0);
  const totalTil = Math.round(safeSqFt / LAND_CONSTANTS.SQFT_PER_TIL);
  return tilToAnaGonda(totalTil);
}
