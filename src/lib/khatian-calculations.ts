import { LandAreaUnit } from '../types';
import {
  calculateLandUnits,
  convertAreaToSqFt,
  formatNumberByLang,
  roundClean,
} from './land-units';

export type KhatianType = 'CS' | 'SA' | 'RS' | 'BS' | 'City' | 'Mutation' | 'BRS' | 'Other';

export interface KhatianMetadata {
  district: string;       // জেলা
  upazila: string;        // উপজেলা / থানা
  union: string;          // ইউনিয়ন / পৌরসভা
  mouza: string;          // মৌজা
  jlNo: string;           // জে.এল. নং
  khatianNo: string;      // খতিয়ান নং
  khatianType: KhatianType; // খতিয়ানের ধরন (CS, SA, RS, BS...)
  notes: string;          // মন্তব্য
}

export interface KhatianDagInput {
  id: string;
  dagNo: string;
  landClass: string;      // নাল, ভিটি, বাড়ি, বাগান, পুকুর, ইত্যাদি
  landAmount: string;     // Input as string
  unit: LandAreaUnit;
}

export interface KhatianDagCalculated {
  id: string;
  dagNo: string;
  landClass: string;
  inputAmount: number;
  unit: LandAreaUnit;
  sqFt: number;
  decimal: number;
  katha: number;
  bigha: number;
  acre: number;
  // Associated owners and their allocated land in this dag
  allocatedDecimal: number;
  allocatedSqFt: number;
  allocatedPercent: number;
  remainingDecimal: number;
  isOverAllocated: boolean;
  excessDecimal: number;
  ownerIds: string[];
}

export interface KhatianOwnerInput {
  id: string;
  name: string;
  relationOrFather: string;
  shareType: 'percent' | 'fraction' | 'manual_land';
  // Share percentage (0-100)
  percentStr: string;
  // Fractional share (e.g. 1 / 4)
  numeratorStr: string;
  denominatorStr: string;
  // Manual land override (optional)
  manualLandStr: string;
  manualUnit: LandAreaUnit;
  // Specific Dag assignment: empty array means all dags, or specific dag ids
  assignedDagIds: string[];
  notes: string;
}

export interface KhatianOwnerCalculated {
  id: string;
  name: string;
  relationOrFather: string;
  shareType: 'percent' | 'fraction' | 'manual_land';
  shareFraction: number; // 0..1
  sharePercent: number;  // 0..100
  shareDisplayStr: string;
  assignedDagLabels: string[];
  assignedDagIds: string[];

  // Total allocated land across assigned dags
  totalDecimal: number;
  totalSqFt: number;
  totalKatha: number;
  totalBigha: number;
  totalAcre: number;

  // Breakdown per dag
  dagBreakdown: {
    dagId: string;
    dagNo: string;
    decimal: number;
    sqFt: number;
  }[];

  notes: string;
}

export interface KhatianInconsistency {
  id: string;
  type: 'danger' | 'warning' | 'info';
  titleBn: string;
  titleEn: string;
  messageBn: string;
  messageEn: string;
}

export interface KhatianAnalysisResult {
  metadata: KhatianMetadata;
  dags: KhatianDagCalculated[];
  owners: KhatianOwnerCalculated[];

  // Totals of all Dags
  totalKhatianSqFt: number;
  totalKhatianDecimal: number;
  totalKhatianKatha: number;
  totalKhatianBigha: number;
  totalKhatianAcre: number;

  // Total Allocated to Owners
  totalAllocatedSqFt: number;
  totalAllocatedDecimal: number;
  totalAllocatedPercent: number;

  // Remaining / Unallocated
  remainingSqFt: number;
  remainingDecimal: number;
  remainingKatha: number;
  remainingBigha: number;
  remainingAcre: number;
  remainingPercent: number;

  // Status flags
  isOverAllocated: boolean;
  excessDecimal: number;
  excessPercent: number;
  isFullyBalanced: boolean;

  // Inconsistencies detected
  inconsistencies: KhatianInconsistency[];
}

