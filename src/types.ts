export type Language = 'bn' | 'en';

export type UserRole = 'customer' | 'amin' | 'admin';
export type UserStatus = 'active' | 'pending' | 'suspended';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  photoUrl?: string;
  district?: string;
  upazila?: string;
  createdAt: string;
  updatedAt: string;
  status: UserStatus;
}

export interface CustomerProfile {
  userId: string;
  name: string;
  phone: string;
  email: string;
  district?: string;
  upazila?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  uid?: string;
  actorRole: UserRole | 'system';
  role?: UserRole | 'system';
  action: string;
  entityType: 'booking' | 'amin' | 'report' | 'survey' | 'complaint' | 'service' | 'user' | 'payment';
  entityId: string;
  target?: string;
  timestamp: string;
  details?: string;
}

export type NavTab =
  | 'home'
  | 'survey'
  | 'calc'
  | 'services'
  | 'profile'
  | 'measure'
  | 'possession'
  | 'maps'
  | 'khatian'
  | 'reports'
  | 'mouza_rates'
  | 'dalil'
  | 'converter';

export interface SurveyPoint {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  x: number; // for 2D plot canvas
  y: number;
  bearing?: number; // degrees
  distance?: number; // feet
  accuracy?: number; // meters
  timestamp?: number;
  label?: string;
}

export interface DrawingAnnotation {
  id: string;
  type: 'point' | 'line' | 'polygon' | 'rectangle' | 'text' | 'dimension';
  x: number; // local metric coordinates (xMeters)
  y: number; // local metric coordinates (yMeters)
  x2?: number;
  y2?: number;
  points?: { x: number; y: number }[];
  text?: string;
  label?: string;
  color?: string;
  createdAt?: number;
}

export interface AdditionalSideMeasurement {
  id: string;
  name: string;
  length: number;
  unit: LengthUnit;
  notes?: string;
}

export type PlotCalculationMethod = 'average' | 'diagonal';

export interface SurveyPlotRecord {
  id: string;
  plotName: string;
  dagNo: string;
  khatianNo?: string;
  unit: LengthUnit;
  calculationMethod?: PlotCalculationMethod;
  northSide: number;
  southSide: number;
  eastSide: number;
  westSide: number;
  northNotes?: string;
  southNotes?: string;
  eastNotes?: string;
  westNotes?: string;
  additionalSides?: AdditionalSideMeasurement[];
  diagonal?: number;
  diagonalChoice?: 'AC' | 'BD';
  diagonalNotes?: string;
  notes?: string;
  perimeterFt: number;
  perimeterMeters: number;
  areaSqFt: number | null;
  areaSqMeters: number | null;
  decimal: number | null;
  katha: number | null;
  bigha?: number | null;
  acre?: number | null;
  averageLengthFt?: number | null;
  averageWidthFt?: number | null;
  isApproximate?: boolean;
  isGeometryValid: boolean;
  isGeometryUnderdetermined: boolean;
  geometryValidationMessage?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface DrawingSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthFt?: number;
  label?: string;
}

/** per-plot decoration + where its result card sits (all optional) */
export interface PlotMeta {
  id: string;
  color?: string;
  style?: 'plain' | 'box' | 'solid';
  dx?: number;
  dy?: number;
  title?: string;
  titleColor?: string;
  dagNo?: string;
  completed?: boolean;
  bw?: number;
  bh?: number;
}

export interface SurveyDrawing {
  segments: DrawingSegment[];
  plots?: PlotMeta[];
  updatedAt: number;
}

