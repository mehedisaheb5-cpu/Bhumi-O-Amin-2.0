import {
  MarketplaceService,
  CustomerBooking,
  AminProfile,
  AminApplication,
  CustomerRating,
  CustomerComplaint,
  BookingStatus,
  AuditHistoryEntry,
  MarketplaceRole,
  PaymentStatus,
} from '../types';
import {
  normalizeServicePricing,
  createPricingSnapshot,
  calculatePricingBreakdown,
} from './pricing-commission';

export const STORAGE_KEYS = {
  SERVICES: 'bhumi-amin-services',
  BOOKINGS: 'bhumi-amin-bookings',
  AMINS: 'bhumi-amin-amins',
  APPLICATIONS: 'bhumi-amin-amin-applications',
  RATINGS: 'bhumi-amin-ratings',
  COMPLAINTS: 'bhumi-amin-complaints',
  ASSIGNMENTS: 'bhumi-amin-assignments',
  ACTIVE_ROLE: 'bhumi-amin-active-role',
} as const;

// 8 Standard Service Categories (Configurable)
export const DEFAULT_SERVICES: MarketplaceService[] = [
  {
    id: 'srvc-land-meas',
    nameBn: 'জমি মাপজোক',
    nameEn: 'Land Measurement',
    shortDescBn: 'সঠিক শিকল ও ডিজিটাল ফিতা দিয়ে সরজমিনে জমি পরিমাপ ও সীমানা নির্ধারণ।',
    shortDescEn: 'Accurate boundary measurement and corner marking with chains and digital tapes.',
    descriptionBn:
      'অভিজ্ঞ সরকারি সনদপ্রাপ্ত আমিনের উপস্থিতিতে মৌজা নকশা ও দলিলের বর্ণনা অনুযায়ী সরজমিনে জমি নিখুঁতভাবে পরিমাপ করা হয়। সীমানা খুঁটি স্থাপন এবং বিরোধহীনভাবে প্রকৃত দখল নির্ণয় করা হয়।',
    descriptionEn:
      'Certified professional surveyors inspect the physical land against official Mouza cadastral maps and registered deeds, establishing boundary corner markers.',
    category: 'survey',
    basePrice: 2500,
    minPrice: 1800,
    maxPrice: 5000,
    commissionPercentage: 10,
    aminEarning: 2250,
    platformEarning: 250,
    baseFee: 2500,
    platformFee: 250,
    estimatedDays: '১-২ কর্মদিবস',
    active: true,
    iconName: 'Compass',
    includedBn: [
      'মৌজা নকশা মিলিয়ে সীমানা যাচাই',
      'প্রমিত গান্টার শিকল বা লেজার ফিতায় পরিমাপ',
      'চারদিকের সীমানা খুঁটি বা আইল চিহ্নিতকরণ',
      'হাতে আঁকা বা ডিজিটাল খসড়া ফিল্ড স্কেচ',
      'শতাংশ, কাঠা ও বিঘায় ক্ষেত্রফল বিশ্লেষণ',
    ],
    includedEn: [
      'Boundary verification matching Mouza sheet',
      'Measurement with standard Gunter chain or laser tape',
      'Corner boundary marker or ridge demarcation',
      'Provisional hand-drawn or digital field sketch',
      'Area calculation in Decimal, Katha, and Bigha',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের পূর্ণ নাম ও মোবাইল নম্বর', 'জমির উপস্থিত প্রতিনিধির তথ্য'],
    requiredCustomerInfoEn: ['Customer full name & active mobile number', 'Contact person on site'],
    requiredLandInfoBn: ['জেলা, উপজেলা, মৌজা ও দাগ নম্বর', 'খতিয়ান নম্বর (যদি জানা থাকে)'],
    requiredLandInfoEn: ['District, Upazila, Mouza and Plot/Dag number', 'Khatian number (if available)'],
    disclaimerBn:
      'প্রযোজ্য সরকারি রেকর্ড ও পেশাদার জরিপ পদ্ধতির ভিত্তিতে সেবা প্রদান করা হয়। এটি কোনো পক্ষীয় বিরোধের চূড়ান্ত আইনি রায় নয়।',
    disclaimerEn:
      'Services are provided based on applicable government records and professional surveying standards. Not a substitute for a court decree.',
  },
  {
    id: 'srvc-possession',
    nameBn: 'দখল পরিমাপ',
    nameEn: 'Possession Measurement',
    shortDescBn: 'সরজমিনে প্রকৃত দখলকৃত অংশের পরিমাপ ও দলিল/খতিয়ানের সাথে সামঞ্জস্য যাচাই।',
    shortDescEn: 'Physical possession assessment and verification against deed/khatian entitlements.',
    descriptionBn:
      'আপনার ক্রয়কৃত বা পৈতৃক দলিলের পরিমাণের তুলনায় সরজমিনে আপনার দখলে কতটুকু জমি আছে এবং কোনো প্রতিবেশী অনুপ্রবেশ করেছে কিনা তা নির্ভুলভাবে নিরূপণ করা হয়।',
    descriptionEn:
      'Examine whether actual ground possession matches deed rights and identify any encroachment or overlap by adjoining properties with accurate measurements.',
    category: 'possession',
    basePrice: 3000,
    minPrice: 2000,
    maxPrice: 6000,
    commissionPercentage: 10,
    aminEarning: 2700,
    platformEarning: 300,
    baseFee: 3000,
    platformFee: 300,
    estimatedDays: '২-৩ কর্মদিবস',
    active: true,
    iconName: 'Ruler',
    includedBn: [
      'প্রকৃত শারীরিক দখলের সীমানা পরিমাপ',
      'দলিলের অংশের সাথে দখলের তুলনা ও গরমিল শনাক্তকরণ',
      'প্রতিবেশীদের আইল ও অনুপ্রবেশের মাত্রা নিরূপণ',
      'দখল পরিস্থিতি সম্পর্কিত বিস্তারিত সার্ভে নোট',
    ],
    includedEn: [
      'Precise measurement of physical ground possession',
      'Comparison with deed share and gap identification',
      'Encroachment and boundary overlap assessment',
      'Comprehensive possession survey report',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের নাম, মোবাইল ও জরুরি যোগাযোগের ঠিকানা'],
    requiredCustomerInfoEn: ['Customer name, mobile number and contact details'],
    requiredLandInfoBn: ['দাগ নম্বর, খতিয়ান, দলিলের উল্লেখিত পরিমাণ (শতাংশ)'],
    requiredLandInfoEn: ['Dag number, Khatian, and deed area (decimal)'],
    disclaimerBn:
      'দখল পরিমাপ সরজমিনের বাস্তব অবস্থার কারিগরি চিত্র প্রদান করে। জমির স্বত্ব মালিকানা প্রমাণের একমাত্র ভিত্তি নয়।',
    disclaimerEn:
      'Possession measurement reflects physical ground reality. It does not solely establish legal title.',
  },
  {
    id: 'srvc-boundary',
    nameBn: 'দাগ/সীমানা নির্ধারণ',
    nameEn: 'Plot / Boundary Measurement',
    shortDescBn: 'মৌজা নকশার দাগের মূল আকার অনুযায়ী সীমানা খুঁটি ও কর্নার পয়েন্ট স্থাপন।',
    shortDescEn: 'Plot boundary corner demarcation aligned with original cadastral plot contours.',
    descriptionBn:
      'মৌজা নকশার দাগের মূল স্কেল (১৬ ইঞ্চি = ১ মাইল বা ৬৪ ইঞ্চি) অনুযায়ী সীমানার কর্নার পয়েন্টগুলো সরজমিনে শনাক্ত ও স্থায়ী সীমানা খুঁটি নির্ধারণে কারিগরি সহায়তা।',
    descriptionEn:
      'Locate original cadastral plot corners on the ground according to mouza map scale and assist in placing dispute-free boundary pillars.',
    category: 'boundary',
    basePrice: 2800,
    minPrice: 2000,
    maxPrice: 5500,
    commissionPercentage: 10,
    aminEarning: 2520,
    platformEarning: 280,
    baseFee: 2800,
    platformFee: 280,
    estimatedDays: '১-২ কর্মদিবস',
    active: true,
    iconName: 'ShieldCheck',
    includedBn: [
      'মৌজা নকশা থেকে দাগের জ্যামিতিক মাপ উত্তোলন',
      'ডায়াগনাল (কর্ণ) ও চেক লাইন দিয়ে মাপ যাচাই',
      'সীমানা খুঁটি স্থাপনের জন্য পয়েন্ট মার্কিং',
      'প্রতিবেশী পক্ষদের উপস্থিতিতে যৌথ পরিমাপ সমন্বয়',
    ],
    includedEn: [
      'Plot geometry extraction from official mouza sheets',
      'Verification using diagonal check lines',
      'Corner boundary pillar point marking',
      'Coordination for joint boundary inspection',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের যোগাযোগের তথ্য ও পরিমাপের সম্ভাব্য তারিখ'],
    requiredCustomerInfoEn: ['Contact info and preferred survey schedule'],
    requiredLandInfoBn: ['মৌজা, জে.এল. নম্বর, দাগ নম্বর ও পার্শ্ববর্তী দাগের তথ্য'],
    requiredLandInfoEn: ['Mouza, J.L. No, Dag No and adjacent plot details'],
    disclaimerBn:
      'প্রযোজ্য সরকারি রেকর্ড ও পেশাদার জরিপ পদ্ধতির ভিত্তিতে সেবা প্রদান করা হয়।',
    disclaimerEn:
      'Provided in strict accordance with government survey records and professional surveying practices.',
  },
  {
    id: 'srvc-drawing',
    nameBn: 'নকশা তৈরি',
    nameEn: 'Digital Land Drawing',
    shortDescBn: 'পরিমাপকৃত জমির প্রতিটি বাহুর দৈর্ঘ্য ও কোণ সম্বলিত প্রফেশনাল ডিজিটাল ক্যাড নকশা।',
    shortDescEn: 'Scaled professional digital 2D CAD land drawing with boundary lengths and bearings.',
    descriptionBn:
      'পরিমাপকৃত জমির প্রতিটি বাহুর সঠিক দৈর্ঘ্য, কর্ণ, কোণ, উত্তর দিক ও সীমানা প্রতিবেশীর বিবরণ সম্বলিত একটি প্রামাণ্য ডিজিটাল ড্রয়িং প্রস্তুত করা হয়। বণ্টননামা বা কোর্ট রেকর্ডে ব্যবহারের উপযোগী।',
    descriptionEn:
      'Receive a certified plot map showing all boundaries, diagonal check lines, area breakdown, and adjoining land ownership in high-resolution vector PDF.',
    category: 'drawing',
    basePrice: 2200,
    minPrice: 1500,
    maxPrice: 4500,
    commissionPercentage: 10,
    aminEarning: 1980,
    platformEarning: 220,
    baseFee: 2200,
    platformFee: 220,
    estimatedDays: '২-৩ কর্মদিবস',
    active: true,
    iconName: 'PenTool',
    includedBn: [
      'পরিমাপ অনুযায়ী স্কেলসহ ২ডি ক্যাড ড্রয়িং',
      'প্রতিটি বাহুর দৈর্ঘ্য (ফুট/মিটার/লিংক)',
      'উত্তর দিক নির্দেশক (North Arrow) ও স্কেল বার',
      'এ৪ সাইজের হাই-রেজোলিউশন কালার প্রিন্ট প্রস্তুত ফাইল',
    ],
    includedEn: [
      'Scaled 2D CAD vector drawing matching field measurements',
      'Length of each side (feet / meter / Gunter link)',
      'North arrow indicator and metric graphic scale bar',
      'A4 high-resolution print-ready layout',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের নাম ও ডিজিটাল ড্রয়িংয়ের শিরোনাম'],
    requiredCustomerInfoEn: ['Customer name & title of drawing'],
    requiredLandInfoBn: ['দাগ নম্বর, মৌজা ও পরিমাপের মূল ডাটা'],
    requiredLandInfoEn: ['Plot number, mouza and survey measurement coordinates'],
    disclaimerBn:
      'ডিজিটাল নকশা পরিমাপকৃত তথ্যের ভিত্তিতে কারিগরি উপস্থাপন। এটি সরকারি মৌজা নকশার বিকল্প নয়।',
    disclaimerEn:
      'Digital drawing is a technical depiction based on field survey measurements. It does not replace official cadastral sheets.',
  },
  {
    id: 'srvc-map-compare',
    nameBn: 'ডিজিটাল নকশা তুলনা',
    nameEn: 'Digital Map Comparison',
    shortDescBn: 'সিএস, এসএ, আরএস ও বিএস মৌজা নকশার ডিজিটাল ওভারলে এবং অবস্থান বিশ্লেষণ।',
    shortDescEn: 'Digital overlay analysis comparing historic CS, SA, RS and modern BS cadastral sheets.',
    descriptionBn:
      'বিভিন্ন ঐতিহাসিক জরিপ (CS/SA/RS/BS) এর মৌজা নকশা স্যাটেলাইট চিত্রের সাথে ডিজিটাল ওভারলে করে দাগের পরিবর্তন, নদীভাঙন বা রোড এলাইনমেন্ট নিরূপণ করা হয়।',
    descriptionEn:
      'Comparative digital overlay combining multiple survey epochs (CS, SA, RS, BS) with high-res georeferenced satellite imagery to identify plot shifts.',
    category: 'comparison',
    basePrice: 3500,
    minPrice: 2500,
    maxPrice: 7000,
    commissionPercentage: 10,
    aminEarning: 3150,
    platformEarning: 350,
    baseFee: 3500,
    platformFee: 350,
    estimatedDays: '২-৪ কর্মদিবস',
    active: true,
    iconName: 'Layers',
    includedBn: [
      'আরএস ও বিএস নকশার ডিজিটাল সুপার-ইম্পোজ',
      'স্যাটেলাইট ইমেজের সাথে জিপিএস স্থানাঙ্ক সমন্বয়',
      'দাগের আয়তন ও সীমানা বিচ্যুতির তুলনামূলক চার্ট',
      'সহায়ক ভিজ্যুয়াল তুলনামূলক প্রতিবেদন',
    ],
    includedEn: [
      'Super-imposition of RS and BS mouza sheets',
      'Alignment of satellite imagery with GPS boundary points',
      'Comparative chart of plot area and contour shifts',
      'Analytical visual comparison report',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের যোগাযোগ ও বিশ্লেষণের সুনির্দিষ্ট উদ্দেশ্য'],
    requiredCustomerInfoEn: ['Contact info and objective of map comparison'],
    requiredLandInfoBn: ['তুলনার জন্য উভয় খতিয়ান ও দাগ নম্বর (CS/SA/RS/BS)'],
    requiredLandInfoEn: ['Both historical and current plot/dag numbers'],
    disclaimerBn:
      'ডিজিটাল তুলনা/ওভারলে সহায়ক ভিজ্যুয়াল বিশ্লেষণ; এটি কোনো আদালতের আইনি সিদ্ধান্তের বিকল্প নয়।',
    disclaimerEn:
      'Digital comparison and overlay provide helpful visual analysis; not a substitute for legal court adjudication.',
  },
  {
    id: 'srvc-khatian-verify',
    nameBn: 'খতিয়ান/দাগ যাচাই সহায়তা',
    nameEn: 'Khatian / Plot Verification Assistance',
    shortDescBn: 'সিএস থেকে বিএস পর্যন্ত মালিকানা ধারাবাহিকতা ও হিস্যা হিসাবের কারিগরি যাচাই।',
    shortDescEn: 'Chain of ownership check from CS to BS and exact share (Hissah) mathematical verification.',
    descriptionBn:
      'জমি ক্রয়ের পূর্বে বা বিরোধ এড়াতে সিএস, এসএ, আরএস ও হাল বিএস খতিয়ানের ধারাবাহিক মালিকানা ও খতিয়ানের ১৬ আনা হিস্যা নিখুঁতভাবে বিশ্লেষণ ও গরমিল শনাক্তকরণ।',
    descriptionEn:
      'Examine chain of title across historical khatian series (CS, SA, RS, BS/City), verifying exact mathematical shares (16-ana hissah) and unearthing discrepancies.',
    category: 'khatian',
    basePrice: 1800,
    minPrice: 1200,
    maxPrice: 3500,
    commissionPercentage: 10,
    aminEarning: 1620,
    platformEarning: 180,
    baseFee: 1800,
    platformFee: 180,
    estimatedDays: '২-৩ কর্মদিবস',
    active: true,
    iconName: 'FileCheck',
    includedBn: [
      'খতিয়ানের আনা, গণ্ডা, কড়া, ক্রান্তি ও তিলের হিস্যা হিসাব',
      'রেকর্ডীয় মালিকের ওয়ারিশ বা হস্তান্তরের ধারাবাহিকতা চেক',
      'দাগের মোট জমি বনাম খতিয়ানের মোট হিস্যার ব্যালেন্স যাচাই',
      'যাচাই সারসংক্ষেপ ও পরামর্শ পত্র',
    ],
    includedEn: [
      'Mathematical verification of khatian shares (Ana/Gonda/Kora)',
      'Review of recorded ownership genealogy and transfers',
      'Cross-check of total plot area versus combined khatian shares',
      'Verification summary and advisory memo',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের নাম ও মোবাইল নম্বর'],
    requiredCustomerInfoEn: ['Customer name & mobile number'],
    requiredLandInfoBn: ['খতিয়ান ফটোকপি বা নম্বর, মৌজা ও জে.এল. নম্বর'],
    requiredLandInfoEn: ['Copies of khatians or numbers, Mouza and J.L. No'],
    disclaimerBn:
      'যাচাই সেবাটি সংশ্লিষ্ট নথিপত্রের গানিতিক ও কারিগরি পর্যালোচনার ভিত্তিতে প্রদান করা হয়। সরকারি রেজিস্ট্রেশন বা সাব-রেজিস্ট্রারের প্রত্যয়ন নয়।',
    disclaimerEn:
      'Verification assistance provides mathematical and technical document review. It is not an official government certification.',
  },
  {
    id: 'srvc-mutation-info',
    nameBn: 'দলিল/নামজারি তথ্য সহায়তা',
    nameEn: 'Deed / Mutation Information Assistance',
    shortDescBn: 'ই-নামজারি আবেদন প্রস্তুতি, ডিসিআর ফি ও হোল্ডিং ট্যাক্স নির্দেশিকা।',
    shortDescEn: 'e-Mutation application filing readiness, DCR fee, and land holding tax guidelines.',
    descriptionBn:
      'সাব-কবলা বা হেবা দলিল সম্পাদনের পর আপনার নামে সরকারি রেকর্ডে খারিজ বা ই-নামজারি আবেদন প্রস্তুতকরণ এবং ভূমি উন্নয়ন কর (খাজনা) পরিশোধের পূর্ণাঙ্গ কারিগরি নির্দেশিকা।',
    descriptionEn:
      'End-to-end guidance for e-Mutation (Namjari) online submission, tracking DCR receipt processing, and calculating official land development tax obligations.',
    category: 'mutation',
    basePrice: 1500,
    minPrice: 1000,
    maxPrice: 3000,
    commissionPercentage: 10,
    aminEarning: 1350,
    platformEarning: 150,
    baseFee: 1500,
    platformFee: 150,
    estimatedDays: '১-২ কর্মদিবস',
    active: true,
    iconName: 'FileText',
    includedBn: [
      'প্রয়োজনীয় দলিলের তালিকা ও চেকলিস্ট প্রদান',
      'অনলাইন ই-নামজারি ফরম পূরণের প্রস্তুতি নির্দেশনা',
      'হোল্ডিং ট্যাক্স ও দাখিলার বকেয়া হিসাব নির্দেশনা',
      'ভূমি অফিসের সাধারণ প্রশ্নোত্তর সহায়তা',
    ],
    includedEn: [
      'Document checklist review and readiness check',
      'Online e-Mutation application guidance',
      'Land development tax calculation guidance',
      'Land revenue portal inquiry support',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের নাম, জাতীয় পরিচয়পত্র নম্বর ও মোবাইল নম্বর'],
    requiredCustomerInfoEn: ['Customer name, NID number and mobile'],
    requiredLandInfoBn: ['রেজিস্ট্রিকৃত দলিল নম্বর, সাল ও সাব-রেজিস্ট্রি অফিস'],
    requiredLandInfoEn: ['Registered deed number, year and sub-registry office'],
    disclaimerBn:
      'সেবাটি তথ্য ও আবেদন প্রস্তুতিমূলক সহায়তা। সরকারি দপ্তর কর্তৃক নামজারি অনুমোদন বা সরাসরি সরকারি প্রতিনিধি হিসেবে কাজ করা হয় না।',
    disclaimerEn:
      'Service provides informational and preparation assistance. Does not represent official government land offices.',
  },
  {
    id: 'srvc-other',
    nameBn: 'অন্যান্য আমিন সেবা',
    nameEn: 'Other Amin Services',
    shortDescBn: 'পারিবারিক বাটোয়ারা পরামর্শ, সীমানা প্রাচীর পরিকল্পনা ও বিশেষ সার্ভে।',
    shortDescEn: 'Family partition consultation, boundary wall alignment, and customized land survey.',
    descriptionBn:
      'উত্তরাধিকার সূত্রে পাওয়া জমির ভাই-বোনদের মধ্যে আপস বণ্টন বাটোয়ারা, সীমানা প্রাচীর নির্মাণের পূর্বে নির্ভুল লাইন টানা ও অন্যান্য কাস্টম পেশাদার সার্ভে সেবা।',
    descriptionEn:
      'Specialized land services including amicable family property partition planning, boundary wall alignment tracing, and bespoke cadastral advisory.',
    category: 'other',
    basePrice: 2000,
    minPrice: 1500,
    maxPrice: 4000,
    commissionPercentage: 10,
    aminEarning: 1800,
    platformEarning: 200,
    baseFee: 2000,
    platformFee: 200,
    estimatedDays: '২-৩ কর্মদিবস',
    active: true,
    iconName: 'Wrench',
    includedBn: [
      'গ্রাহকের সুনির্দিষ্ট চাহিদামাফিক সরজমিনে পরিদর্শন',
      'পারিবারিক বণ্টননামার ড্রাফট পরিকল্পনা আলোচনা',
      'অভিজ্ঞ আমিনের ব্যক্তিগত কারিগরি মতামত',
    ],
    includedEn: [
      'On-site inspection tailored to custom requirements',
      'Amicable family partition draft planning discussion',
      'Experienced senior surveyor technical opinion',
    ],
    requiredCustomerInfoBn: ['গ্রাহকের নাম, মোবাইল নম্বর ও কাজের সুনির্দিষ্ট বিবরণ'],
    requiredCustomerInfoEn: ['Customer name, mobile number and detailed requirements'],
    requiredLandInfoBn: ['জেলা, উপজেলা, মৌজা ও দাগ নম্বর'],
    requiredLandInfoEn: ['District, Upazila, Mouza and Plot numbers'],
    disclaimerBn:
      'প্রযোজ্য সরকারি রেকর্ড ও পেশাদার জরিপ পদ্ধতির ভিত্তিতে সেবা প্রদান করা হয়।',
    disclaimerEn:
      'Services are conducted under professional surveying guidelines and relevant public land records.',
  },
];

// Sample / Demo Amin Profiles (Clearly identified as demo)
export const DEMO_AMINS: AminProfile[] = [
  {
    id: 'amin-demo-1',
    name: 'মোঃ আব্দুর রহমান (Demo Amin)',
    mobile: '01712-345678',
    email: 'arahman.demo@bhumioamin.com',
    isDemo: true,
    verificationStatus: 'verified',
    verifiedAt: '২০২৫-০৮-১০',
    serviceDistricts: ['ঢাকা', 'গাজীপুর', 'মানিকগঞ্জ'],
    serviceUpazilas: ['সাভার', 'কালিয়াকৈর', 'ধামরাই', 'কেরানীগঞ্জ'],
    servicesOffered: ['srvc-land-meas', 'srvc-possession', 'srvc-boundary', 'srvc-drawing'],
    experienceYears: 14,
    rating: 4.9,
    completedJobsCount: 89,
    languages: ['বাংলা', 'English'],
    availability: 'available',
    bioBn: 'বাংলাদেশ জরিপ অধিদপ্তর স্বীকৃত ডিপ্লোমা সার্ভেয়ার। ১৪ বছরের অধিক সময় ধরে সাভার ও ঢাকা অঞ্চলে জমি পরিমাপ ও সীমানা নির্ধারণে বিশ্বস্ততার সাথে কাজ করছেন।',
    bioEn: 'Survey Directorate certified diploma surveyor with over 14 years of professional experience across Savar and greater Dhaka region.',
    credentialsBn: 'ডিপ্লোমা ইন ল্যান্ড সার্ভেয়িং (বাংলাদেশ সার্ভে ইনস্টিটিউট), সদস্য - বাংলাদেশ সার্ভেয়ার্স অ্যাসোসিয়েশন',
    credentialsEn: 'Diploma in Land Surveying (Bangladesh Survey Institute), Member - Bangladesh Surveyors Association',
    joinedDate: '২০২৫-০১-১৫',
  },
  {
    id: 'amin-demo-2',
    name: 'সনৎ কুমার বিশ্বাস (Demo Amin)',
    mobile: '01823-456789',
    email: 'sanat.demo@bhumioamin.com',
    isDemo: true,
    verificationStatus: 'verified',
    verifiedAt: '২০২৫-০৯-০৫',
    serviceDistricts: ['চট্টগ্রাম', 'ফেনী', 'কুমিল্লা'],
    serviceUpazilas: ['পটিয়া', 'ফেনী সদর', 'দাউদকান্দি', 'সীতাকুণ্ড'],
    servicesOffered: ['srvc-land-meas', 'srvc-possession', 'srvc-khatian-verify', 'srvc-mutation-info'],
    experienceYears: 11,
    rating: 4.8,
    completedJobsCount: 64,
    languages: ['বাংলা'],
    availability: 'available',
    bioBn: 'চট্টগ্রাম ও ফেনী অঞ্চলে খতিয়ান যাচাই, দখল পরিমাপ এবং নামজারি পরামর্শে অভিজ্ঞ সিনিয়র আমিন। শতভাগ নিরপেক্ষ পরিমাপে বিশ্বাসী।',
    bioEn: 'Senior land surveyor specialized in title genealogy verification, possession demarcation, and mutation advisory in Chattogram.',
    credentialsBn: 'সার্টিফিকেট ইন সার্ভে টেকনোলজি, প্রাক্তন সহকারী আমিন (ভূমি রেকর্ড ও জরিপ)',
    credentialsEn: 'Certificate in Survey Technology, former assistant surveyor at Land Records Dept.',
    joinedDate: '২০২৫-০৩-২০',
  },
  {
    id: 'amin-demo-3',
    name: 'হাফেজ মোঃ সিরাজুল ইসলাম (Demo Amin)',
    mobile: '01934-567890',
    email: 'sirajul.demo@bhumioamin.com',
    isDemo: true,
    verificationStatus: 'verified',
    verifiedAt: '২০২৫-০৭-২২',
    serviceDistricts: ['সিলেট', 'মৌলভীবাজার', 'হবিগঞ্জ'],
    serviceUpazilas: ['গোলাপগঞ্জ', 'শ্রীমঙ্গল', 'মাধবপুর'],
    servicesOffered: ['srvc-land-meas', 'srvc-boundary', 'srvc-drawing', 'srvc-map-compare'],
    experienceYears: 18,
    rating: 4.95,
    completedJobsCount: 120,
    languages: ['বাংলা', 'সিলেটি'],
    availability: 'busy',
    bioBn: 'সিলেট বিভাগের অভিজ্ঞ আমিন। চা বাগান সীমানা, ডিজিটাল ক্যাড ম্যাপ ও আরএস-বিএস নকশা সমন্বয়ে বিশেষজ্ঞ।',
    bioEn: 'Senior veteran surveyor in Sylhet division with deep expertise in digital CAD drawings and cadastral RS-BS sheet comparisons.',
    credentialsBn: 'সরকারি লাইসেন্সপ্রাপ্ত সিনিয়র আমিন (লাইসেন্স নং- এসওয়াইএল-০৮৭২)',
    credentialsEn: 'Government Licensed Senior Surveyor (License No. SYL-0872)',
    joinedDate: '২০২৪-১১-০১',
  },
];

// Sample Bookings for UI testing (Clearly marked isDemo: true)
export const DEMO_BOOKINGS: CustomerBooking[] = [
  {
    id: 'BHOA-BOOK-20260914-0001',
    serviceId: 'srvc-land-meas',
    serviceNameBn: 'জমি মাপজোক',
    serviceNameEn: 'Land Measurement',
    customer: {
      name: 'মোঃ তারেক হাসান (Sample Customer)',
      mobile: '01711-223344',
      email: 'tarek.sample@gmail.com',
    },
    land: {
      district: 'ঢাকা',
      upazila: 'সাভার',
      union: 'আমিনবাজার',
      mouza: 'কমলাপুর',
      jlNo: '৭৪',
      dagNo: '৩১২',
      khatianNo: '১৫৪ (RS)',
    },
    surveyRequirements: {
      approxLandSize: 15,
      unit: 'শতাংশ',
      preferredDate: '২০২৬-০৯-১৮',
      preferredTime: 'সকাল ১০:০০ টা',
      locationDescription: 'আমিনবাজার ব্রিজের পূর্ব পাশে পাকা রাস্তা সংলগ্ন পুকুরপাড়।',
      additionalNotes: 'উত্তরের সীমানা নিয়ে প্রতিবেশীর সাথে কিছুটা সন্দেহ রয়েছে, পরিষ্কার দাগ নির্ধারণ দরকার।',
    },
    location: {
      manualAddress: 'কমলাপুর, সাভার, ঢাকা',
      latitude: 23.7842,
      longitude: 90.3125,
      accuracy: 3.5,
      hasGps: true,
    },
    pricing: {
      serviceFee: 2500,
      additionalFee: 0,
      platformFee: 250,
      totalFee: 2750,
      currency: 'BDT',
    },
    status: 'completed',
    statusHistory: [
      {
        status: 'pending',
        changedAt: '২০২৬-০৯-১০ ১০:৩০ AM',
        changedBy: 'গ্রাহক তারেক হাসান',
        role: 'customer',
        note: 'অনলাইনে সেবার অনুরোধ জমা দেওয়া হয়েছে',
      },
      {
        status: 'under_review',
        changedAt: '২০২৬-০৯-১০ ১১:০০ AM',
        changedBy: 'সুপারভাইজার অ্যাডমিন',
        role: 'admin',
        note: 'কাগজপত্র ও প্রাথমিক দাগের অবস্থান পর্যালোচনা করা হয়েছে',
      },
      {
        status: 'assigned',
        changedAt: '২০২৬-০৯-১০ ১২:১৫ PM',
        changedBy: 'সুপারভাইজার অ্যাডমিন',
        role: 'admin',
        note: 'আমিন মোঃ আব্দুর রহমানকে দায়িত্ব অর্পণ করা হয়েছে',
      },
      {
        status: 'amin_accepted',
        changedAt: '২০২৬-০৯-১০ ০১:০০ PM',
        changedBy: 'মোঃ আব্দুর রহমান (আমিন)',
        role: 'amin',
        note: 'অ্যাসাইনমেন্ট গ্রহণ করা হয়েছে এবং গ্রাহকের সাথে ফোনে প্রাথমিক কথা হয়েছে',
      },
      {
        status: 'scheduled',
        changedAt: '২০২৬-০৯-১১ ০৯:৩০ AM',
        changedBy: 'মোঃ আব্দুর রহমান (আমিন)',
        role: 'amin',
        note: 'সরজমিনে পরিমাপের তারিখ চূড়ান্ত করা হয়েছে',
      },
      {
        status: 'field_work',
        changedAt: '২০২৬-০৯-১২ ১০:০০ AM',
        changedBy: 'মোঃ আব্দুর রহমান (আমিন)',
        role: 'amin',
        note: 'সরজমিনে উপস্থিত হয়ে গান্টার শিকল ও ফিতায় পরিমাপ সম্পন্ন',
      },
      {
        status: 'processing',
        changedAt: '২০২৬-০৯-১২ ০৪:০০ PM',
        changedBy: 'মোঃ আব্দুর রহমান (আমিন)',
        role: 'amin',
        note: 'ডিজিটাল ডাটা ও সার্ভে রিপোর্ট প্রস্তুত করা হচ্ছে',
      },
      {
        status: 'quality_check',
        changedAt: '২০২৬-০৯-১৩ ১০:০০ AM',
        changedBy: 'মোঃ আব্দুর রহমান (আমিন)',
        role: 'amin',
        note: 'সার্ভে রিপোর্ট প্রশাসনিক কোয়ালিটি চেকের জন্য জমা দেওয়া হয়েছে',
      },
      {
        status: 'completed',
        changedAt: '২০২৬-০৯-১৩ ০৩:৩০ PM',
        changedBy: 'সুপারভাইজার অ্যাডমিন',
        role: 'admin',
        note: 'কোয়ালিটি চেক সফলভাবে অনুমোদিত। এ৪ সার্ভে সার্টিফিকেট সংযুক্ত।',
      },
    ],
    assignedAminId: 'amin-demo-1',
    assignedAminName: 'মোঃ আব্দুর রহমান (Demo Amin)',
    assignedAminPhone: '01712-345678',
    assignedAt: '২০২৬-০৯-১০ ১২:১৫ PM',
    scheduledDate: '২০২৬-০৯-১২',
    aminNotes: 'সরজমিনে উভয় পক্ষের উপস্থিতিতে সীমানা খুঁটি স্থাপন সম্পন্ন। ১৫ শতাংশ জমি সঠিক রয়েছে।',
    adminNotes: 'কোয়ালিটি কন্ট্রোল সম্পন্ন। পরিমাপ স্ট্যান্ডার্ড বজায় রাখা হয়েছে।',
    linkedSurveyId: 'srv-001',
    linkedReportId: 'rep-sample-01',
    qualityCheckNotes: 'ফিল্ড ডাটা ও নকশার জ্যামিতিক হিসাব মানসম্মত ও নির্ভুল।',
    qualityCheckApproved: true,
    qualityCheckedBy: 'প্রধান টেকনিক্যাল অফিসার',
    isDemo: true,
    createdAt: '2026-09-10T10:30:00.000Z',
    updatedAt: '2026-09-13T15:30:00.000Z',
  },
  {
    id: 'BHOA-BOOK-20260914-0002',
    serviceId: 'srvc-boundary',
    serviceNameBn: 'দাগ/সীমানা নির্ধারণ',
    serviceNameEn: 'Plot / Boundary Measurement',
    customer: {
      name: 'সুলতানা পারভীন (Sample Customer)',
      mobile: '01899-445566',
    },
    land: {
      district: 'গাজীপুর',
      upazila: 'কালিয়াকৈর',
      union: 'সূত্রাপুর',
      mouza: 'চন্দ্রা',
      jlNo: '১২',
      dagNo: '৮৯',
      khatianNo: '৪৩ (BS)',
    },
    surveyRequirements: {
      approxLandSize: 33,
      unit: 'শতাংশ',
      preferredDate: '২০২৬-০৯-২০',
      preferredTime: 'সকাল ১১:০০ টা',
      locationDescription: 'ঢাকা-টাঙ্গাইল মহাসড়কের নিকটবর্তী শিল্পাঞ্চলের পাশে।',
    },
    location: {
      manualAddress: 'চন্দ্রা, কালিয়াকৈর, গাজীপুর',
      hasGps: false,
    },
    pricing: {
      serviceFee: 2800,
      additionalFee: 0,
      platformFee: 280,
      totalFee: 3080,
      currency: 'BDT',
    },
    status: 'field_work',
    statusHistory: [
      {
        status: 'pending',
        changedAt: '২০২৬-০৯-১২ ০৯:০০ AM',
        changedBy: 'গ্রাহক সুলতানা পারভীন',
        role: 'customer',
        note: 'অনুরোধ জমা দেওয়া হয়েছে',
      },
      {
        status: 'under_review',
        changedAt: '২০২৬-০৯-১২ ১১:৩০ AM',
        changedBy: 'সুপারভাইজার অ্যাডমিন',
        role: 'admin',
        note: 'পর্যালোচনা সম্পন্ন',
      },
      {
        status: 'assigned',
        changedAt: '২০২৬-০৯-১২ ০২:০০ PM',
        changedBy: 'সুপারভাইজার অ্যাডমিন',
        role: 'admin',
        note: 'আমিন মোঃ আব্দুর রহমানকে বরাদ্দ',
      },
      {
        status: 'amin_accepted',
        changedAt: '২০২৬-০৯-১২ ০৪:০০ PM',
        changedBy: 'মোঃ আব্দুর রহমান (আমিন)',
        role: 'amin',
        note: 'অ্যাসাইনমেন্ট গৃহীত',
      },
      {
        status: 'field_work',
        changedAt: '২০২৬-০৯-১৪ ০৯:৩০ AM',
        changedBy: 'মোঃ আব্দুর রহমান (আমিন)',
        role: 'amin',
        note: 'আজ সরজমিনে সীমানা খুঁটি নির্ধারণ কাজ চলছে',
      },
    ],
    assignedAminId: 'amin-demo-1',
    assignedAminName: 'মোঃ আব্দুর রহমান (Demo Amin)',
    assignedAminPhone: '01712-345678',
    assignedAt: '২০২৬-০৯-১২ ০২:০০ PM',
    scheduledDate: '২০২৬-০৯-১৪',
    aminNotes: 'চন্দ্রা মৌজার ৮৯ নং দাগের সীমানা আইলে পরিমাপ চলছে।',
    isDemo: true,
    createdAt: '2026-09-12T09:00:00.000Z',
    updatedAt: '2026-09-14T09:30:00.000Z',
  },
  {
    id: 'BHOA-BOOK-20260914-0003',
    serviceId: 'srvc-drawing',
    serviceNameBn: 'নকশা তৈরি',
    serviceNameEn: 'Digital Land Drawing',
    customer: {
      name: 'আশরাফুল ইসলাম (Sample Customer)',
      mobile: '01912-887766',
    },
    land: {
      district: 'কুমিল্লা',
      upazila: 'দাউদকান্দি',
      union: 'গৌরীপুর',
      mouza: 'দাউদকান্দি',
      dagNo: '৪৫০',
    },
    surveyRequirements: {
      approxLandSize: 8,
      unit: 'কাঠা',
      preferredDate: '২০২৬-০৯-২৫',
      locationDescription: 'গৌরীপুর বাজার সংলগ্ন আবাসিক প্লট।',
    },
    location: {
      manualAddress: 'গৌরীপুর, দাউদকান্দি, কুমিল্লা',
      hasGps: false,
    },
    pricing: {
      serviceFee: 2200,
      additionalFee: 0,
      platformFee: 220,
      totalFee: 2420,
      currency: 'BDT',
    },
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        changedAt: '২০২৬-০৯-১৪ ১১:০০ AM',
        changedBy: 'গ্রাহক আশরাফুল ইসলাম',
        role: 'customer',
        note: 'ডিজিটাল নকশা সেবার জন্য আবেদন জমা',
      },
    ],
    isDemo: true,
    createdAt: '2026-09-14T11:00:00.000Z',
    updatedAt: '2026-09-14T11:00:00.000Z',
  },
];

// Helper Functions for Safe LocalStorage Access

export function getStoredServices(): MarketplaceService[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVICES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeServicePricing);
      }
    }
  } catch (e) {
    console.error('Failed to parse services from localStorage', e);
  }
  // Initialize default services in storage
  saveServices(DEFAULT_SERVICES);
  return DEFAULT_SERVICES;
}

export function saveServices(services: MarketplaceService[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  } catch (e) {
    console.error('Failed to save services to localStorage', e);
  }
}

export function getStoredAmins(): AminProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AMINS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse amins from localStorage', e);
  }
  // Default to DEMO_AMINS
  saveAmins(DEMO_AMINS);
  return DEMO_AMINS;
}