export interface KhatianReportA4Data {
  reportTitleBn: string;
  reportTitleEn: string;
  disclaimerBn: string;
  disclaimerEn: string;
  generatedAt: string;
  metadata: KhatianMetadata;
  totals: {
    sqFt: number;
    decimal: number;
    katha: number;
    bigha: number;
    acre: number;
  };
  dags: KhatianDagCalculated[];
  owners: KhatianOwnerCalculated[];
  summary: {
    totalAllocatedDecimal: number;
    totalAllocatedPercent: number;
    remainingDecimal: number;
    remainingPercent: number;
    isOverAllocated: boolean;
    isFullyBalanced: boolean;
  };
  inconsistencies: KhatianInconsistency[];
}

/**
 * Perform comprehensive Khatian & Dag-wise Ownership Analysis
 */
export function analyzeKhatian(
  metadata: KhatianMetadata,
  dagInputs: KhatianDagInput[],
  ownerInputs: KhatianOwnerInput[],
  lang: 'bn' | 'en' = 'bn'
): KhatianAnalysisResult {
  const isBn = lang === 'bn';

  // 1. Calculate each Dag's area metrics
  let totalKhatianSqFt = 0;

  const calculatedDags: KhatianDagCalculated[] = dagInputs.map((d) => {
    const amount = Math.max(0, parseFloat(d.landAmount) || 0);
    const sqFt = convertAreaToSqFt(amount, d.unit);
    const units = calculateLandUnits(sqFt);
    totalKhatianSqFt += sqFt;

    return {
      id: d.id,
      dagNo: d.dagNo.trim() || (isBn ? 'দাগ নং অনির্ধারিত' : 'Plot Unassigned'),
      landClass: d.landClass.trim() || (isBn ? 'নাল' : 'Agricultural'),
      inputAmount: amount,
      unit: d.unit,
      sqFt: roundClean(sqFt, 2),
      decimal: roundClean(units.shatangsha, 3),
      katha: roundClean(units.katha, 3),
      bigha: roundClean(units.bigha, 4),
      acre: roundClean(units.acre, 4),
      allocatedDecimal: 0,
      allocatedSqFt: 0,
      allocatedPercent: 0,
      remainingDecimal: roundClean(units.shatangsha, 3),
      isOverAllocated: false,
      excessDecimal: 0,
      ownerIds: [],
    };
  });

  const khatianUnits = calculateLandUnits(totalKhatianSqFt);
  const totalKhatianDecimal = khatianUnits.shatangsha;

  // 2. Map owners and compute their shares & land
  const calculatedOwners: KhatianOwnerCalculated[] = ownerInputs.map((owner) => {
    let shareFraction = 0;
    let sharePercent = 0;
    let shareDisplayStr = '';

    if (owner.shareType === 'percent') {
      const p = Math.max(0, parseFloat(owner.percentStr) || 0);
      sharePercent = p;
      shareFraction = p / 100;
      shareDisplayStr = `${formatNumberByLang(roundClean(p, 2), lang)}%`;
    } else if (owner.shareType === 'fraction') {
      const num = Math.max(0, parseFloat(owner.numeratorStr) || 0);
      const den = Math.max(0.00001, parseFloat(owner.denominatorStr) || 1);
      shareFraction = num / den;
      sharePercent = shareFraction * 100;
      shareDisplayStr = `${formatNumberByLang(num, lang)}/${formatNumberByLang(den, lang)} (${formatNumberByLang(roundClean(sharePercent, 2), lang)}%)`;
    } else {
      // Manual land quantity entered
      const manualAmt = Math.max(0, parseFloat(owner.manualLandStr) || 0);
      const manualSqFt = convertAreaToSqFt(manualAmt, owner.manualUnit);
      const manualDec = manualSqFt / 435.6;
      sharePercent = totalKhatianDecimal > 0 ? (manualDec / totalKhatianDecimal) * 100 : 0;
      shareFraction = sharePercent / 100;
      shareDisplayStr = `${formatNumberByLang(roundClean(manualDec, 2), lang)} ${isBn ? 'শতক' : 'Dec'} (${formatNumberByLang(roundClean(sharePercent, 2), lang)}%)`;
    }

    // Determine which Dags apply: if assignedDagIds is empty or contains 'all', all dags apply
    const targetDags =
      !owner.assignedDagIds || owner.assignedDagIds.length === 0 || owner.assignedDagIds.includes('all')
        ? calculatedDags
        : calculatedDags.filter((d) => owner.assignedDagIds.includes(d.id));

    const assignedDagLabels = targetDags.map((d) => d.dagNo);
    const assignedDagIds = targetDags.map((d) => d.id);

    // Calculate owner's land across target dags
    let ownerTotalSqFt = 0;
    let ownerTotalDecimal = 0;

    const dagBreakdown = targetDags.map((dag) => {
      let ownerDagSqFt = 0;
      let ownerDagDec = 0;

      if (owner.shareType === 'manual_land') {
        // Distribute manual land across assigned dags proportionally to dag size
        const manualAmt = Math.max(0, parseFloat(owner.manualLandStr) || 0);
        const totalManualSqFt = convertAreaToSqFt(manualAmt, owner.manualUnit);
        const targetDagsSqFt = targetDags.reduce((s, d) => s + d.sqFt, 0);
        const weight = targetDagsSqFt > 0 ? dag.sqFt / targetDagsSqFt : 1 / (targetDags.length || 1);
        ownerDagSqFt = totalManualSqFt * weight;
        ownerDagDec = ownerDagSqFt / 435.6;
      } else {
        // Proportional to share fraction on this dag
        ownerDagSqFt = dag.sqFt * shareFraction;
        ownerDagDec = dag.decimal * shareFraction;
      }

      ownerTotalSqFt += ownerDagSqFt;
      ownerTotalDecimal += ownerDagDec;

      // Update Dag accumulation
      dag.allocatedDecimal += ownerDagDec;
      dag.allocatedSqFt += ownerDagSqFt;
      if (!dag.ownerIds.includes(owner.id)) {
        dag.ownerIds.push(owner.id);
      }

      return {
        dagId: dag.id,
        dagNo: dag.dagNo,
        decimal: roundClean(ownerDagDec, 3),
        sqFt: roundClean(ownerDagSqFt, 2),
      };
    });

    const ownerUnits = calculateLandUnits(ownerTotalSqFt);

    return {
      id: owner.id,
      name: owner.name.trim() || (isBn ? 'মালিক' : 'Owner'),
      relationOrFather: owner.relationOrFather.trim(),
      shareType: owner.shareType,
      shareFraction,
      sharePercent: roundClean(sharePercent, 3),
      shareDisplayStr,
      assignedDagLabels,
      assignedDagIds,

      totalDecimal: roundClean(ownerTotalDecimal, 3),
      totalSqFt: roundClean(ownerTotalSqFt, 2),
      totalKatha: roundClean(ownerUnits.katha, 3),
      totalBigha: roundClean(ownerUnits.bigha, 4),
      totalAcre: roundClean(ownerUnits.acre, 4),

      dagBreakdown,
      notes: owner.notes.trim(),
    };
  });

  // 3. Complete Dag allocated/remaining values
  calculatedDags.forEach((dag) => {
    dag.allocatedDecimal = roundClean(dag.allocatedDecimal, 3);
    dag.allocatedSqFt = roundClean(dag.allocatedSqFt, 2);
    dag.allocatedPercent = dag.decimal > 0 ? roundClean((dag.allocatedDecimal / dag.decimal) * 100, 2) : 0;
    dag.remainingDecimal = Math.max(0, roundClean(dag.decimal - dag.allocatedDecimal, 3));
    dag.isOverAllocated = dag.allocatedDecimal > dag.decimal + 0.005;
    dag.excessDecimal = dag.isOverAllocated ? roundClean(dag.allocatedDecimal - dag.decimal, 3) : 0;
  });

  // 4. Overall Khatian summary metrics
  const totalAllocatedSqFt = calculatedOwners.reduce((sum, o) => sum + o.totalSqFt, 0);
  const totalAllocatedDecimal = calculatedOwners.reduce((sum, o) => sum + o.totalDecimal, 0);
  const totalAllocatedPercent =
    totalKhatianDecimal > 0 ? (totalAllocatedDecimal / totalKhatianDecimal) * 100 : 0;

  const isOverAllocated = totalAllocatedDecimal > totalKhatianDecimal + 0.005;
  const isFullyBalanced = Math.abs(totalAllocatedDecimal - totalKhatianDecimal) <= 0.005 && totalKhatianDecimal > 0;

  const excessDecimal = isOverAllocated ? roundClean(totalAllocatedDecimal - totalKhatianDecimal, 3) : 0;
  const excessPercent = isOverAllocated ? roundClean(totalAllocatedPercent - 100, 3) : 0;

  const remainingDecimal = Math.max(0, roundClean(totalKhatianDecimal - totalAllocatedDecimal, 3));
  const remainingSqFt = Math.max(0, roundClean(remainingDecimal * 435.6, 2));
  const remainingPercent = Math.max(0, roundClean(100 - totalAllocatedPercent, 3));
  const remainingUnits = calculateLandUnits(remainingSqFt);

  // 5. Inconsistency detection
  const inconsistencies: KhatianInconsistency[] = [];

  if (totalKhatianDecimal <= 0) {
    inconsistencies.push({
      id: 'no_dag_land',
      type: 'warning',
      titleBn: 'খতিয়ানে কোনো দাগের জমির পরিমাণ যুক্ত করা হয়নি',
      titleEn: 'No Dag land recorded',
      messageBn: 'কমপক্ষে একটি দাগের সঠিক জমির পরিমাণ উল্লেখ করুন।',
      messageEn: 'Please enter valid land quantity for at least one Dag.',
    });
  }

  if (isOverAllocated) {
    inconsistencies.push({
      id: 'overall_excess',
      type: 'danger',
      titleBn: 'খতিয়ানের মোট জমি ছাড়িয়ে গেছে (অতিরিক্ত বণ্টন)',
      titleEn: 'Total Khatian land over-allocated',
      messageBn: `মালিকগণের বণ্টনকৃত মোট জমি খতিয়ানের মোট রেকর্ডকৃত জমির চেয়ে ${formatNumberByLang(excessDecimal, lang)} শতক (${formatNumberByLang(excessPercent, lang)}%) বেশি।`,
      messageEn: `Total allocated land exceeds recorded Khatian area by ${excessDecimal} decimals (${excessPercent}%).`,
    });
  } else if (!isFullyBalanced && remainingDecimal > 0.01) {
    inconsistencies.push({
      id: 'unallocated_share',
      type: 'info',
      titleBn: 'অবশিষ্ট অবণ্টিত অংশ রয়েছে',
      titleEn: 'Unallocated land remainder exists',
      messageBn: `খতিয়ানের ${formatNumberByLang(remainingDecimal, lang)} শতক (${formatNumberByLang(remainingPercent, lang)}%) জমি এখনো কোনো অংশীদারের নামে বণ্টিত হয়নি।`,
      messageEn: `${remainingDecimal} decimals (${remainingPercent}%) of Khatian land remains unallocated.`,
    });
  }

  // Check individual dag over-allocations
  calculatedDags.forEach((dag) => {
    if (dag.isOverAllocated) {
      inconsistencies.push({
        id: `dag_excess_${dag.id}`,
        type: 'danger',
        titleBn: `দাগ নং ${dag.dagNo}-এ অতিরিক্ত জমি বণ্টন হয়েছে`,
        titleEn: `Dag #${dag.dagNo} is over-allocated`,
        messageBn: `দাগ নং ${dag.dagNo}-এর মোট জমি ${formatNumberByLang(dag.decimal, lang)} শতক, কিন্তু বণ্টিত হয়েছে ${formatNumberByLang(dag.allocatedDecimal, lang)} শতক (অতিরিক্ত: +${formatNumberByLang(dag.excessDecimal, lang)} শতক)।`,
        messageEn: `Dag #${dag.dagNo} has ${dag.decimal} decimals, but ${dag.allocatedDecimal} decimals was allocated (excess: +${dag.excessDecimal} decimals).`,
      });
    }
  });

  // Check for owners with 0 land or empty name
  ownerInputs.forEach((o, idx) => {
    if (!o.name.trim()) {
      inconsistencies.push({
        id: `owner_empty_name_${o.id}`,
        type: 'warning',
        titleBn: `অংশীদার #${formatNumberByLang(idx + 1, lang)}-এর নাম খালি রয়েছে`,
        titleEn: `Owner #${idx + 1} has empty name`,
        messageBn: 'সকল অংশীদারের নাম সঠিকভাবে লিপিবদ্ধ করুন।',
        messageEn: 'Please enter a name for all owners.',
      });
    }
  });

  return {
    metadata,
    dags: calculatedDags,
    owners: calculatedOwners,

    totalKhatianSqFt: roundClean(totalKhatianSqFt, 2),
    totalKhatianDecimal: roundClean(totalKhatianDecimal, 3),
    totalKhatianKatha: roundClean(khatianUnits.katha, 3),
    totalKhatianBigha: roundClean(khatianUnits.bigha, 4),
    totalKhatianAcre: roundClean(khatianUnits.acre, 4),

    totalAllocatedSqFt: roundClean(totalAllocatedSqFt, 2),
    totalAllocatedDecimal: roundClean(totalAllocatedDecimal, 3),
    totalAllocatedPercent: roundClean(totalAllocatedPercent, 3),

    remainingSqFt,
    remainingDecimal,
    remainingKatha: roundClean(remainingUnits.katha, 3),
    remainingBigha: roundClean(remainingUnits.bigha, 4),
    remainingAcre: roundClean(remainingUnits.acre, 4),
    remainingPercent,

    isOverAllocated,
    excessDecimal,
    excessPercent,
    isFullyBalanced,

    inconsistencies,
  };
}