export interface SurveyRecord {
  id: string;
  title: string;
  mouza: string;
  jlNo: string;
  dagNo: string;
  khatianNo?: string;
  date: string;
  areaSqFt: number;
  perimeterFt: number;
  points: SurveyPoint[];
  status: 'draft' | 'completed' | 'verified';
  notes?: string;
  // Phase 5 Land Information & Metadata
  clientName?: string;
  district?: string;
  upazila?: string;
  union?: string;
  surveyorName?: string;
  annotations?: DrawingAnnotation[];
  // Phase 8 Cloud & Ownership Integration
  ownerId?: string;
  bookingId?: string;
  customerId?: string;
  aminId?: string;
  accuracy?: number;
  createdAt?: string | number;
  updatedAt?: string | number;
  // Phase 20C Practical Occupation Survey: Individual Side Measurements & Multi-Plots
  plots?: SurveyPlotRecord[];
  // Drawing-based measurement (flat objects only; no nested arrays, for Firestore)
  drawing?: SurveyDrawing;
}

export type ReportStatus = 'draft' | 'final';

export interface SurveyReportRecord {
  id: string; // Unique ID (e.g. rep-1726300000)
  reportNumber: string; // Formatted BHOA-YYYYMMDD-XXXX
  surveyId: string;
  status: ReportStatus;
  title: string;
  reportDate: string; // YYYY-MM-DD
  surveyDate: string; // YYYY-MM-DD
  finalizedDate?: string;

  // Client & Land Information
  clientName: string;
  clientPhone?: string;
  district: string;
  upazila: string;
  union: string;
  mouza: string;
  jlNo: string;
  dagNo: string;
  khatianNo: string;
  landClass?: string;
  surveyorName: string;
  notes?: string;
  declaration?: string;
  drawingNotes?: string;

  // Geometry & Land Units
  points: SurveyPoint[];
  areaSqFt: number;
  areaSqMeters: number;
  perimeterFt: number;
  perimeterMeters: number;
  decimal: number;
  katha: number;
  bigha: number;
  acre: number;

  // Phase 20C Individual Plot Records
  plots?: SurveyPlotRecord[];

  // GPS Accuracy Stats
  avgAccuracy?: number;
  bestAccuracy?: number;
  worstAccuracy?: number;

  // Visual Annotations
  annotations?: DrawingAnnotation[];

  createdAt: number;
  updatedAt: number;

  // Phase 8 Cloud & Ownership Integration
  ownerId?: string;
  bookingId?: string;
  customerId?: string;
  aminId?: string;
  pentagraphProjectId?: string;
  surveyRecordId?: string;

  // Phase 16B: Optional Analysis Sections (Rendered only when data exists)
  khatianAnalysis?: KhatianReportSectionData;
  hisshaCalculation?: HisshaReportSectionData;
  tafsilDistribution?: TafsilReportSectionData;
  inheritanceCalculation?: InheritanceReportSectionData;
  mapComparison?: MapComparisonReportSectionData;
  googleMapsParcel?: GoogleMapsParcelReportSectionData;
}

export interface KhatianReportSectionData {
  khatianType?: string;
  khatianNo?: string;
  totalLandDecimal?: number;
  owners?: Array<{ name: string; shareStr: string; decimal: number }>;
  dags?: Array<{ dagNo: string; landClass: string; decimal: number }>;
  notes?: string;
}

export interface HisshaReportSectionData {
  totalLandDecimal: number;
  owners: Array<{ name: string; sharePercent: number; decimal: number; katha?: number }>;
  totalPercent: number;
  notes?: string;
}

export interface TafsilReportSectionData {
  totalPlots: number;
  totalLandDecimal: number;
  plots: Array<{ dagNo: string; landClass?: string; decimal: number; ownerAllocation?: string }>;
  notes?: string;
}

export interface InheritanceReportSectionData {
  deceasedName?: string;
  religion?: string;
  totalEstateDecimal: number;
  heirs: Array<{ relation: string; count: number; shareFraction?: string; shareDecimal?: number }>;
  notes?: string;
}

export interface MapComparisonReportSectionData {
  mouzaMapTitle: string;
  dagNo: string;
  mapAreaDecimal: number;
  gpsAreaDecimal: number;
  diffDecimal: number;
  variancePercent: number;
  matchGrade: 'excellent' | 'acceptable' | 'high_variance';
  notes?: string;
}

