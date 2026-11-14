import {
  LandShape,
  LengthUnit,
  PolygonPoint,
  SavedCalculation,
  TriangleCalcMode,
} from '../types';
import {
  calculateLandUnits,
  convertFeetToUnit,
  convertToFeet,
  formatNumberByLang,
  getUnitLabel,
  roundClean,
} from './land-units';

export interface CalculationOutput {
  isValid: boolean;
  errorMessage?: string;
  shape: LandShape;
  areaSqFt: number;
  perimeterFt?: number;
  perimeterUnitValue?: number;
  inputDescription: string;
  details?: Record<string, string | number>;
}

// -----------------------------------------------------------------------------
// 1. RECTANGLE CALCULATION
// -----------------------------------------------------------------------------
export function calculateRectangle(
  length: number,
  width: number,
  unit: LengthUnit,
  lang: 'bn' | 'en' = 'bn'
): CalculationOutput {
  if (isNaN(length) || isNaN(width) || length <= 0 || width <= 0) {
    return {
      isValid: false,
      errorMessage:
        lang === 'bn'
          ? 'অনুগ্রহ করে দৈর্ঘ্য এবং প্রস্থের জন্য সঠিক ধনাত্মক সংখ্যা লিখুন।'
          : 'Please enter valid positive numbers for length and width.',
      shape: 'rectangle',
      areaSqFt: 0,
      inputDescription: '',
    };
  }

  const lengthFt = convertToFeet(length, unit);
  const widthFt = convertToFeet(width, unit);
  const areaSqFt = lengthFt * widthFt;
  const perimeterFt = 2 * (lengthFt + widthFt);
  const perimeterUnitValue = convertFeetToUnit(perimeterFt, unit);

  const unitTxt = getUnitLabel(unit, lang);
  const inputDescription =
    lang === 'bn'
      ? `দৈর্ঘ্য: ${formatNumberByLang(length, lang)} ${unitTxt}, প্রস্থ: ${formatNumberByLang(width, lang)} ${unitTxt}`
      : `Length: ${length} ${unitTxt}, Width: ${width} ${unitTxt}`;

  return {
    isValid: true,
    shape: 'rectangle',
    areaSqFt,
    perimeterFt,
    perimeterUnitValue,
    inputDescription,
    details: {
      length,
      width,
      unit,
      lengthFt: roundClean(lengthFt, 2),
      widthFt: roundClean(widthFt, 2),
    },
  };
}

