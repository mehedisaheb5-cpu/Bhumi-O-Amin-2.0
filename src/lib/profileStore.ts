/**
 * ফিল্ড আমিন — আমিনের প্রোফাইল (সাইড প্যানেল, রিপোর্ট হেডার ইত্যাদিতে ব্যবহার হয়)।
 *
 * এখন: একজন ব্যবহারকারী, লগইন নেই — তথ্য ফোনের localStorage-এ থাকে,
 * ডিফল্ট মান মেহেদী হাসানের। এডমিন → সেটিংস থেকে বদলানো যাবে (ধাপ ৮)।
 *
 * ভবিষ্যৎ (একাধিক আমিন + সাবস্ক্রিপশন): সব স্ক্রিন শুধু `useProfile()` /
 * `getProfile()` / `saveProfile()` ব্যবহার করে। তাই পরে লগইন যোগ হলে শুধু এই
 * ফাইলের ভেতরের উৎস (localStorage → লগইন করা ব্যবহারকারীর প্রোফাইল) বদলালেই চলবে।
 */
import { useEffect, useState } from 'react';

export interface AminProfile {
  name: string;
  title: string; // পদবি
  area: string; // কাজের এলাকা
  phone: string;
  address: string;
  facebookName: string;
  facebookUrl: string;
  /** ছোট করা ছবি (data URL)। খালি থাকলে আইকন দেখাবে। */
  photo?: string;
}

export const DEFAULT_PROFILE: AminProfile = {
  name: 'মেহেদী হাসান',
  title: 'আমিন',
  area: 'ফেনী',
  phone: '01824989691',
  address: 'লেমুয়া বাজার, ফেনী সদর, ফেনী',
  facebookName: 'Mehedi Saheb',
  facebookUrl: 'https://www.facebook.com/share/1CaTSzyAqy/',
  photo: '',
};

const KEY = 'fa_profile_v1';
const EVT = 'fa:profile-changed';

export function getProfile(): AminProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AminProfile>;
      return { ...DEFAULT_PROFILE, ...saved };
    }
  } catch {
    /* ভাঙা তথ্য হলে ডিফল্ট */
  }
  return { ...DEFAULT_PROFILE };
}

export function saveProfile(patch: Partial<AminProfile>): AminProfile {
  const next = { ...getProfile(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVT));
  return next;
}

/** প্রোফাইল বদলালে (এই ট্যাবে বা অন্য ট্যাবে) স্ক্রিন নিজে থেকে আপডেট হয়। */
export function useProfile(): AminProfile {
  const [profile, setProfile] = useState<AminProfile>(getProfile);
  useEffect(() => {
    const refresh = () => setProfile(getProfile());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) refresh();
    };
    window.addEventListener(EVT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return profile;
}

/** ফোন নম্বর থেকে tel: লিংক (শুধু সংখ্যা ও +) */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