export interface GoogleMapsParcelReportSectionData {
  parcelId: string;
  title: string;
  pointsCount: number;
  areaDecimal: number;
  areaSqFt: number;
  perimeterFt: number;
  source: string;
  coordinates?: Array<{ label: string; lat: number; lng: number }>;
}

export interface DigitalDrawingRecord {
  id: string;
  ownerId: string;
  surveyRecordId?: string;
  bookingId?: string;
  annotations: DrawingAnnotation[];
  createdAt: number;
  updatedAt: number;
}

export type LengthUnit = 'feet' | 'meter' | 'link' | 'yard' | 'haat';

export type LandShape = 'rectangle' | 'triangle' | 'trapezoid' | 'polygon' | 'quad_diagonal';

export type TriangleCalcMode = 'base_height' | 'three_sides';

export type LandAreaUnit = 'decimal' | 'sqFt' | 'katha' | 'bigha' | 'acre' | 'sqMeter';

export interface HisshaOwner {
  id: string;
  name: string;
  sharePercent: number;
}

export interface AnaGondaValue {
  ana: number;
  gonda: number;
  kora: number;
  kranti: number;
  til: number;
}

export interface TafsilOwner {
  id: string;
  name: string;
  sharePercent: number;
  position?: string;
  notes?: string;
}

export interface InheritanceHeir {
  id: string;
  relation: string;
  gender: 'male' | 'female';
  count: number;
  note?: string;
}

export interface PolygonPoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface CalculationResult {
  sqFt: number;
  sqMeter: number;
  shatangsha: number; // Decimal: 1 decimal = 435.6 sq ft
  katha: number;      // 1 katha = 720 sq ft
  bigha: number;      // 1 bigha = 20 katha = 14400 sq ft
  acre: number;       // 1 acre = 100 decimal = 43560 sq ft
  perimeterFt?: number;
  gonda?: number;     // 1 katha = 4 gonda (180 sq ft)
  kora?: number;      // 1 gonda = 4 kora (45 sq ft)
  kranti?: number;    // 1 kora = 3 kranti (15 sq ft)
  til?: number;       // 1 kranti = 20 til (0.75 sq ft)
}

export interface SavedCalculation {
  id: string;
  timestamp: number;
  dateStr: string;
  shape: LandShape;
  shapeNameBn: string;
  shapeNameEn: string;
  inputDescription: string;
  unit: LengthUnit;
  areaSqFt: number;
  areaSqMeter: number;
  shatangsha: number;
  katha: number;
  bigha: number;
  acre: number;
  perimeterFt?: number;
  perimeterUnitValue?: number;
  details?: Record<string, string | number>;
}

export interface ServiceItem {
  id: string;
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  subtitleEn: string;
  descBn: string;
  descEn: string;
  iconName: string;
  estimatedDays: string;
  documents: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'assistant';
  content: string;
  timestamp: string;
}

// ==========================================
// PHASE 12B: MOUZA MAP & DAG FOUNDATION
// ==========================================

export type MouzaMapSourceType = 'image' | 'pdf' | 'geojson' | 'kml' | 'dxf';

export type VertexPointType = 'gps' | 'digitized' | 'manual' | 'control';

export interface DigitizedDagPoint {
  id: string;
  x: number; // canvas coordinate X
  y: number; // canvas coordinate Y
  lat?: number; // optional geographic latitude (ONLY if genuine GPS point)
  lng?: number; // optional geographic longitude (ONLY if genuine GPS point)
  sourceType?: VertexPointType;
  label?: string;
}

export interface DigitizedDagRecord {
  id: string;
  dagNo: string;
  mouzaMapId: string;
  points: DigitizedDagPoint[];
  originalPoints?: DigitizedDagPoint[];
  isEdited?: boolean;
  areaSqFt: number;
  areaDecimal: number;
  areaKatha: number;
  areaBigha?: number;
  perimeterFt: number;
  notes?: string;
  color?: string;
  createdAt: number | string;
  updatedAt: number | string;
}

