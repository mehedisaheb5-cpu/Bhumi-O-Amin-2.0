import { LandAreaUnit } from '../types';
import {
  calculateLandUnits,
  convertAreaToSqFt,
  formatNumberByLang,
  roundClean,
} from './land-units';

export type InheritanceLawType = 'muslim' | 'hindu';

export type HeirCategoryType =
  | 'sharer_quranic'      // কুরআন নির্ধারিত অংশীদার (জাবিল ফুরুজ)
  | 'residuary_asaba'     // অবশিষ্টাংশভোগী (আসাবা)
  | 'distant_kindred'     // দূরবর্তী আত্মীয় (জাবিল আরহাম)
  | 'hindu_dayabhaga_1'   // হিন্দু দায়ভাগ প্রথম শ্রেণি (পুত্র, বিধবা স্ত্রী, ইত্যাদি)
  | 'hindu_dayabhaga_2'   // হিন্দু দায়ভাগ অন্যান্য ওয়ারিশ
  | 'custom_manual';      // কাস্টম / আইনগত যাচাই সাপেক্ষ

export type HeirAllocationMode =
  | 'preset_standard'     // প্রামাণ্য শাস্ত্রীয় রেফারেন্স
  | 'residuary_ratio'     // আসাবা আনুপাতিক (যেমন পুত্র ২ : কন্যা ১)
  | 'custom_fraction'     // কাস্টম ভগ্নাংশ (লব / হর)
  | 'custom_percent';     // কাস্টম শতকরা (%)

export type RuleVerificationStatus =
  | 'verified_standard_reference' // প্রামাণ্য শাস্ত্রীয় ভিত্তি
  | 'requires_legal_verification'; // আইনগত ম্যানুয়াল যাচাই আবশ্যক

export interface HeirPresetDefinition {
  id: string;
  law: InheritanceLawType;
  relationBn: string;
  relationEn: string;
  gender: 'male' | 'female';
  category: HeirCategoryType;
  defaultAllocationMode: HeirAllocationMode;
  defaultNumerator?: number;
  defaultDenominator?: number;
  ratioWeight?: number; // 2 for son, 1 for daughter
  ruleStatus: RuleVerificationStatus;
  conditionNoteBn: string;
  conditionNoteEn: string;
}

