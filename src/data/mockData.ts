import { ServiceItem, SurveyRecord } from '../types';

export const initialSurveys: SurveyRecord[] = [
  {
    id: 'srv-001',
    title: 'বাড়ির ভিটা ও পুকুরপাড়',
    mouza: 'কমলাপুর',
    jlNo: '৭৪',
    dagNo: '৩১২',
    khatianNo: '১৫৪ (RS)',
    date: '২০২৬-০২-১৫',
    areaSqFt: 6534, // 15 decimal (approx 6534 sq ft = 9.075 katha)
    perimeterFt: 340,
    status: 'completed',
    points: [
      { id: 'p1', name: 'উঃ-পঃ সীমানা আইল (P1)', x: 40, y: 50, bearing: 0, distance: 95, accuracy: 2.1 },
      { id: 'p2', name: 'উঃ-পূঃ বাঁশঝাড় (P2)', x: 260, y: 40, bearing: 85, distance: 75, accuracy: 1.8 },
      { id: 'p3', name: 'দঃ-পূঃ পুকুর পাড় (P3)', x: 280, y: 190, bearing: 172, distance: 90, accuracy: 2.4 },
      { id: 'p4', name: 'দঃ-পঃ পাকা রাস্তা (P4)', x: 60, y: 210, bearing: 265, distance: 80, accuracy: 1.9 },
    ],
    notes: 'উত্তরের সীমানায় প্রতিবেশী রহমত উল্লাহর জমির আইল রয়েছে। পূর্ব সীমানায় রেকর্ডীয় পুকুর।',
  },
  {
    id: 'srv-002',
    title: 'দক্ষিণের ধানি জমি - দাগ ১৪৫',
    mouza: 'শ্যামপুর',
    jlNo: '১০২',
    dagNo: '১৪৫',
    khatianNo: '৭৮ (BS)',
    date: '২০২৬-০৩-০১',
    areaSqFt: 14400, // 1 Bigha (33.06 decimal)
    perimeterFt: 490,
    status: 'draft',
    points: [
      { id: 'p1', name: 'উত্তর সীমানা পিলার (P1)', x: 50, y: 60, bearing: 15, distance: 130, accuracy: 2.5 },
      { id: 'p2', name: 'পূর্ব আইল কর্নার (P2)', x: 270, y: 70, bearing: 95, distance: 115, accuracy: 2.0 },
      { id: 'p3', name: 'দক্ষিণ সীমানা সেচ নালা (P3)', x: 250, y: 220, bearing: 185, distance: 125, accuracy: 2.8 },
      { id: 'p4', name: 'পশ্চিম সীমানা মেঠোপথ (P4)', x: 40, y: 200, bearing: 275, distance: 120, accuracy: 2.2 },
    ],
    notes: 'জমির আকৃতি মোটামুটি চতুর্ভুজাকার। বোরো ধান চাষের জমি।',
  },
];