export function saveAmins(amins: AminProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AMINS, JSON.stringify(amins));
  } catch (e) {
    console.error('Failed to save amins to localStorage', e);
  }
}

export function getStoredBookings(): CustomerBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((b: CustomerBooking): CustomerBooking => {
          const paymentStatus: PaymentStatus =
            b.paymentStatus || (b.status === 'completed' ? 'paid' : 'unpaid');
          const servicePrice = b.pricing?.basePrice ?? b.pricing?.serviceFee ?? 2000;
          const commPercent = b.pricing?.commissionPercentage ?? 10;
          const commAmt =
            b.pricing?.platformCommission ??
            b.pricing?.platformFee ??
            Math.round(servicePrice * (commPercent / 100));
          const aminEarn =
            b.pricing?.aminEarning ?? Math.max(0, servicePrice - commAmt);
          const platformEarn = b.pricing?.platformEarning ?? commAmt;
          const payable =
            b.pricing?.customerPayable ??
            servicePrice + (b.pricing?.additionalFee || 0);

          const pricingSnapshot =
            b.pricingSnapshot || {
              serviceId: b.serviceId,
              serviceNameBn: b.serviceNameBn,
              serviceNameEn: b.serviceNameEn,
              basePrice: servicePrice,
              commissionPercentage: commPercent,
              platformCommission: commAmt,
              aminEarning: aminEarn,
              platformEarning: platformEarn,
              customerPayable: payable,
              totalAmount: payable,
              currency: b.pricing?.currency || 'BDT',
              snapshotAt: b.createdAt || new Date().toISOString(),
            };

          return {
            ...b,
            paymentStatus,
            pricingSnapshot,
            pricing: {
              ...b.pricing,
              basePrice: servicePrice,
              commissionPercentage: commPercent,
              platformCommission: commAmt,
              aminEarning: aminEarn,
              platformEarning: platformEarn,
              customerPayable: payable,
            },
          };
        });
      }
    }
  } catch (e) {
    console.error('Failed to parse bookings from localStorage', e);
  }
  // If first time, initialize with demo bookings so user can explore workflow immediately
  saveBookings(DEMO_BOOKINGS);
  return DEMO_BOOKINGS;
}