/**
 * Prepares formatted A4 report structure
 */
export function prepareKhatianReportData(
  result: KhatianAnalysisResult,
  lang: 'bn' | 'en' = 'bn'
): KhatianReportA4Data {
  return {
    reportTitleBn: 'ডিজিটাল খতিয়ান বিশ্লেষণ ও মালিকানা প্রতিবেদন',
    reportTitleEn: 'Digital Khatian Analysis & Ownership Report',
    disclaimerBn:
      'ডিজিটাল বিশ্লেষণ ও ব্যবহারকারী প্রদত্ত তথ্য ভিত্তিক — এটি কোনো সরকারি স্বত্ব প্রমাণ বা সাব-রেজিস্ট্রির চূড়ান্ত রেকর্ড নয়। ভূমির মালিকানা প্রমাণের জন্য সহকারী কমিশনার (ভূমি) বা সাব-রেজিস্ট্রি অফিসের মূল রেকর্ড যাচাই আবশ্যক।',
    disclaimerEn:
      'DIGITAL ANALYSIS / USER-PROVIDED DATA — Not a government land ownership certificate. Verification with official AC Land / Sub-Registry records is required.',
    generatedAt: new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    metadata: result.metadata,
    totals: {
      sqFt: result.totalKhatianSqFt,
      decimal: result.totalKhatianDecimal,
      katha: result.totalKhatianKatha,
      bigha: result.totalKhatianBigha,
      acre: result.totalKhatianAcre,
    },
    dags: result.dags,
    owners: result.owners,
    summary: {
      totalAllocatedDecimal: result.totalAllocatedDecimal,
      totalAllocatedPercent: result.totalAllocatedPercent,
      remainingDecimal: result.remainingDecimal,
      remainingPercent: result.remainingPercent,
      isOverAllocated: result.isOverAllocated,
      isFullyBalanced: result.isFullyBalanced,
    },
    inconsistencies: result.inconsistencies,
  };
}