export const INHERITANCE_PRESETS: HeirPresetDefinition[] = [
  // Muslim Presets (Canonical Faraiz References)
  {
    id: 'muslim_wife_with_children',
    law: 'muslim',
    relationBn: 'স্ত্রী (সন্তান থাকিলে)',
    relationEn: 'Wife (with children)',
    gender: 'female',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 8,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'সন্তান থাকিলে স্ত্রী মোট সম্পত্তির ১/৮ অংশ পান (সূরা নিসা: ১২)। একাধিক স্ত্রী হইলে এই ১/৮ সমভাবে বণ্টিত হইবে।',
    conditionNoteEn: 'Wife receives 1/8 share if deceased has children (Surah An-Nisa: 12). Divided equally among multiple wives.',
  },
  {
    id: 'muslim_wife_no_children',
    law: 'muslim',
    relationBn: 'স্ত্রী (সন্তান না থাকিলে)',
    relationEn: 'Wife (without children)',
    gender: 'female',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 4,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'সন্তান না থাকিলে স্ত্রী মোট সম্পত্তির ১/৪ অংশ পান (সূরা নিসা: ১২)।',
    conditionNoteEn: 'Wife receives 1/4 share if deceased has no children (Surah An-Nisa: 12).',
  },
  {
    id: 'muslim_husband_with_children',
    law: 'muslim',
    relationBn: 'স্বামী (সন্তান থাকিলে)',
    relationEn: 'Husband (with children)',
    gender: 'male',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 4,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'সন্তান থাকিলে স্বামী স্ত্রীর সম্পত্তির ১/৪ অংশ পান (সূরা নিসা: ১২)।',
    conditionNoteEn: 'Husband receives 1/4 share if deceased wife has children (Surah An-Nisa: 12).',
  },
  {
    id: 'muslim_husband_no_children',
    law: 'muslim',
    relationBn: 'স্বামী (সন্তান না থাকিলে)',
    relationEn: 'Husband (without children)',
    gender: 'male',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 2,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'সন্তান না থাকিলে স্বামী স্ত্রীর সম্পত্তির ১/২ (অর্ধেক) অংশ পান (সূরা নিসা: ১২)।',
    conditionNoteEn: 'Husband receives 1/2 share if deceased wife has no children (Surah An-Nisa: 12).',
  },
  {
    id: 'muslim_mother_with_children',
    law: 'muslim',
    relationBn: 'মাতা (সন্তান বা একাধিক ভাইবোন থাকিলে)',
    relationEn: 'Mother (with children or siblings)',
    gender: 'female',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 6,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'সন্তান বা ২+ ভাইবোন থাকিলে মাতা ১/৬ অংশ পান (সূরা নিসা: ১১)।',
    conditionNoteEn: 'Mother receives 1/6 share if children or 2+ siblings exist (Surah An-Nisa: 11).',
  },
  {
    id: 'muslim_mother_no_children',
    law: 'muslim',
    relationBn: 'মাতা (সন্তান ও ভাইবোন না থাকিলে)',
    relationEn: 'Mother (no children & no siblings)',
    gender: 'female',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 3,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'সন্তান বা একাধিক ভাইবোন না থাকিলে মাতা ১/৩ অংশ পান (সূরা নিসা: ১১)।',
    conditionNoteEn: 'Mother receives 1/3 share if no children and no siblings exist (Surah An-Nisa: 11).',
  },
  {
    id: 'muslim_father_with_children',
    law: 'muslim',
    relationBn: 'পিতা (সন্তান থাকিলে)',
    relationEn: 'Father (with children)',
    gender: 'male',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 6,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'সন্তান থাকিলে পিতা ১/৬ অংশ পান (সূরা নিসা: ১১)।',
    conditionNoteEn: 'Father receives 1/6 share if children exist (Surah An-Nisa: 11).',
  },
  {
    id: 'muslim_son_asaba',
    law: 'muslim',
    relationBn: 'পুত্র (আসাবা / অবশিষ্টাংশভোগী)',
    relationEn: 'Son (Residuary Asaba)',
    gender: 'male',
    category: 'residuary_asaba',
    defaultAllocationMode: 'residuary_ratio',
    ratioWeight: 2,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'পুত্র আসাবা। কন্যা থাকিলে পুত্র ২ : কন্যা ১ অনুপাতে অবশিষ্টাংশ পায়। কন্যা না থাকিলে একচ্ছত্র অবশিষ্টাংশ পায়।',
    conditionNoteEn: 'Son is a primary residuary. Receives 2:1 ratio alongside daughters.',
  },
  {
    id: 'muslim_daughter_with_son',
    law: 'muslim',
    relationBn: 'কন্যা (পুত্রের সাথে আসাবা)',
    relationEn: 'Daughter (with Son as Residuary)',
    gender: 'female',
    category: 'residuary_asaba',
    defaultAllocationMode: 'residuary_ratio',
    ratioWeight: 1,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'পুত্র থাকিলে কন্যা পুত্রের সহিত যৌথভাবে ২ : ১ অনুপাতে অবশিষ্টাংশ পায় (সূরা নিসা: ১১)।',
    conditionNoteEn: 'When brothers exist, daughters inherit as residuaries with 2:1 ratio to sons.',
  },
  {
    id: 'muslim_daughter_alone',
    law: 'muslim',
    relationBn: 'কন্যা (১ জন, কোনো পুত্র নাই)',
    relationEn: 'Single Daughter (no sons)',
    gender: 'female',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 1,
    defaultDenominator: 2,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'পুত্র না থাকিলে এবং কেবল ১ জন কন্যা থাকিলে সে মোট সম্পত্তির ১/২ (অর্ধেক) পায় (সূরা নিসা: ১১)।',
    conditionNoteEn: 'If deceased has only one daughter and no sons, she receives 1/2 share.',
  },
  {
    id: 'muslim_daughters_multiple',
    law: 'muslim',
    relationBn: 'কন্যাগণ (২ বা ততোধিক, কোনো পুত্র নাই)',
    relationEn: 'Multiple Daughters (no sons)',
    gender: 'female',
    category: 'sharer_quranic',
    defaultAllocationMode: 'preset_standard',
    defaultNumerator: 2,
    defaultDenominator: 3,
    ruleStatus: 'verified_standard_reference',
    conditionNoteBn: 'পুত্র না থাকিলে এবং ২ বা ততোধিক কন্যা থাকিলে তাহারা সকলে যৌথভাবে ২/৩ অংশ পায় (সূরা নিসা: ১১)।',
    conditionNoteEn: 'Two or more daughters without sons share 2/3 equally.',
  },
  {
    id: 'muslim_brother_sister_other',
    law: 'muslim',
    relationBn: 'সহোদর ভাই / বোন / অন্যান্য আত্মীয়',
    relationEn: 'Brother / Sister / Distant Relative',
    gender: 'male',
    category: 'distant_kindred',
    defaultAllocationMode: 'custom_fraction',
    defaultNumerator: 0,
    defaultDenominator: 1,
    ruleStatus: 'requires_legal_verification',
    conditionNoteBn: 'পিতা বা পুত্র থাকিলে ভাইবোন বঞ্চিত (হজব) হয়। পারিবারিক পরিস্থিতি অনুযায়ী ম্যানুয়াল আইনি যাচাই আবশ্যক।',
    conditionNoteEn: 'Brothers/sisters may be excluded by father or son. Requires specific legal verification.',
  },

  // Hindu Presets (Dayabhaga School in Bangladesh)
  {
    id: 'hindu_son',
    law: 'hindu',
    relationBn: 'পুত্র (দায়ভাগ প্রথম শ্রেণি)',
    relationEn: 'Son (Dayabhaga Class 1)',
    gender: 'male',
    category: 'hindu_dayabhaga_1',
    defaultAllocationMode: 'residuary_ratio',
    ratioWeight: 1,
    ruleStatus: 'requires_legal_verification',
    conditionNoteBn: 'হিন্দু দায়ভাগ আইনে পিতা মারা গেলে জীবিত পুত্রগণ সম্পত্তিতে সমান অংশ পায় (আইনি যাচাই সাপেক্ষ)।',
    conditionNoteEn: 'Under Dayabhaga law, sons inherit equally upon father’s demise (subject to verification).',
  },
  {
    id: 'hindu_widow',
    law: 'hindu',
    relationBn: 'বিধবা স্ত্রী (হিন্দু আইন)',
    relationEn: 'Widow (Hindu Law)',
    gender: 'female',
    category: 'hindu_dayabhaga_1',
    defaultAllocationMode: 'custom_fraction',
    defaultNumerator: 0,
    defaultDenominator: 1,
    ruleStatus: 'requires_legal_verification',
    conditionNoteBn: 'পুত্র থাকিলে বিধবা জীবনস্বত্ব/খোরপোশ পায়; পুত্রহীন হইলে পুত্রের ন্যায় অংশ পায় (আইনি যাচাই সাপেক্ষ)।',
    conditionNoteEn: 'Widow rights depend on son presence and Hindu Women’s Rights to Property Act 1937.',
  },
  {
    id: 'hindu_unmarried_daughter',
    law: 'hindu',
    relationBn: 'অবিবাহিত কন্যা (হিন্দু আইন)',
    relationEn: 'Unmarried Daughter (Hindu Law)',
    gender: 'female',
    category: 'hindu_dayabhaga_1',
    defaultAllocationMode: 'custom_fraction',
    defaultNumerator: 0,
    defaultDenominator: 1,
    ruleStatus: 'requires_legal_verification',
    conditionNoteBn: 'পুত্র না থাকিলে অবিবাহিত কন্যা বিবাহিত কন্যার অগ্রাধিকার পায় (আইনি যাচাই সাপেক্ষ)।',
    conditionNoteEn: 'Unmarried daughters take priority over married daughters in absence of male heirs.',
  },
  {
    id: 'hindu_other_heir',
    law: 'hindu',
    relationBn: 'অন্যান্য উত্তরাধিকারী (হিন্দু দায়ভাগ)',
    relationEn: 'Other Heir (Dayabhaga)',
    gender: 'male',
    category: 'hindu_dayabhaga_2',
    defaultAllocationMode: 'custom_fraction',
    defaultNumerator: 0,
    defaultDenominator: 1,
    ruleStatus: 'requires_legal_verification',
    conditionNoteBn: 'দায়ভাগ সপিণ্ড, সাকুল্য ও সমানোদক উত্তরাধিকার ক্রমানুসারে বিজ্ঞ দেওয়ানি আইনজীবীর যাচাই আবশ্যক।',
    conditionNoteEn: 'Sapinda and Sakulya inheritance sequences require formal civil legal verification.',
  },
];