// -----------------------------------------------------------------------------
// 2. TRIANGLE CALCULATION (Base + Height OR 3-Side Heron's formula)
// -----------------------------------------------------------------------------
export function calculateTriangle(
  mode: TriangleCalcMode,
  params: {
    base?: number;
    height?: number;
    sideA?: number;
    sideB?: number;
    sideC?: number;
  },
  unit: LengthUnit,
  lang: 'bn' | 'en' = 'bn'
): CalculationOutput {
  const unitTxt = getUnitLabel(unit, lang);

  if (mode === 'base_height') {
    const base = params.base || 0;
    const height = params.height || 0;

    if (base <= 0 || height <= 0) {
      return {
        isValid: false,
        errorMessage:
          lang === 'bn'
            ? 'ভূমি ও উচ্চতার মান শূন্যের চেয়ে বড় হতে হবে।'
            : 'Base and height must be greater than zero.',
        shape: 'triangle',
        areaSqFt: 0,
        inputDescription: '',
      };
    }

    const baseFt = convertToFeet(base, unit);
    const heightFt = convertToFeet(height, unit);
    const areaSqFt = 0.5 * baseFt * heightFt;

    // Optional sides for perimeter
    let perimeterFt: number | undefined = undefined;
    let perimeterUnitValue: number | undefined = undefined;
    if (params.sideA && params.sideB && params.sideA > 0 && params.sideB > 0) {
      const aFt = convertToFeet(params.sideA, unit);
      const bFt = convertToFeet(params.sideB, unit);
      perimeterFt = baseFt + aFt + bFt;
      perimeterUnitValue = convertFeetToUnit(perimeterFt, unit);
    }

    const inputDescription =
      lang === 'bn'
        ? `ভূমি: ${formatNumberByLang(base, lang)} ${unitTxt}, উচ্চতা: ${formatNumberByLang(height, lang)} ${unitTxt}`
        : `Base: ${base} ${unitTxt}, Height: ${height} ${unitTxt}`;

    return {
      isValid: true,
      shape: 'triangle',
      areaSqFt,
      perimeterFt,
      perimeterUnitValue,
      inputDescription,
      details: {
        mode,
        base,
        height,
        sideA: params.sideA,
        sideB: params.sideB,
        unit,
      },
    };
  } else {
    // Three sides (Heron's Formula)
    const a = params.sideA || 0;
    const b = params.sideB || 0;
    const c = params.sideC || 0;

    if (a <= 0 || b <= 0 || c <= 0) {
      return {
        isValid: false,
        errorMessage:
          lang === 'bn'
            ? 'ত্রিভুজের তিনটি বাহুর মানই শূন্যের চেয়ে বড় হতে হবে।'
            : 'All three sides of the triangle must be greater than zero.',
        shape: 'triangle',
        areaSqFt: 0,
        inputDescription: '',
      };
    }

    // Triangle inequality validation: sum of any two sides > third side
    if (a + b <= c || a + c <= b || b + c <= a) {
      return {
        isValid: false,
        errorMessage:
          lang === 'bn'
            ? 'অবাস্তব ত্রিভুজ! যেকোনো দুই বাহুর যোগফল তৃতীয় বাহু অপেক্ষা বৃহত্তর হতে হবে (a + b > c)।'
            : 'Impossible triangle! The sum of any two sides must be strictly greater than the third side.',
        shape: 'triangle',
        areaSqFt: 0,
        inputDescription: '',
      };
    }

    const aFt = convertToFeet(a, unit);
    const bFt = convertToFeet(b, unit);
    const cFt = convertToFeet(c, unit);

    const perimeterFt = aFt + bFt + cFt;
    const s = perimeterFt / 2;
    const areaSqFt = Math.sqrt(
      Math.max(0, s * (s - aFt) * (s - bFt) * (s - cFt))
    );
    const perimeterUnitValue = convertFeetToUnit(perimeterFt, unit);

    const inputDescription =
      lang === 'bn'
        ? `বাহু ক: ${formatNumberByLang(a, lang)} ${unitTxt}, বাহু খ: ${formatNumberByLang(b, lang)} ${unitTxt}, বাহু গ: ${formatNumberByLang(c, lang)} ${unitTxt}`
        : `Side A: ${a} ${unitTxt}, Side B: ${b} ${unitTxt}, Side C: ${c} ${unitTxt}`;

    return {
      isValid: true,
      shape: 'triangle',
      areaSqFt,
      perimeterFt,
      perimeterUnitValue,
      inputDescription,
      details: {
        mode,
        sideA: a,
        sideB: b,
        sideC: c,
        unit,
      },
    };
  }
}

// -----------------------------------------------------------------------------
// 3. TRAPEZOID CALCULATION
// -----------------------------------------------------------------------------
export function calculateTrapezoid(
  parallel1: number,
  parallel2: number,
  height: number,
  side3?: number,
  side4?: number,
  unit: LengthUnit = 'feet',
  lang: 'bn' | 'en' = 'bn'
): CalculationOutput {
  const unitTxt = getUnitLabel(unit, lang);

  if (
    isNaN(parallel1) ||
    isNaN(parallel2) ||
    isNaN(height) ||
    parallel1 <= 0 ||
    parallel2 <= 0 ||
    height <= 0
  ) {
    return {
      isValid: false,
      errorMessage:
        lang === 'bn'
          ? 'দুটি সমান্তরাল বাহু ও উচ্চতার মান শূন্যের চেয়ে বড় হতে হবে।'
          : 'Both parallel sides and height must be greater than zero.',
      shape: 'trapezoid',
      areaSqFt: 0,
      inputDescription: '',
    };
  }

  const p1Ft = convertToFeet(parallel1, unit);
  const p2Ft = convertToFeet(parallel2, unit);
  const hFt = convertToFeet(height, unit);

  // Area = ((parallel1 + parallel2) * height) / 2
  const areaSqFt = ((p1Ft + p2Ft) * hFt) / 2;

  let perimeterFt: number | undefined = undefined;
  let perimeterUnitValue: number | undefined = undefined;

  if (side3 && side4 && side3 > 0 && side4 > 0) {
    const s3Ft = convertToFeet(side3, unit);
    const s4Ft = convertToFeet(side4, unit);
    perimeterFt = p1Ft + p2Ft + s3Ft + s4Ft;
    perimeterUnitValue = convertFeetToUnit(perimeterFt, unit);
  }

  const inputDescription =
    lang === 'bn'
      ? `সমান্তরাল বাহু ১: ${formatNumberByLang(parallel1, lang)} ${unitTxt}, সমান্তরাল বাহু ২: ${formatNumberByLang(parallel2, lang)} ${unitTxt}, উচ্চতা: ${formatNumberByLang(height, lang)} ${unitTxt}`
      : `Parallel 1: ${parallel1} ${unitTxt}, Parallel 2: ${parallel2} ${unitTxt}, Height: ${height} ${unitTxt}`;

  return {
    isValid: true,
    shape: 'trapezoid',
    areaSqFt,
    perimeterFt,
    perimeterUnitValue,
    inputDescription,
    details: {
      parallel1,
      parallel2,
      height,
      side3,
      side4,
      unit,
    },
  };
}