export interface MouzaMapRecord {
  id: string;
  title: string;
  district: string;
  upazila: string;
  mouza: string;
  jlNo: string;
  khatianRef?: string;
  defaultDagNo?: string;
  sourceType: MouzaMapSourceType;
  fileName: string;
  fileDataUrl?: string; // Data URL for image or PDF preview
  rawGeoJson?: any; // Parsed GeoJSON if imported as vector
  rawKmlText?: string;
  rawDxfText?: string;
  scalePixelsPerFoot?: number; // Scale ratio: pixels per foot (default e.g. 1.0)
  scaleBarMeters?: number;
  digitizedDags: DigitizedDagRecord[];
  linkedSurveyId?: string; // Linked GPS Survey record ID
  notes?: string;
  ownerId?: string;
  createdAt: number | string;
  updatedAt: number | string;
}

export interface LandVerificationResult {
  mapAreaSqFt: number;
  mapAreaDecimal: number;
  gpsAreaSqFt: number;
  gpsAreaDecimal: number;
  diffSqFt: number;
  diffDecimal: number;
  percentageDiff: number;
  matchGrade: 'excellent' | 'acceptable' | 'high_variance';
  disclaimerBn: string;
  disclaimerEn: string;
}

// ==========================================
// PHASE 12C: COMPARATIVE PENTAGRAPH, MAP JOINT & ADVANCED VERIFICATION
// ==========================================

export type PentagraphLayerType =
  | 'mouza_sheet'
  | 'digitized_dag'
  | 'gps_survey'
  | 'saved_drawing';

export interface PentagraphLayerConfig {
  id: string;
  type: PentagraphLayerType;
  name: string;
  nameBn: string;
  visible: boolean;
  opacity: number; // 0.0 to 1.0
  color: string;
  showLabels: boolean;
  pointsCount: number;
  areaSqFt: number;
  areaDecimal: number;
  perimeterFt: number;
}

export interface PentagraphComparisonMetrics {
  mapAreaSqFt: number;
  mapAreaDecimal: number;
  gpsAreaSqFt: number;
  gpsAreaDecimal: number;
  drawingAreaSqFt?: number;
  drawingAreaDecimal?: number;
  diffSqFt: number;
  diffDecimal: number;
  percentageVariance: number;
  perimeterMapFt: number;
  perimeterGpsFt: number;
  perimeterDiffFt: number;
  centroidDisplacementFt?: number;
  displacementDirectionEn?: string;
  displacementDirectionBn?: string;
  matchGrade: 'excellent' | 'acceptable' | 'high_variance';
}

export type UploadedFileType = 'pdf' | 'image' | 'geojson' | 'kml';
export type MapLayerCategory = 'cs_map' | 'bs_map' | 'rs_map' | 'general';

export interface UploadedMapFile {
  id: string;
  name: string;
  fileType: UploadedFileType;
  mimeType: string;
  size: number;
  sizeFormatted: string;
  uploadedAt: number | string;
  dataUrl?: string; // stored base64 or object URL
  rawText?: string; // for GeoJSON or KML text
  category?: MapLayerCategory;
  projectId?: string;
  pageCount?: number;
  notes?: string;
}

export interface LayerEditedGeometry {
  layerId: string;
  points: DigitizedDagPoint[];
  originalPoints?: DigitizedDagPoint[];
  isEdited: boolean;
  updatedAt: number | string;
}