export interface HeirItemInput {
  id: string;
  relation: string;
  gender: 'male' | 'female';
  category: HeirCategoryType;
  count: number;
  allocationMode: HeirAllocationMode;
  numerator: number;
  denominator: number;
  percent: number;
  ratioWeight: number;
  ruleStatus: RuleVerificationStatus;
  note?: string;
}

export interface HeirCalculatedResult {
  id: string;
  relation: string;
  gender: 'male' | 'female';
  category: HeirCategoryType;
  categoryLabelBn: string;
  categoryLabelEn: string;
  count: number;
  ruleStatus: RuleVerificationStatus;
  shareDisplay: string;
  groupFraction: number; // 0.0 to 1.0
  groupPercent: number; // 0 to 100
  groupSqFt: number;
  groupDecimal: number;
  groupKatha: number;
  groupBigha: number;
  groupAcre: number;
  groupValueBDT?: number;

  // Individual Per-Person values
  perPersonFraction: number;
  perPersonPercent: number;
  perPersonSqFt: number;
  perPersonDecimal: number;
  perPersonKatha: number;
  perPersonBigha: number;
  perPersonAcre: number;
  perPersonValueBDT?: number;

  legalNoteBn?: string;
  legalNoteEn?: string;
}

export interface InheritanceCalculationResult {
  lawType: InheritanceLawType;
  totalLandSqFt: number;
  totalLandDecimal: number;
  totalLandKatha: number;
  totalLandBigha: number;
  totalLandAcre: number;
  estateValueBDT?: number;
  heirs: HeirCalculatedResult[];