export function saveBookings(bookings: CustomerBooking[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  } catch (e) {
    console.error('Failed to save bookings to localStorage', e);
  }
}

export function getStoredApplications(): AminApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse applications from localStorage', e);
  }
  return [];
}

export function saveApplications(apps: AminApplication[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
  } catch (e) {
    console.error('Failed to save applications to localStorage', e);
  }
}

export function getStoredRatings(): CustomerRating[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RATINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse ratings from localStorage', e);
  }
  return [
    {
      id: 'rat-001',
      bookingId: 'BHOA-BOOK-20260914-0001',
      aminId: 'amin-demo-1',
      customerName: 'মোঃ তারেক হাসান',
      rating: 5,
      review: 'খুবই দ্রুত ও পেশাদারভাবে জমি মেপে দিয়েছেন। ডিজিটাল রিপোর্টটি দুর্দান্ত হয়েছে।',
      createdAt: '২০২৬-০৯-১৩ ০৪:০০ PM',
    },
  ];
}

export function saveRatings(ratings: CustomerRating[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RATINGS, JSON.stringify(ratings));
  } catch (e) {
    console.error('Failed to save ratings to localStorage', e);
  }
}

export function getStoredComplaints(): CustomerComplaint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPLAINTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse complaints from localStorage', e);
  }
  return [];
}