export interface ComparativePentagraphProject {
  id: string;
  title: string;
  mouzaMapId: string;
  dagId?: string;
  surveyId?: string;
  bookingId?: string;
  csFileId?: string;
  csFileName?: string;
  bsFileId?: string;
  bsFileName?: string;
  additionalFileIds?: string[];
  layers: PentagraphLayerConfig[];
  metrics: PentagraphComparisonMetrics;
  editedGeometries?: Record<string, LayerEditedGeometry>;
  demarcationSurveyedPoints?: DigitizedDagPoint[];
  demarcationReferencePoints?: DigitizedDagPoint[];
  clientName?: string;
  khatianNo?: string;
  unit?: 'feet' | 'link';
  notes?: string;
  ownerId?: string;
  customerId?: string;
  aminId?: string;
  status?: string;
  createdAt: number | string;
  updatedAt: number | string;
}

export interface MapJointSheetLayer {
  id: string;
  mouzaMapId: string;
  title: string;
  sourceType: MouzaMapSourceType;
  fileDataUrl?: string;
  x: number; // translation dx
  y: number; // translation dy
  rotation: number; // degrees
  scale: number; // scale multiplier e.g. 1.0
  opacity: number; // 0.0 to 1.0
  visible: boolean;
}

export interface ControlPointPair {
  id: string;
  pointName: string; // e.g. "CP-1", "CP-2", "CP-3"
  ptA: { x: number; y: number; label?: string };
  ptB: { x: number; y: number; label?: string };
  distancePx?: number;
}

export interface MapJointProject {
  id: string;
  title: string;
  layers: MapJointSheetLayer[];
  controlPoints: ControlPointPair[];
  notes?: string;
  ownerId?: string;
  createdAt: number | string;
  updatedAt: number | string;
}

export interface AdvancedVerificationMatrix {
  dagAreaSqFt: number;
  dagAreaDecimal: number;
  dagPerimeterFt: number;
  dagPointCount: number;
  gpsAreaSqFt: number;
  gpsAreaDecimal: number;
  gpsPerimeterFt: number;
  gpsPointCount: number;
  drawingAreaSqFt?: number;
  drawingAreaDecimal?: number;
  drawingPerimeterFt?: number;
  drawingPointCount?: number;
  areaDiffSqFt: number;
  areaDiffDecimal: number;
  percentageDiff: number;
  perimeterDiffFt: number;
  centroidShiftFt?: number;
  matchGrade: 'excellent' | 'acceptable' | 'high_variance';
  disclaimerBn: string;
  disclaimerEn: string;
}

// ==========================================
// PHASE 7: AMIN MARKETPLACE & BOOKINGS TYPES
// ==========================================

export type MarketplaceRole = 'customer' | 'amin' | 'admin';

// PHASE 17A & 17B: PAYMENT & COMMISSION STATUS
export type PaymentStatus =
  | 'unpaid'
  | 'payment_pending'
  | 'pending'
  | 'paid'
  | 'refunded'
  | 'failed';

// PHASE 17B: PAYMENT METHODS
export type PaymentMethod =
  | 'bkash'
  | 'nagad'
  | 'card'
  | 'cash'
  | 'bank'
  | 'manual';

export type BookingStatus =
  | 'pending'
  | 'under_review'
  | 'assigned'
  | 'amin_accepted'
  | 'scheduled'
  | 'field_work'
  | 'processing'
  | 'quality_check'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'disputed';

export interface AuditHistoryEntry {
  status: BookingStatus;
  previousStatus?: BookingStatus;
  actorUid?: string;
  changedAt: string;
  changedBy: string;
  role: MarketplaceRole | 'system';
  note?: string;
}

export interface AppNotification {
  id: string;
  recipientUid?: string;
  recipientRole?: MarketplaceRole;
  titleBn: string;
  titleEn: string;
  messageBn: string;
  messageEn: string;
  bookingId?: string;
  type: 'booking' | 'assignment' | 'qc' | 'report' | 'correction' | 'complaint' | 'system';
  isRead: boolean;
  createdAt: string;
}

export type ServiceCategory =
  | 'survey'
  | 'possession'
  | 'boundary'
  | 'drawing'
  | 'comparison'
  | 'khatian'
  | 'mutation'
  | 'other';