  totalAllocatedFraction: number;
  totalAllocatedPercent: number;
  remainingFraction: number;
  remainingPercent: number;
  remainingSqFt: number;
  remainingDecimal: number;
  remainingKatha: number;
  remainingBigha: number;
  remainingAcre: number;
  remainingValueBDT?: number;

  balanceStatus: 'balanced' | 'surplus_residual' | 'deficit_awl' | 'unallocated';
  statusMessageBn: string;
  statusMessageEn: string;
}

export function getCategoryLabel(category: HeirCategoryType, lang: 'bn' | 'en'): { bn: string; en: string } {
  switch (category) {
    case 'sharer_quranic':
      return { bn: 'কুরআন নির্ধারিত (জাবিল ফুরুজ)', en: 'Quranic Sharer' };
    case 'residuary_asaba':
      return { bn: 'অবশিষ্টাংশভোগী (আসাবা)', en: 'Residuary (Asaba)' };
    case 'distant_kindred':
      return { bn: 'দূরবর্তী আত্মীয় (জাবিল আরহাম)', en: 'Distant Kindred' };
    case 'hindu_dayabhaga_1':
      return { bn: 'দায়ভাগ প্রথম শ্রেণি', en: 'Dayabhaga Class 1' };
    case 'hindu_dayabhaga_2':
      return { bn: 'দায়ভাগ অন্যান্য', en: 'Dayabhaga Secondary' };
    case 'custom_manual':
    default:
      return { bn: 'আইনগত যাচাই সাপেক্ষ', en: 'Requires Verification' };
  }
}

/**
 * Modular Inheritance calculation engine for Muslim & Hindu structures
 */