export function saveComplaints(complaints: CustomerComplaint[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(complaints));
  } catch (e) {
    console.error('Failed to save complaints to localStorage', e);
  }
}

export const saveStoredServices = saveServices;
export const saveStoredBookings = saveBookings;
export const saveStoredAmins = saveAmins;
export const saveStoredApplications = saveApplications;
export const saveStoredRatings = saveRatings;
export const saveStoredComplaints = saveComplaints;

export function getActiveRole(): MarketplaceRole {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE);
    if (raw === 'customer' || raw === 'amin' || raw === 'admin') {
      return raw;
    }
  } catch (e) {
    console.error('Failed to get active role', e);
  }
  return 'customer'; // Default role
}

export function setActiveRole(role: MarketplaceRole): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, role);
  } catch (e) {
    console.error('Failed to save active role', e);
  }
}

// Generate deterministic unique booking ID: BHOA-BOOK-YYYYMMDD-XXXX
export function generateBookingId(existingBookings: CustomerBooking[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `BHOA-BOOK-${year}${month}${day}-`;

  // Count existing bookings with today's prefix
  const todayCount = existingBookings.filter((b) => b.id.startsWith(datePrefix)).length;
  const nextNum = String(todayCount + 1).padStart(4, '0');
  let candidate = `${datePrefix}${nextNum}`;

  // Ensure absolutely no duplicate
  let counter = todayCount + 1;
  while (existingBookings.some((b) => b.id === candidate)) {
    counter++;
    candidate = `${datePrefix}${String(counter).padStart(4, '0')}`;
  }

  return candidate;
}

// Status Display Metadata
export const STATUS_CONFIG: Record<
  BookingStatus,
  {
    labelBn: string;
    labelEn: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    stepOrder: number;
  }
> = {
  pending: {
    labelBn: 'অপেক্ষমাণ (Pending)',
    labelEn: 'Pending Review',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    stepOrder: 1,
  },
  under_review: {
    labelBn: 'পর্যালোচনাধীন (Under Review)',
    labelEn: 'Under Review',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200',
    stepOrder: 2,
  },
  assigned: {
    labelBn: 'আমিন বরাদ্দকৃত (Assigned)',
    labelEn: 'Amin Assigned',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200',
    stepOrder: 3,
  },
  amin_accepted: {
    labelBn: 'আমিন গৃহীত (Accepted)',
    labelEn: 'Amin Accepted',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-200',
    stepOrder: 4,
  },
  scheduled: {
    labelBn: 'তারিখ নির্ধারিত (Scheduled)',
    labelEn: 'Scheduled',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-200',
    stepOrder: 5,
  },
  field_work: {
    labelBn: 'মাঠপর্যায়ে কাজ (Field Work)',
    labelEn: 'Field Work',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    stepOrder: 6,
  },
  processing: {
    labelBn: 'ডাটা ও নকশা প্রস্তুত (Processing)',
    labelEn: 'Processing Data',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-800',
    badgeBorder: 'border-cyan-200',
    stepOrder: 7,
  },
  quality_check: {
    labelBn: 'মান যাচাই (Quality Check)',
    labelEn: 'Quality Check',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-200',
    stepOrder: 8,
  },
  completed: {
    labelBn: 'সম্পন্ন (Completed)',
    labelEn: 'Completed',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    stepOrder: 9,
  },
  cancelled: {
    labelBn: 'বাতিল (Cancelled)',
    labelEn: 'Cancelled',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
    stepOrder: -1,
  },
  rejected: {
    labelBn: 'প্রত্যাখ্যাত (Rejected)',
    labelEn: 'Rejected',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-200',
    stepOrder: -2,
  },
  disputed: {
    labelBn: 'আপত্তি/বিরোধ (Disputed)',
    labelEn: 'Disputed',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-900',
    badgeBorder: 'border-red-300',
    stepOrder: -3,
  },
};