export interface MarketplaceService {
  id: string;
  nameBn: string;
  nameEn: string;
  shortDescBn: string;
  shortDescEn: string;
  descriptionBn: string;
  descriptionEn: string;
  category: ServiceCategory;
  // Phase 17A Service Pricing & Commission fields
  basePrice?: number; // Base service price in BDT
  minPrice?: number; // Optional minimum price bound
  maxPrice?: number; // Optional maximum price bound
  commissionPercentage?: number; // Platform commission % (e.g. 10)
  aminEarning?: number; // Calculated net Amin earning
  platformEarning?: number; // Calculated platform commission earning
  platformCommission?: number; // Calculated platform commission
  customerPayable?: number; // Calculated customer payable amount
  totalAmount?: number; // Calculated total amount
  currency?: string; // Currency code, defaults to 'BDT'
  // Backward compatibility fields
  baseFee: number;
  platformFee: number;
  estimatedDays: string;
  active: boolean;
  iconName: string;
  includedBn: string[];
  includedEn: string[];
  requiredCustomerInfoBn: string[];
  requiredCustomerInfoEn: string[];
  requiredLandInfoBn: string[];
  requiredLandInfoEn: string[];
  disclaimerBn: string;
  disclaimerEn: string;
}

export interface PricingSnapshot {
  serviceId: string;
  serviceNameBn: string;
  serviceNameEn: string;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  commissionPercentage: number;
  platformCommission: number;
  aminEarning: number;
  platformEarning: number;
  customerPayable: number;
  totalAmount: number;
  currency: string;
  snapshotAt: string;
}