export function calculateInheritanceDistribution(
  lawType: InheritanceLawType,
  totalLandAmount: number,
  areaUnit: LandAreaUnit,
  estateValueBDT: number | undefined,
  heirInputs: HeirItemInput[],
  lang: 'bn' | 'en' = 'bn'
): InheritanceCalculationResult {
  const isBn = lang === 'bn';
  const safeLand = Math.max(0, totalLandAmount || 0);
  const totalLandSqFt = convertAreaToSqFt(safeLand, areaUnit);
  const totalLandUnits = calculateLandUnits(totalLandSqFt);
  const safeEstateVal = estateValueBDT && estateValueBDT > 0 ? estateValueBDT : undefined;

  // Step 1: Separate Fixed Sharers / Percentage from Residuaries
  let fixedFractionSum = 0;
  const initialFractions: { [id: string]: number } = {};

  heirInputs.forEach((h) => {
    if (h.allocationMode === 'preset_standard' || h.allocationMode === 'custom_fraction') {
      const num = Math.max(0, h.numerator || 0);
      const den = Math.max(0.0001, h.denominator || 1);
      const frac = num / den;
      initialFractions[h.id] = frac;
      fixedFractionSum += frac;
    } else if (h.allocationMode === 'custom_percent') {
      const frac = Math.max(0, (h.percent || 0) / 100);
      initialFractions[h.id] = frac;
      fixedFractionSum += frac;
    }
  });

  // Step 2: Calculate Residual Pool (for Asaba / Residuaries)
  const residualPool = Math.max(0, 1.0 - fixedFractionSum);
  const residuaryHeirs = heirInputs.filter((h) => h.allocationMode === 'residuary_ratio');

  // Total ratio weights across residuaries: sum of (count * ratioWeight)
  let totalResiduaryWeight = 0;
  residuaryHeirs.forEach((h) => {
    const w = Math.max(1, h.ratioWeight || 1);
    const cnt = Math.max(1, h.count || 1);
    totalResiduaryWeight += cnt * w;
  });

  // Distribute residual pool among residuaries
  if (totalResiduaryWeight > 0 && residualPool > 0) {
    residuaryHeirs.forEach((h) => {
      const w = Math.max(1, h.ratioWeight || 1);
      const cnt = Math.max(1, h.count || 1);
      const heirShareOfResidual = residualPool * ((cnt * w) / totalResiduaryWeight);
      initialFractions[h.id] = heirShareOfResidual;
    });
  } else {
    residuaryHeirs.forEach((h) => {
      if (initialFractions[h.id] === undefined) {
        initialFractions[h.id] = 0;
      }
    });
  }

  // Step 3: Compute totals & generate heir results
  let totalAllocatedFraction = 0;
  const calculatedHeirs: HeirCalculatedResult[] = heirInputs.map((h) => {
    const fraction = initialFractions[h.id] || 0;
    totalAllocatedFraction += fraction;
    const count = Math.max(1, h.count || 1);
    const percent = fraction * 100;

    const groupSqFt = totalLandSqFt * fraction;
    const groupUnits = calculateLandUnits(groupSqFt);
    const groupValueBDT = safeEstateVal ? safeEstateVal * fraction : undefined;

    const perPersonFraction = fraction / count;
    const perPersonPercent = percent / count;
    const perPersonSqFt = groupSqFt / count;
    const perPersonUnits = calculateLandUnits(perPersonSqFt);
    const perPersonValueBDT = groupValueBDT ? groupValueBDT / count : undefined;

    const catLabels = getCategoryLabel(h.category, lang);

    let shareDisplay = `${roundClean(percent, 2)}%`;
    if (h.allocationMode === 'preset_standard' || h.allocationMode === 'custom_fraction') {
      if (h.numerator > 0 && h.denominator > 0) {
        shareDisplay = `${formatNumberByLang(h.numerator, lang)}/${formatNumberByLang(h.denominator, lang)} (${formatNumberByLang(roundClean(percent, 2), lang)}%)`;
      }
    } else if (h.allocationMode === 'residuary_ratio') {
      shareDisplay = isBn
        ? `আসাবা অবশিষ্টাংশ (${formatNumberByLang(roundClean(percent, 2), lang)}%)`
        : `Residuary (${roundClean(percent, 2)}%)`;
    }

    return {
      id: h.id,
      relation: h.relation,
      gender: h.gender,
      category: h.category,
      categoryLabelBn: catLabels.bn,
      categoryLabelEn: catLabels.en,
      count,
      ruleStatus: h.ruleStatus,
      shareDisplay,
      groupFraction: roundClean(fraction, 5),
      groupPercent: roundClean(percent, 3),
      groupSqFt: roundClean(groupSqFt, 2),
      groupDecimal: roundClean(groupUnits.shatangsha, 3),
      groupKatha: roundClean(groupUnits.katha, 3),
      groupBigha: roundClean(groupUnits.bigha, 4),
      groupAcre: roundClean(groupUnits.acre, 4),
      groupValueBDT: groupValueBDT ? Math.round(groupValueBDT) : undefined,

      perPersonFraction: roundClean(perPersonFraction, 5),
      perPersonPercent: roundClean(perPersonPercent, 3),
      perPersonSqFt: roundClean(perPersonSqFt, 2),
      perPersonDecimal: roundClean(perPersonUnits.shatangsha, 3),
      perPersonKatha: roundClean(perPersonUnits.katha, 3),
      perPersonBigha: roundClean(perPersonUnits.bigha, 4),
      perPersonAcre: roundClean(perPersonUnits.acre, 4),
      perPersonValueBDT: perPersonValueBDT ? Math.round(perPersonValueBDT) : undefined,

      legalNoteBn: h.note,
      legalNoteEn: h.note,
    };
  });

  const remainingFraction = Math.max(0, 1.0 - totalAllocatedFraction);
  const remainingPercent = roundClean(remainingFraction * 100, 3);
  const remainingSqFt = Math.max(0, totalLandSqFt * remainingFraction);
  const remainingUnits = calculateLandUnits(remainingSqFt);
  const remainingValueBDT = safeEstateVal ? Math.round(safeEstateVal * remainingFraction) : undefined;

  let balanceStatus: 'balanced' | 'surplus_residual' | 'deficit_awl' | 'unallocated' = 'balanced';
  let statusMessageBn = '১০০% সম্পূর্ণ আনুপাতিক বণ্টন সম্পন্ন হয়েছে।';
  let statusMessageEn = '100% Fully Distributed Proportionately.';

  if (totalAllocatedFraction > 1.0001) {
    balanceStatus = 'deficit_awl';
    const excess = roundClean((totalAllocatedFraction - 1.0) * 100, 2);
    statusMessageBn = `আউল (Awl) অবস্থা: মোট নির্ধারিত অংশ ১০০% অতিক্রম করেছে (অতিরিক্ত: ${formatNumberByLang(excess, 'bn')}%)। শাস্ত্রীয় আনুপাতিক হ্রাস বা বিজ্ঞ ফারায়েজ বিশেষজ্ঞের মতামত আবশ্যক।`;
    statusMessageEn = `Awl condition: Total allocated exceeds 100% (Excess: ${excess}%). Requires proportional reduction or expert verification.`;
  } else if (remainingFraction > 0.0001) {
    if (residuaryHeirs.length === 0) {
      balanceStatus = 'surplus_residual';
      statusMessageBn = `রদ্দ / অবশিষ্টাংশ অবস্থা: মোট সম্পত্তির ${formatNumberByLang(remainingPercent, 'bn')}% অবণ্টিত রয়েছে। আসাবা বা রদ্দ নীতি অনুযায়ী বণ্টন যাচাই করুন।`;
      statusMessageEn = `Residual / Radd condition: ${remainingPercent}% remains unallocated. Review residuary or radd provisions.`;
    } else {
      balanceStatus = 'unallocated';
      statusMessageBn = `অবশিষ্ট অবণ্টিত অংশ: ${formatNumberByLang(remainingPercent, 'bn')}%।`;
      statusMessageEn = `Remaining unallocated share: ${remainingPercent}%.`;
    }
  }

  return {
    lawType,
    totalLandSqFt: roundClean(totalLandSqFt, 2),
    totalLandDecimal: roundClean(totalLandUnits.shatangsha, 3),
    totalLandKatha: roundClean(totalLandUnits.katha, 3),
    totalLandBigha: roundClean(totalLandUnits.bigha, 4),
    totalLandAcre: roundClean(totalLandUnits.acre, 4),
    estateValueBDT: safeEstateVal,
    heirs: calculatedHeirs,

    totalAllocatedFraction: roundClean(totalAllocatedFraction, 5),
    totalAllocatedPercent: roundClean(totalAllocatedFraction * 100, 3),
    remainingFraction: roundClean(remainingFraction, 5),
    remainingPercent,
    remainingSqFt: roundClean(remainingSqFt, 2),
    remainingDecimal: roundClean(remainingUnits.shatangsha, 3),
    remainingKatha: roundClean(remainingUnits.katha, 3),
    remainingBigha: roundClean(remainingUnits.bigha, 4),
    remainingAcre: roundClean(remainingUnits.acre, 4),
    remainingValueBDT,

    balanceStatus,
    statusMessageBn,
    statusMessageEn,
  };
}