// -----------------------------------------------------------------------------
// 4. IRREGULAR / POLYGON CALCULATION (Shoelace / Gauss Formula)
// Ready for Phase 3 GPS Survey integration!
// -----------------------------------------------------------------------------
export function calculatePolygon(
  points: PolygonPoint[],
  unit: LengthUnit = 'feet',
  lang: 'bn' | 'en' = 'bn'
): CalculationOutput {
  if (!points || points.length < 3) {
    return {
      isValid: false,
      errorMessage:
        lang === 'bn'
          ? 'বহুভুজের ক্ষেত্রফল নির্ণয় করতে কমপক্ষে ৩টি বিন্দু প্রয়োজন।'
          : 'A polygon requires at least 3 points to calculate area.',
      shape: 'polygon',
      areaSqFt: 0,
      inputDescription: '',
    };
  }

  // Check for NaN or empty coordinates
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (isNaN(pt.x) || isNaN(pt.y)) {
      return {
        isValid: false,
        errorMessage:
          lang === 'bn'
            ? `বিন্দু ${pt.label}-এর স্থানাঙ্ক সঠিক নয়।`
            : `Coordinates for point ${pt.label} are invalid.`,
        shape: 'polygon',
        areaSqFt: 0,
        inputDescription: '',
      };
    }
  }

  // Convert points to feet
  const ptsFt = points.map((p) => ({
    label: p.label,
    x: convertToFeet(p.x, unit),
    y: convertToFeet(p.y, unit),
  }));

  const n = ptsFt.length;

  // Shoelace formula:
  // Area = 0.5 * |sum_{i=0}^{n-1} (x_i * y_{i+1} - x_{i+1} * y_i)|
  let shoelaceSum = 0;
  let perimeterFt = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    shoelaceSum += ptsFt[i].x * ptsFt[j].y;
    shoelaceSum -= ptsFt[j].x * ptsFt[i].y;

    // Distance between consecutive points
    const dx = ptsFt[j].x - ptsFt[i].x;
    const dy = ptsFt[j].y - ptsFt[i].y;
    perimeterFt += Math.sqrt(dx * dx + dy * dy);
  }

  const areaSqFt = 0.5 * Math.abs(shoelaceSum);
  const perimeterUnitValue = convertFeetToUnit(perimeterFt, unit);

  if (areaSqFt < 0.001) {
    return {
      isValid: false,
      errorMessage:
        lang === 'bn'
          ? 'বিন্দুগুলো দ্বারা কোনো আবদ্ধ এলাকা গঠিত হয়নি (ক্ষেত্রফল শূন্য বা বিন্দুগুলো একই সরলরেখায় অবস্থিত)।'
          : 'Points are collinear or do not form a closed area (area is zero).',
      shape: 'polygon',
      areaSqFt: 0,
      inputDescription: '',
    };
  }

  const pointLabels = points.map((p) => p.label).join('-');
  const inputDescription =
    lang === 'bn'
      ? `${formatNumberByLang(points.length, lang)}টি বিন্দুর বহুভুজ (${pointLabels})`
      : `${points.length}-Point Polygon (${pointLabels})`;

  return {
    isValid: true,
    shape: 'polygon',
    areaSqFt,
    perimeterFt,
    perimeterUnitValue,
    inputDescription,
    details: {
      pointsCount: points.length,
      unit,
    },
  };
}