export interface CustomerBooking {
  id: string; // Format: BHOA-BOOK-YYYYMMDD-XXXX
  bookingNumber?: string;
  customerId?: string;
  serviceId: string;
  serviceNameBn: string;
  serviceNameEn: string;
  serviceName?: string;
  customer: {
    name: string;
    mobile: string;
    email?: string;
  };
  land: {
    district: string;
    upazila: string;
    union: string;
    mouza: string;
    jlNo?: string;
    dagNo: string;
    khatianNo?: string;
  };
  surveyRequirements: {
    approxLandSize?: number;
    unit?: string;
    preferredDate?: string;
    preferredTime?: string;
    locationDescription?: string;
    additionalNotes?: string;
    documentsNote?: string;
  };
  location: {
    manualAddress?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    hasGps?: boolean;
  };
  pricing: {
    serviceFee: number;
    additionalFee?: number;
    platformFee: number;
    totalFee: number;
    currency: string;
    // Phase 17A pricing foundation
    basePrice?: number;
    commissionPercentage?: number;
    platformCommission?: number;
    aminEarning?: number;
    platformEarning?: number;
    customerPayable?: number;
  };
  // Phase 17A & 17B: Payment status, details & immutable pricing snapshot
  paymentStatus?: PaymentStatus;
  pricingSnapshot?: PricingSnapshot;
  paymentMethod?: PaymentMethod;
  paymentReference?: string; // Transaction ID (TrxID) or manual reference number
  paymentPaidAt?: string; // Timestamp of payment record
  paymentNotes?: string; // Notes entered regarding payment
  paymentVerifiedBy?: string; // Admin user ID or name who verified payment
  paymentVerifiedAt?: string; // Verification timestamp
  paymentGatewayMetadata?: {
    provider?: string;
    gatewayTransactionId?: string;
    checkoutUrl?: string;
    statusResponse?: string;
  };
  status: BookingStatus;
  statusHistory: AuditHistoryEntry[];
  assignedAminId?: string;
  assignedAminName?: string;
  assignedAminPhone?: string;
  assignedBy?: string;
  assignedAt?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  fee?: number;
  aminNotes?: string;
  adminNotes?: string;
  linkedSurveyId?: string;
  linkedReportId?: string;
  qualityCheckNotes?: string;
  qualityCheckApproved?: boolean;
  qualityCheckedBy?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AminProfile {
  id: string;
  userId?: string;
  name: string;
  phone?: string;
  mobile: string;
  email?: string;
  district?: string;
  upazila?: string;
  isDemo?: boolean;
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'suspended';
  verifiedAt?: string;
  serviceDistricts: string[];
  serviceUpazilas: string[];
  serviceAreas?: string;
  services?: string[];
  servicesOffered: string[];
  experienceYears: number;
  rating: number;
  ratingAverage?: number;
  completedJobsCount: number;
  completedJobs?: number;
  languages?: string[];
  availability: 'available' | 'busy' | 'unavailable';
  bioBn: string;
  bioEn: string;
  description?: string;
  credentialsBn?: string;
  credentialsEn?: string;
  joinedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AminApplication {
  id: string;
  applicantName: string;
  mobile: string;
  email?: string;
  district: string;
  upazila: string;
  experienceYears: number;
  serviceAreas: string;
  services: string[];
  description: string;
  credentials: string;
  status: 'pending' | 'verified' | 'rejected' | 'approved';
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface CustomerRating {
  id: string;
  bookingId: string;
  aminId: string;
  customerId?: string;
  customerName: string;
  rating: number; // 1 to 5
  review?: string;
  comment?: string;
  createdAt: string;
}

export interface CustomerComplaint {
  id: string;
  bookingId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerMobile?: string;
  aminId?: string;
  issueType: 'delay' | 'quality' | 'conduct' | 'discrepancy' | 'pricing' | 'other' | string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed' | 'submitted' | 'under_investigation';
  resolutionNotes?: string;
  submittedAt?: string;
  createdAt?: string;
  resolvedAt?: string;
}

export interface PaymentRefundInfo {
  refundedAmount: number;
  refundTransactionId?: string;
  refundedAt: string;
  refundReason: string;
  refundStatus: 'completed' | 'failed' | 'pending';
  processedBy?: string;
}

// Phase 17C: Full payment lifecycle status
export type PaymentLifecycleStatus =
  | 'initiated'
  | 'pending'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'refunded';

// Phase 17C: Comprehensive Transaction Data Model
export interface PaymentTransaction {
  id: string;
  bookingId: string;
  paymentId: string;
  transactionId?: string; // Gateway transaction reference (TrxID)
  provider: PaymentMethod;
  amount: number;
  currency: 'BDT';
  status: PaymentLifecycleStatus;
  idempotencyKey?: string;
  customerId?: string;
  customerInfo?: {
    name: string;
    mobile: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  failureReason?: string;
  refundInfo?: PaymentRefundInfo;
  isLiveGateway: boolean; // false = foundation/manual mode
  metadata?: Record<string, unknown>;
}

export interface PaymentRecord {
  paymentId: string;
  bookingId: string;
  amount: number;
  method: 'bkash' | 'nagad' | 'card' | 'cash_on_field' | PaymentMethod;
  status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | PaymentLifecycleStatus;
  transactionId?: string;
  createdAt: string;
  note?: string;
  provider?: PaymentMethod;
  verifiedAt?: string;
  verifiedBy?: string;
  idempotencyKey?: string;
  failureReason?: string;
  refundInfo?: PaymentRefundInfo;
}

export interface AminAssignment {
  bookingId: string;
  aminId: string;
  assignedAt: string;
  assignedBy: string;
  status: 'offered' | 'accepted' | 'rejected';
  rejectionReason?: string;
}

// ========================================================
// PHASE 18: AI SKETCH TO DIGITAL DRAWING (খাতার নকশা থেকে ডিজিটাল ড্রয়িং)
// ========================================================

export type ElementProvenance = 'ai_detected' | 'user_corrected' | 'user_added';

export interface DetectedPoint {
  id: string;
  name: string; // e.g. "A", "B", "C", "ক", "খ"
  type?: 'point' | 'corner' | 'station';
  label?: string;
  x: number; // Normalized coordinate 0-1000 or canvas px
  y: number;
  confidence?: number; // 0.0 to 1.0 (e.g. 0.95 = 95%)
  isCorner?: boolean;
  provenance?: ElementProvenance;
  sourceDescription?: string;
}

export interface DetectedLine {
  id: string;
  fromPointId: string;
  toPointId: string;
  distanceFt?: number;
  distanceLinks?: number;
  isBoundary?: boolean;
  type?: 'boundary' | 'subdivision' | 'tie_line' | 'offset';
  label?: string;
  confidence?: number;
  provenance?: ElementProvenance;
  sourceDescription?: string;
}

export interface DetectedPolygon {
  pointIds: string[];
  areaSqFt?: number;
  perimeterFt?: number;
  decimal?: number;
}

export interface DetectedDimension {
  id: string;
  fromPointId: string;
  toPointId: string;
  valueFt: number;
  unit: 'ft' | 'links' | 'm';
  rawText?: string;
  label?: string;
  confidence?: number;
  provenance?: ElementProvenance;
  sourceDescription?: string;
}

export interface DetectedLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  type: 'dag' | 'khatian' | 'mouza' | 'road' | 'pond' | 'canal' | 'boundary' | 'other';
  confidence?: number;
  provenance?: ElementProvenance;
  sourceDescription?: string;
}

export interface DetectedNorthArrow {
  detected: boolean;
  angleDegrees: number; // 0 = Up, 90 = Right, etc.
  x?: number;
  y?: number;
  confidence?: number;
  provenance?: ElementProvenance;
  sourceDescription?: string;
}

export interface DetectedFeature {
  id: string;
  type: 'road' | 'pond' | 'canal' | 'drain' | 'tree' | 'building' | 'border_post' | 'other';
  name: string;
  label?: string;
  points: { x: number; y: number }[];
  notes?: string;
  confidence?: number;
  provenance?: ElementProvenance;
  sourceDescription?: string;
}

export interface SketchDetectionData {
  points: DetectedPoint[];
  lines: DetectedLine[];
  polygon: DetectedPolygon;
  dimensions: DetectedDimension[];
  labels: DetectedLabel[];
  northArrow: DetectedNorthArrow;
  features: DetectedFeature[];
  dagNo?: string;
  khatianNo?: string;
  mouza?: string;
  detectedTextSummary?: string[];
  rawAiOutput?: string;
  isAiAssisted: boolean;
  confidenceScore?: number;
}

export interface SketchDigitalDrawing {
  points: SurveyPoint[];
  annotations: DrawingAnnotation[];
  areaSqFt: number;
  perimeterFt: number;
  decimal: number;
  katha: number;
  bigha: number;
  dagNo: string;
  khatianNo: string;
  mouza: string;
  northArrowAngle: number;
  features?: DetectedFeature[];
}

export type SketchReviewStatus = 'pending_review' | 'in_review' | 'approved' | 'rejected';

export interface SketchRecord {
  id: string;
  title: string;
  originalImageUrl: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  imageDimensions?: { width: number; height: number };
  uploadedAt: number;
  analyzedAt?: number;
  reviewedAt?: number;
  reviewStatus: SketchReviewStatus;
  reviewerName?: string;
  notes?: string;
  detectionData?: SketchDetectionData;
  digitalDrawing?: SketchDigitalDrawing;
  surveyRecordId?: string; // Linked SurveyRecord for Phase 5 Digital Drawing & PDF Report
  metadata: {
    clientName?: string;
    surveyorName?: string;
    mouza?: string;
    jlNo?: string;
    dagNo?: string;
    khatianNo?: string;
    district?: string;
    upazila?: string;
  };
  aiEngineStatus: 'connected' | 'analyzed' | 'integration_ready' | 'not_configured' | 'error';
  aiModelUsed?: string;
}

// Phase 20F: Administrative Location, Mouza Metadata & Catalog Types
export * from './types/administrative-location';