export const aminServices: ServiceItem[] = [
  {
    id: 'srvc-1',
    titleBn: 'জমি মাপজোক ও সীমানা নির্ধারণ',
    titleEn: 'Land Surveying & Demarcation',
    subtitleBn: 'সঠিক শিকল ও ডিজিটাল ফিতা দিয়ে সরজমিনে সীমানা খুঁটি স্থাপন',
    subtitleEn: 'On-site boundary measurement and demarcation with precision',
    descBn:
      'অভিজ্ঞ সরকারি সনদপ্রাপ্ত আমিনের উপস্থিতিতে মৌজা নকশা ও দলিলের বর্ণনা অনুযায়ী সীমানা পরিমাপ করা হয়। বিরোধহীনভাবে সীমানা খুঁটি বা সীমানা আইল চিহ্নিত করতে এই সেবা অপরিহার্য।',
    descEn:
      'Certified surveyors inspect the land against the Mouza sheet and deed boundaries, establishing dispute-free boundary corner pillars.',
    iconName: 'Compass',
    estimatedDays: '১-২ কর্মদিবস',
    documents: ['সর্বশেষ খতিয়ান (RS/BS)', 'ক্রয়কৃত বা পৈতৃক মূল দলিল', 'জমির হোল্ডিং ট্যাক্স দাখিলা'],
  },
  {
    id: 'srvc-2',
    titleBn: 'দখল পরিমাপ ও বিরোধ নিরূপণ',
    titleEn: 'Possession & Encroachment Measurement',
    subtitleBn: 'দখল অনুযায়ী প্রকৃত জমির পরিমাণ ও অন্যের দখল যাচাই',
    subtitleEn: 'Measure actual physical possession against official deed share',
    descBn:
      'আপনার দলিলে উল্লেখিত পরিমাণের তুলনায় সরজমিনে আপনার দখলে কতটুকু জমি আছে তা সূক্ষ্মভাবে নিরূপণ করা হয়। কোনো প্রতিবেশী বা পক্ষ আপনার জমি দখল করেছে কিনা তা তাৎক্ষণিক জানা যায়।',
    descEn:
      'Examine whether actual ground possession matches deed rights and identify any encroachment or overlap by adjoining properties.',
    iconName: 'Ruler',
    estimatedDays: '২-৩ কর্মদিবস',
    documents: ['খতিয়ানের সত্যায়িত কপি', 'মৌজা নকশার দাগ নম্বর', 'পূর্ববর্তী সার্ভে রিপোর্ট (যদি থাকে)'],
  },
  {
    id: 'srvc-3',
    titleBn: 'নকশা তৈরি ও ট্রেস ম্যাপ অঙ্কন',
    titleEn: 'Boundary Blueprint & Trace Map',
    subtitleBn: 'হাতে আঁকা বা ক্যাড ভিত্তিক স্কেলসহ পেশাদার জরিপ নকশা',
    subtitleEn: 'Hand-drawn or CAD-based scaled plot maps for official records',
    descBn:
      'পরিমাপকৃত জমির প্রতিটি বাহুর সঠিক দৈর্ঘ্য, কর্ণ, কোণ ও সীমানা প্রতিবেশী উল্লেখসহ একটি প্রামাণ্য নকশা তৈরি করে দেওয়া হয়। এই নকশা পরিবারে বণ্টননামা বা কোর্টের প্রয়োজনে ব্যবহার করা যায়।',
    descEn:
      'Receive a certified plot map showing all boundaries, diagonal check lines, area breakdown, and adjoining land ownership.',
    iconName: 'PenTool',
    estimatedDays: '৩-৫ কর্মদিবস',
    documents: ['মৌজা ম্যাপের শিট নম্বর', 'দাগের খসড়া বিবরণ', 'উভয় পক্ষের উপস্থিতির সম্মতি'],
  },
  {
    id: 'srvc-4',
    titleBn: 'ডিজিটাল ম্যাপ ও জিআইএস সমন্বয়',
    titleEn: 'Digital Map & GIS Mapping',
    subtitleBn: 'স্যাটেলাইট ইমেজ ও আধুনিক জিপিএস স্থানাঙ্ক সম্বলিত ম্যাপ',
    subtitleEn: 'Satellite imagery overlay with exact GPS boundary coordinates',
    descBn:
      'গুগল স্যাটেলাইট এবং মৌজা শিটের সমন্বয়ে আপনার জমির ডিজিটাল মানচিত্র তৈরি করা হয়। ভবিষ্যতে যেকোনো সময় জিপিএস স্থানাঙ্কের সাহায্যে সীমানা পুনরায় পুনরুদ্ধার করা সম্ভব।',
    descEn:
      'Create high-resolution digital georeferenced maps linking official Mouza plots to satellite coordinates for tamper-proof records.',
    iconName: 'MapPin',
    estimatedDays: '২-৪ কর্মদিবস',
    documents: ['দাগ নম্বর ও মৌজা নাম', 'জিপিএস পয়েন্ট ডাটা', 'জাতীয় পরিচয়পত্র কপি'],
  },
  {
    id: 'srvc-5',
    titleBn: 'দলিল ও খতিয়ান সহায়তা',
    titleEn: 'Deed & Khatian (CS, SA, RS, BS) Verification',
    subtitleBn: 'সিএস, এসএ, আরএস ও বিএস খতিয়ানের ধারাবাহিক স্বত্ব যাচাই',
    subtitleEn: 'Verify chain of ownership through CS, SA, RS and City/BS records',
    descBn:
      'জমি কেনার আগে বা মামলা-মোকদ্দমার হাত থেকে বাঁচতে সিএস খতিয়ান থেকে শুরু করে সর্বশেষ বিএস খতিয়ান পর্যন্ত মূল মালিকানা শৃঙ্খলা যাচাই এবং কোনো জালিয়াতি বা গরমিল আছে কিনা তা বিশ্লেষণ।',
    descEn:
      'Complete title verification tracking the genealogy of property ownership from historic CS to modern BS/City surveys to avert legal hazards.',
    iconName: 'FileCheck',
    estimatedDays: '৩-৫ কর্মদিবস',
    documents: ['বায়া দলিল ও মূল দলিল ফটোকপি', 'সিএস/এসএ/আরএস খতিয়ান নম্বর', 'মালিকানা ওয়ারিশ সনদ'],
  },
  {
    id: 'srvc-6',
    titleBn: 'নামজারি ও খাজনা সহায়তা',
    titleEn: 'Mutation (Namjari) & Land Tax E-Service',
    subtitleBn: 'ই-নামজারি আবেদন প্রস্তুতি ও বকেয়া ভূমি উন্নয়ন কর হিসাব',
    subtitleEn: 'Guidance for online mutation and digital land development tax',
    descBn:
      'নতুন জমি ক্রয়ের পর আপনার নামে খারিজ বা নামজারি আবেদন প্রস্তুতকরণ, খতিয়ান সংশোধন এবং সরকারি নির্ধারিত হারে বকেয়া ভূমি উন্নয়ন কর (খাজনা) পরিশোধের সঠিক নির্দেশনা।',
    descEn:
      'End-to-end guidance for e-Mutation (Namjari) application, DCR receipt processing, and calculating official land tax.',
    iconName: 'ShieldCheck',
    estimatedDays: '২-৩ কর্মদিবস',
    documents: ['রেজিস্ট্রিকৃত সাব-কবলা দলিল', 'ওয়ারিশান সনদপত্র', 'হালনাগাদ দাখিলা রসিদ'],
  },
];