// -----------------------------------------------------------------------------
// 4B. IRREGULAR QUADRILATERAL (4 SIDES + 1 DIAGONAL - HERON'S 2 TRIANGLES)
// Standard Bangladesh Amin survey method for irregular 4-sided plots
// -----------------------------------------------------------------------------
export function calculateQuadDiagonal(
  sideA: number,
  sideB: number,
  sideC: number,
  sideD: number,
  diagonal: number,
  unit: LengthUnit = 'feet',
  lang: 'bn' | 'en' = 'bn'
): CalculationOutput {
  const unitTxt = getUnitLabel(unit, lang);

  if (
    !sideA || !sideB || !sideC || !sideD || !diagonal ||
    sideA <= 0 || sideB <= 0 || sideC <= 0 || sideD <= 0 || diagonal <= 0
  ) {
    return {
      isValid: false,
      shape: 'quad_diagonal',
      areaSqFt: 0,
      inputDescription: '',
      errorMessage:
        lang === 'bn'
          ? 'অনুগ্রহ করে ৪টি বাহু এবং ১টি কর্ণের সঠিক মাপ লিখুন।'
          : 'Please enter positive dimensions for all 4 sides and 1 diagonal.',
    };
  }

  const aFt = convertToFeet(sideA, unit);
  const bFt = convertToFeet(sideB, unit);
  const cFt = convertToFeet(sideC, unit);
  const dFt = convertToFeet(sideD, unit);
  const diagFt = convertToFeet(diagonal, unit);

  // Triangle 1: a, b, diagonal
  if (aFt + bFt <= diagFt || aFt + diagFt <= bFt || bFt + diagFt <= aFt) {
    return {
      isValid: false,
      shape: 'quad_diagonal',
      areaSqFt: 0,
      inputDescription: '',
      errorMessage:
        lang === 'bn'
          ? 'বাহু ক, খ এবং কর্ণের মান দিয়ে ১ম ত্রিভুজ গঠন সম্ভব নয়।'
          : 'Sides A, B and Diagonal cannot form a valid triangle.',
    };
  }

  // Triangle 2: c, d, diagonal
  if (cFt + dFt <= diagFt || cFt + diagFt <= dFt || dFt + diagFt <= cFt) {
    return {
      isValid: false,
      shape: 'quad_diagonal',
      areaSqFt: 0,
      inputDescription: '',
      errorMessage:
        lang === 'bn'
          ? 'বাহু গ, ঘ এবং কর্ণের মান দিয়ে ২য় ত্রিভুজ গঠন সম্ভব নয়।'
          : 'Sides C, D and Diagonal cannot form a valid triangle.',
    };
  }

  // Heron's formula for triangle 1
  const s1 = (aFt + bFt + diagFt) / 2;
  const area1 = Math.sqrt(Math.max(0, s1 * (s1 - aFt) * (s1 - bFt) * (s1 - diagFt)));

  // Heron's formula for triangle 2
  const s2 = (cFt + dFt + diagFt) / 2;
  const area2 = Math.sqrt(Math.max(0, s2 * (s2 - cFt) * (s2 - dFt) * (s2 - diagFt)));

  const totalAreaSqFt = area1 + area2;
  const perimeterFt = aFt + bFt + cFt + dFt;
  const perimeterUnitValue = convertFeetToUnit(perimeterFt, unit);

  const inputDescription =
    lang === 'bn'
      ? `ক: ${formatNumberByLang(sideA, lang)} ${unitTxt}, খ: ${formatNumberByLang(sideB, lang)} ${unitTxt}, গ: ${formatNumberByLang(sideC, lang)} ${unitTxt}, ঘ: ${formatNumberByLang(sideD, lang)} ${unitTxt}, কর্ণ: ${formatNumberByLang(diagonal, lang)} ${unitTxt}`
      : `Side a: ${sideA} ${unitTxt}, b: ${sideB} ${unitTxt}, c: ${sideC} ${unitTxt}, d: ${sideD} ${unitTxt}, Diag: ${diagonal} ${unitTxt}`;

  return {
    isValid: true,
    shape: 'quad_diagonal',
    areaSqFt: totalAreaSqFt,
    perimeterFt,
    perimeterUnitValue,
    inputDescription,
    details: {
      sideA,
      sideB,
      sideC,
      sideD,
      diagonal,
      area1SqFt: area1,
      area2SqFt: area2,
      unit,
    },
  };
}

// -----------------------------------------------------------------------------
// 5. SUMMARY COPY FORMATTER (Strict Bangla/English formatting)
// -----------------------------------------------------------------------------
export function generateShareSummary(
  shape: LandShape,
  inputDescription: string,
  sqFt: number,
  perimeterFt?: number,
  lang: 'bn' | 'en' = 'bn'
): string {
  const units = calculateLandUnits(sqFt, perimeterFt);

  const shapeNamesBn: Record<LandShape, string> = {
    rectangle: 'আয়তক্ষেত্র',
    triangle: 'ত্রিভুজ',
    trapezoid: 'ট্রাপিজিয়াম',
    polygon: 'বহুভুজ / অনিয়মিত জমি',
    quad_diagonal: '৪ বাহু ও কর্ণ (অনিয়মিত চতুর্ভুজ)',
  };

  const shapeNamesEn: Record<LandShape, string> = {
    rectangle: 'Rectangle',
    triangle: 'Triangle',
    trapezoid: 'Trapezoid',
    polygon: 'Polygon / Irregular',
    quad_diagonal: '4-Sides & Diagonal (Irregular Quad)',
  };

  if (lang === 'bn') {
    let summary = `ভূমি ও আমিন\nজমির হিসাব\n\n`;
    summary += `আকৃতি: ${shapeNamesBn[shape]}\n`;
    summary += `${inputDescription}\n`;
    summary += `ক্ষেত্রফল: ${formatNumberByLang(units.sqFt, 'bn')} sq ft\n`;
    summary += `≈ ${formatNumberByLang(units.shatangsha, 'bn')} decimal (শতাংশ)\n`;
    summary += `≈ ${formatNumberByLang(units.katha, 'bn')} katha (কাঠা)\n`;
    summary += `≈ ${formatNumberByLang(units.bigha, 'bn')} bigha (বিঘা)\n`;
    summary += `≈ ${formatNumberByLang(units.acre, 'bn')} acre (একর)\n`;
    if (perimeterFt !== undefined && perimeterFt > 0) {
      summary += `পরিসীমা: ${formatNumberByLang(roundClean(perimeterFt, 2), 'bn')} ft\n`;
    }
    return summary.trim();
  } else {
    let summary = `Bhumi O Amin\nLand Measurement\n\n`;
    summary += `Shape: ${shapeNamesEn[shape]}\n`;
    summary += `${inputDescription}\n`;
    summary += `Total Area: ${units.sqFt} sq ft\n`;
    summary += `≈ ${units.shatangsha} decimal\n`;
    summary += `≈ ${units.katha} katha\n`;
    summary += `≈ ${units.bigha} bigha\n`;
    summary += `≈ ${units.acre} acre\n`;
    if (perimeterFt !== undefined && perimeterFt > 0) {
      summary += `Perimeter: ${roundClean(perimeterFt, 2)} ft\n`;
    }
    return summary.trim();
  }
}

// -----------------------------------------------------------------------------
// 6. LOCAL STORAGE CALCULATION HISTORY
// -----------------------------------------------------------------------------
const STORAGE_KEY = 'bhumi_amin_calc_history';

export function getStoredHistory(): SavedCalculation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCalculationToHistory(
  item: Omit<SavedCalculation, 'id' | 'timestamp' | 'dateStr'>,
  lang: 'bn' | 'en' = 'bn'
): SavedCalculation[] {
  const history = getStoredHistory();
  const now = new Date();

  const dateStr =
    lang === 'bn'
      ? now.toLocaleDateString('bn-BD', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : now.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

  const newItem: SavedCalculation = {
    ...item,
    id: 'calc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    dateStr,
  };

  // Keep latest 50 items
  const updated = [newItem, ...history.filter((h) => h.id !== newItem.id)].slice(
    0,
    50
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save calculation history to localStorage', e);
  }

  return updated;
}

export function deleteHistoryItem(id: string): SavedCalculation[] {
  const history = getStoredHistory();
  const updated = history.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to update localStorage', e);
  }
  return updated;
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear history from localStorage', e);
  }
}
