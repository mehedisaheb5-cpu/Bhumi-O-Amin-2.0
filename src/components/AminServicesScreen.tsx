import React, { useState, useEffect } from 'react';
import {
  Language,
  MarketplaceService,
  CustomerBooking,
  AminProfile,
  AminApplication,
  CustomerRating,
  CustomerComplaint,
  MarketplaceRole,
  BookingStatus,
  SurveyRecord,
  PaymentMethod,
  PaymentStatus,
} from '../types';
import {
  getStoredServices,
  saveStoredServices,
  getStoredBookings,
  saveStoredBookings,
  getStoredAmins,
  saveStoredAmins,
  getStoredApplications,
  saveStoredApplications,
  getStoredRatings,
  saveStoredRatings,
  getStoredComplaints,
  saveStoredComplaints,
  saveAmins,
  getActiveRole,
  setActiveRole as persistActiveRole,
  STATUS_CONFIG,
} from '../lib/marketplaceStorage';
import { normalizeServicePricing } from '../lib/pricing-commission';
import { MarketplaceLanding } from './marketplace/MarketplaceLanding';
import { ServiceDetailModal } from './marketplace/ServiceDetailModal';
import { CustomerBookingModal } from './marketplace/CustomerBookingModal';
import { CustomerDashboard } from './marketplace/CustomerDashboard';
import { BookingDetailsModal } from './marketplace/BookingDetailsModal';
import { AminDirectory } from './marketplace/AminDirectory';
import { AminRegistrationModal } from './marketplace/AminRegistrationModal';
import { AminDashboard } from './marketplace/AminDashboard';
import { AdminDashboard } from './marketplace/AdminDashboard';
import { RatingModal } from './marketplace/RatingModal';
import { ComplaintModal } from './marketplace/ComplaintModal';
import { PaymentModal } from './marketplace/PaymentModal';
import {
  Store,
  FolderHeart,
  Users,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  isFirebaseConfigured,
  db,
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  cleanForFirestore,
} from '../lib/firebase';
import { logAuditEvent } from '../lib/auditLog';
import { sendAppNotification } from '../lib/notifications';

interface AminServicesScreenProps {
  lang: Language;
  onOpenReport?: (surveyId?: string, reportId?: string) => void;
  onOpenSurvey?: (surveyId?: string, bookingId?: string) => void;
  surveys?: SurveyRecord[];
}

export const AminServicesScreen: React.FC<AminServicesScreenProps> = ({
  lang,
  onOpenReport,
  onOpenSurvey,
  surveys = [],
}) => {
  const isBn = lang === 'bn';
  const { currentUser, role } = useAuth();

  // Master Marketplace States
  const [services, setServices] = useState<MarketplaceService[]>(() => getStoredServices());
  const [bookings, setBookings] = useState<CustomerBooking[]>(() => getStoredBookings());
  const [amins, setAmins] = useState<AminProfile[]>(() => getStoredAmins());
  const [applications, setApplications] = useState<AminApplication[]>(() => getStoredApplications());
  const [ratings, setRatings] = useState<CustomerRating[]>(() => getStoredRatings());
  const [complaints, setComplaints] = useState<CustomerComplaint[]>(() => getStoredComplaints());
  const [activeRole, setActiveRoleState] = useState<MarketplaceRole>(() => getActiveRole());

  // Auto-sync active marketplace role with authenticated user role if logged in
  useEffect(() => {
    if (currentUser?.role) {
      setActiveRoleState(currentUser.role);
      persistActiveRole(currentUser.role);
    }
  }, [currentUser?.role]);

  // Realtime Cloud Listener for Bookings (Multi-device synchronization)
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !currentUser?.id) return;

    let q;
    if (currentUser.role === 'admin') {
      // Admin sees all bookings in realtime
      q = query(collection(db, 'bookings'));
    } else if (currentUser.role === 'amin') {
      // Amin sees assigned bookings in realtime
      q = query(
        collection(db, 'bookings'),
        where('assignedAminId', '==', currentUser.id)
      );
    } else {
      // Customer sees their own bookings in realtime
      q = query(
        collection(db, 'bookings'),
        where('customerId', '==', currentUser.id)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudBookings: CustomerBooking[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as CustomerBooking;
            cloudBookings.push(data);
          });

          setBookings((prev) => {
            const cloudMap = new Map(cloudBookings.map((b) => [b.id, b]));
            const merged = prev.map((localB) => {
              if (cloudMap.has(localB.id)) {
                const cloudB = cloudMap.get(localB.id)!;
                cloudMap.delete(localB.id);
                return cloudB;
              }
              return localB;
            });
            cloudMap.forEach((newCloudB) => {
              merged.unshift(newCloudB);
            });
            saveStoredBookings(merged);
            return merged;
          });
        }
      },
      (err) => {
        console.warn('Firestore bookings onSnapshot notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role]);

  // Synchronize registered Amin profiles from Firestore for multi-device Admin assignment
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    if (currentUser?.role === 'admin') {
      const q = query(collection(db, 'aminProfiles'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudAmins: AminProfile[] = [];
            snapshot.forEach((docSnap) => {
              cloudAmins.push(docSnap.data() as AminProfile);
            });
            setAmins((prev) => {
              const map = new Map<string, AminProfile>(prev.map((a) => [a.id, a]));
              cloudAmins.forEach((ca) => map.set(ca.id, ca));
              const merged: AminProfile[] = Array.from(map.values());
              saveAmins(merged);
              return merged;
            });
          }
        },
        (err) => console.warn('Firestore amins listener notice:', err)
      );
      return () => unsubscribe();
    } else if (currentUser?.role === 'amin') {
      // Ensure current logged-in Amin is in amins state for seamless assignment
      setAmins((prev) => {
        if (prev.some((a) => a.id === currentUser.id)) return prev;
        const selfAmin: AminProfile = {
          id: currentUser.id,
          userId: currentUser.id,
          name: currentUser.name,
          mobile: currentUser.phone || '01700-000000',
          email: currentUser.email,
          serviceDistricts: [currentUser.district || 'ঢাকা'],
          serviceUpazilas: [currentUser.upazila || 'সাভার'],
          experienceYears: 5,
          rating: 5.0,
          completedJobsCount: 0,
          verificationStatus: 'verified',
          availability: 'available',
          bioBn: 'সার্টিফাইড পেশাদার আমিন সার্ভেয়ার।',
          bioEn: 'Certified professional land surveyor.',
          servicesOffered: ['srvc-land-meas', 'srvc-boundary'],
          isDemo: false,
        };
        const updated = [selfAmin, ...prev];
        saveAmins(updated);
        return updated;
      });
    }
  }, [currentUser?.id, currentUser?.role]);

  // Customer sub-view inside 'customer' role
  const [customerView, setCustomerView] = useState<'marketplace' | 'my_bookings' | 'directory'>(
    'marketplace'
  );

  // Modals state
  const [selectedServiceForDetail, setSelectedServiceForDetail] = useState<MarketplaceService | null>(
    null
  );
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<MarketplaceService | null>(
    null
  );
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<CustomerBooking | null>(
    null
  );
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [ratingBooking, setRatingBooking] = useState<CustomerBooking | null>(null);
  const [complaintBooking, setComplaintBooking] = useState<CustomerBooking | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<CustomerBooking | null>(null);

  const handleOpenPayment = (booking: CustomerBooking) => {
    setPaymentBooking(booking);
  };

  const handleSavePayment = (
    bookingId: string,
    paymentData: {
      paymentStatus: PaymentStatus;
      paymentMethod: PaymentMethod;
      paymentReference?: string;
      paymentPaidAt?: string;
      paymentNotes?: string;
      paymentVerifiedBy?: string;
      paymentVerifiedAt?: string;
    }
  ) => {
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;

        const auditTimeline = [
          ...(b.auditTimeline || []),
          {
            timestamp: new Date().toISOString(),
            status: b.status,
            actor:
              activeRole === 'admin'
                ? currentUser?.name || 'অ্যাডমিন সুপারভাইজার'
                : b.customer.name,
            note:
              paymentData.paymentStatus === 'paid'
                ? `পেমেন্ট সম্পন্ন ও অনুমোদিত (${paymentData.paymentMethod.toUpperCase()}${
                    paymentData.paymentReference ? ` - Ref: ${paymentData.paymentReference}` : ''
                  })`
                : paymentData.paymentStatus === 'payment_pending'
                ? `পেমেন্ট রেফারেন্স জমা দেওয়া হয়েছে (${paymentData.paymentReference || 'N/A'})`
                : `পেমেন্ট তথ্য হালনাগাদ: ${paymentData.paymentStatus}`,
          },
        ];

        const updatedBooking = {
          ...b,
          ...paymentData,
          auditTimeline,
          updatedAt: new Date().toISOString(),
        };
        return updatedBooking;
      });
      saveStoredBookings(updated);
      return updated;
    });

    setSelectedBookingForDetails((prev) => {
      if (prev && prev.id === bookingId) {
        return {
          ...prev,
          ...paymentData,
        };
      }
      return prev;
    });

    logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: (activeRole === 'customer' ? 'user' : activeRole) as any,
      action: 'UPDATE_PAYMENT',
      entityType: 'payment',
      entityId: bookingId,
      details: `Status: ${paymentData.paymentStatus}, Method: ${paymentData.paymentMethod}${
        paymentData.paymentReference ? `, Ref: ${paymentData.paymentReference}` : ''
      }`,
    });

    if (isFirebaseConfigured && db) {
      try {
        updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
          ...paymentData,
          updatedAt: new Date().toISOString(),
        })).catch((e) => console.warn('Firestore payment sync notice:', e));
      } catch (err) {
        console.warn('Firestore payment note:', err);
      }
    }
  };

  // Synchronize role change with security authorization checks
  const handleRoleChange = (role: MarketplaceRole) => {
    if (currentUser) {
      const isActualAdmin =
        currentUser.role === 'admin' ||
        currentUser.email?.toLowerCase() === 'mehedifeni33@gmail.com';
      if (!isActualAdmin && role === 'admin') {
        alert(
          isBn
            ? 'অননুমোদিত: অ্যাডমিন প্যানেল শুধুমাত্র অনুমোদিত সুপারভাইজারের জন্য সংরক্ষিত।'
            : 'Access Denied: Admin panel requires authorized administrative credentials.'
        );
        return;
      }
      if (currentUser.role === 'customer' && role === 'amin') {
        alert(
          isBn
            ? 'অননুমোদিত: আমিন ওয়ার্কস্পেস শুধুমাত্র নিবন্ধিত ও যাচাইকৃত আমিনের জন্য সংরক্ষিত।'
            : 'Access Denied: Surveyor workspace requires a verified Amin account.'
        );
        return;
      }
    }
    setActiveRoleState(role);
    persistActiveRole(role);
  };

  // Sync state changes with localStorage
  useEffect(() => {
    saveStoredServices(services);
  }, [services]);

  useEffect(() => {
    saveStoredBookings(bookings);
  }, [bookings]);

  useEffect(() => {
    saveStoredAmins(amins);
  }, [amins]);

  useEffect(() => {
    saveStoredApplications(applications);
  }, [applications]);

  useEffect(() => {
    saveStoredRatings(ratings);
  }, [ratings]);

  useEffect(() => {
    saveStoredComplaints(complaints);
  }, [complaints]);

  // Current logged in Amin for Amin role
  const currentAmin = (currentUser?.role === 'amin'
    ? amins.find((a) => a.id === currentUser.id || a.email === currentUser.email) || {
        id: currentUser.id,
        name: currentUser.name || 'আমিন সার্ভেয়ার',
        mobile: currentUser.phone || '01700-000000',
        email: currentUser.email,
        serviceDistricts: [currentUser.district || 'ঢাকা'],
        serviceUpazilas: [currentUser.upazila || 'সাভার'],
        experienceYears: 5,
        rating: 5.0,
        completedJobsCount: 0,
        verificationStatus: 'verified',
        availability: 'available',
        bioBn: 'সার্টিফাইড পেশাদার আমিন সার্ভেয়ার।',
        bioEn: 'Certified professional land surveyor.',
        servicesOffered: ['srvc-land-meas', 'srvc-boundary'],
        isDemo: false,
      }
    : amins[0]) || {
    id: 'amin-demo-1',
    name: 'মোঃ আব্দুর রহমান',
    mobile: '01711-223344',
    serviceDistricts: ['ঢাকা', 'গাজীপুর'],
    serviceUpazilas: ['সাভার', 'ধামরাই', 'কালিয়াকৈর'],
    experienceYears: 12,
    rating: 4.9,
    completedJobsCount: 148,
    verificationStatus: 'verified',
    availability: 'available',
    bioBn: '১২ বছরের অভিজ্ঞতাসম্পন্ন সরকারি সার্ভে ডিপ্লোমাধারী পেশাদার আমিন।',
    bioEn: '12 years experienced certified professional land surveyor.',
    servicesOffered: ['srvc-land-meas', 'srvc-boundary', 'srvc-possession', 'srvc-cadastral'],
    isDemo: true,
  };

  // Amin assigned bookings
  const assignedToCurrentAmin = bookings.filter((b) => {
    if (currentUser?.role === 'amin') {
      return b.assignedAminId === currentUser.id || b.assignedAminId === currentAmin.id;
    }
    return b.assignedAminId === currentAmin.id || !b.assignedAminId;
  });

  // Customer visible bookings (authenticated customers only see their own bookings)
  const customerVisibleBookings = bookings.filter((b) => {
    if (currentUser?.id) {
      return b.customerId === currentUser.id;
    }
    return true;
  });

  // 1. Customer actions
  const handleSuccessBooking = async (newBooking: CustomerBooking) => {
    const customerId = currentUser?.id || newBooking.customerId || 'cust-demo-1';
    const totalFee = newBooking.pricing?.totalFee || newBooking.fee || 2500;
    const bookingWithCustomer: CustomerBooking = {
      ...newBooking,
      customerId,
      fee: totalFee,
      serviceName: newBooking.serviceNameBn || newBooking.serviceNameEn,
      // Security: newly created bookings by customer must always start as pending without self-assigned surveyor
      status: 'pending',
      assignedAminId: undefined,
      assignedAminName: undefined,
      assignedAminPhone: undefined,
      createdAt: newBooking.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: 'pending',
          changedAt: new Date().toLocaleString(),
          changedBy: newBooking.customer.name,
          actorUid: customerId,
          role: 'customer',
          note: isBn ? 'অনলাইনে সার্ভিস বুকিং আবেদন জমা দেওয়া হয়েছে।' : 'Booking request submitted online.',
        },
      ],
    };
    setBookings((prev) => {
      const updated = [bookingWithCustomer, ...prev];
      saveStoredBookings(updated);
      return updated;
    });
    // Also redirect customer to My Bookings
    setCustomerView('my_bookings');

    await logAuditEvent({
      actorUserId: customerId,
      actorRole: 'customer',
      action: 'booking_created',
      entityType: 'booking',
      entityId: bookingWithCustomer.id,
      details: `Service: ${bookingWithCustomer.serviceNameBn}`,
    });

    // In-app alert for Customer
    await sendAppNotification({
      recipientUid: customerId,
      recipientRole: 'customer',
      titleBn: 'বুকিং সফলভাবে গৃহীত হয়েছে',
      titleEn: 'Booking Successfully Submitted',
      messageBn: `আপনার ${bookingWithCustomer.serviceNameBn} বুকিংটি গ্রহণ করা হয়েছে (আইডি: ${bookingWithCustomer.id})। শীঘ্রই অ্যাডমিন একজন অভিজ্ঞ আমিন বরাদ্দ করবেন।`,
      messageEn: `Your booking for ${bookingWithCustomer.serviceNameEn} has been received (ID: ${bookingWithCustomer.id}).`,
      bookingId: bookingWithCustomer.id,
      type: 'booking',
    });

    // In-app alert for Admin
    await sendAppNotification({
      recipientRole: 'admin',
      titleBn: 'নতুন বুকিং আবেদন',
      titleEn: 'New Booking Request',
      messageBn: `গ্রাহক ${bookingWithCustomer.customer.name} নতুন বুকিং দিয়েছেন (আইডি: ${bookingWithCustomer.id})। আমিন বরাদ্দ প্রয়োজন।`,
      messageEn: `New booking request from ${bookingWithCustomer.customer.name} (ID: ${bookingWithCustomer.id}).`,
      bookingId: bookingWithCustomer.id,
      type: 'booking',
    });

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'bookings', bookingWithCustomer.id), cleanForFirestore(bookingWithCustomer));
      } catch (err) {
        console.warn('Firestore booking save note:', err);
      }
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const confirmMsg = isBn
      ? 'আপনি কি নিশ্চিতভাবে এই বুকিংটি বাতিল করতে চান?'
      : 'Are you sure you want to cancel this booking?';
    if (!window.confirm(confirmMsg)) return;

    const now = new Date().toLocaleString();
    let updatedBooking: CustomerBooking | null = null;

    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;
        updatedBooking = {
          ...b,
          status: 'cancelled' as BookingStatus,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...(b.statusHistory || []),
            {
              status: 'cancelled' as BookingStatus,
              changedAt: now,
              changedBy: b.customer.name,
              role: 'customer',
              note: isBn ? 'গ্রাহক কর্তৃক বুকিং বাতিল করা হয়েছে।' : 'Cancelled by customer.',
            },
          ],
        };
        return updatedBooking;
      });
      saveStoredBookings(updated);
      return updated;
    });

    await logAuditEvent({
      actorUserId: currentUser?.id || 'cust-user',
      actorRole: 'customer',
      action: 'booking_cancelled',
      entityType: 'booking',
      entityId: bookingId,
    });

    if (isFirebaseConfigured && db && updatedBooking) {
      try {
        await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
          status: 'cancelled',
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('Firestore booking cancel note:', err);
      }
    }
  };

  // 2. Amin actions
  const handleAminUpdateStatus = async (
    bookingId: string,
    newStatus: BookingStatus,
    note?: string,
    linkedSurveyId?: string,
    scheduledDate?: string
  ) => {
    // Security check: Amins cannot directly mark completed without admin quality check
    const finalStatus: BookingStatus =
      newStatus === 'completed' && currentUser?.role !== 'admin'
        ? 'quality_check'
        : newStatus;

    const now = new Date().toLocaleString();
    let updatedTargetBooking: CustomerBooking | null = null;

    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;
        const prevStatus = b.status;
        updatedTargetBooking = {
          ...b,
          status: finalStatus,
          scheduledDate: scheduledDate || b.scheduledDate,
          linkedSurveyId: linkedSurveyId || b.linkedSurveyId,
          aminNotes: note || b.aminNotes,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...(b.statusHistory || []),
            {
              status: finalStatus,
              previousStatus: prevStatus,
              changedAt: now,
              changedBy: currentAmin.name,
              actorUid: currentAmin.id || currentUser?.id,
              role: 'amin',
              note: note || `আমিন স্ট্যাটাস আপডেট করেছেন: ${finalStatus}`,
            },
          ],
        };
        return updatedTargetBooking;
      });
      saveStoredBookings(updated);
      return updated;
    });

    await logAuditEvent({
      actorUserId: currentAmin.id || currentUser?.id || 'amin-user',
      actorRole: 'amin',
      action: 'booking_status_updated',
      entityType: 'booking',
      entityId: bookingId,
      details: `New status: ${finalStatus}`,
    });

    // Notify Customer on important progress events
    if (updatedTargetBooking) {
      const b: CustomerBooking = updatedTargetBooking;
      if (finalStatus === 'amin_accepted') {
        await sendAppNotification({
          recipientUid: b.customerId,
          recipientRole: 'customer',
          titleBn: 'আমিন দায়িত্ব গ্রহণ করেছেন',
          titleEn: 'Surveyor Accepted Assignment',
          messageBn: `আমিন ${currentAmin.name} আপনার বুকিং ${bookingId}-এর দায়িত্ব গ্রহণ করেছেন।`,
          messageEn: `Amin ${currentAmin.name} has accepted your booking ${bookingId}.`,
          bookingId,
          type: 'assignment',
        });
      } else if (finalStatus === 'scheduled') {
        await sendAppNotification({
          recipientUid: b.customerId,
          recipientRole: 'customer',
          titleBn: 'ফিল্ড পরিমাপের তারিখ নির্ধারিত',
          titleEn: 'Field Survey Scheduled',
          messageBn: `আপনার জমির সরজমিনে পরিমাপের তারিখ নির্ধারণ করা হয়েছে: ${scheduledDate || 'শীঘ্রই জানানো হবে'} (বুকিং: ${bookingId})।`,
          messageEn: `Field survey scheduled for ${scheduledDate || 'soon'} (Booking: ${bookingId}).`,
          bookingId,
          type: 'booking',
        });
      } else if (finalStatus === 'field_work') {
        await sendAppNotification({
          recipientUid: b.customerId,
          recipientRole: 'customer',
          titleBn: 'ফিল্ড পরিমাপ চলছে',
          titleEn: 'Field Survey In Progress',
          messageBn: `আমিন ${currentAmin.name} সরজমিনে আপনার দাগের জমি পরিমাপ করছেন।`,
          messageEn: `Surveyor is conducting on-site GPS measurements.`,
          bookingId,
          type: 'booking',
        });
      } else if (finalStatus === 'quality_check') {
        await sendAppNotification({
          recipientRole: 'admin',
          titleBn: 'মান যাচাই অপেক্ষমাণ (QC)',
          titleEn: 'Audit Submission Pending QC',
          messageBn: `আমিন ${currentAmin.name} বুকিং ${bookingId}-এর ফিল্ড সার্ভে ডাটা জমা দিয়েছেন। যাচাই ও অনুমোদন প্রয়োজন।`,
          messageEn: `Amin submitted field survey data for booking ${bookingId}.`,
          bookingId,
          type: 'qc',
        });
        await sendAppNotification({
          recipientUid: b.customerId,
          recipientRole: 'customer',
          titleBn: 'সার্ভে ডাটা মান যাচাইয়ে রয়েছে',
          titleEn: 'Survey Under Quality Audit',
          messageBn: `আপনার জমির পরিমাপ সম্পন্ন হয়েছে এবং ডিজিটাল সার্টিফিকেট প্রস্তুতের জন্য প্ল্যাটফর্ম মান যাচাইয়ে (QC) রয়েছে।`,
          messageEn: `Measurements complete. Undergoing platform quality audit.`,
          bookingId,
          type: 'qc',
        });
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        const payload: Record<string, any> = {
          status: finalStatus,
          updatedAt: new Date().toISOString(),
        };
        if (scheduledDate) payload.scheduledDate = scheduledDate;
        if (linkedSurveyId) payload.linkedSurveyId = linkedSurveyId;
        if (note) payload.aminNotes = note;
        await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore(payload));
      } catch (err) {
        console.warn('Firestore status update note:', err);
      }
    }
  };

  const handleAminRejectAssignment = async (bookingId: string, reason: string) => {
    const now = new Date().toLocaleString();
    let targetBooking: CustomerBooking | null = null;
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;
        targetBooking = {
          ...b,
          status: 'pending' as BookingStatus,
          assignedAminId: undefined,
          assignedAminName: undefined,
          assignedAminPhone: undefined,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...(b.statusHistory || []),
            {
              status: 'pending' as BookingStatus,
              previousStatus: b.status,
              changedAt: now,
              changedBy: currentAmin.name,
              actorUid: currentAmin.id || currentUser?.id,
              role: 'amin',
              note: `আমিন কাজ প্রত্যাখ্যান করেছেন। কারণ: ${reason}`,
            },
          ],
        };
        return targetBooking;
      });
      saveStoredBookings(updated);
      return updated;
    });

    await logAuditEvent({
      actorUserId: currentAmin.id || currentUser?.id || 'amin-user',
      actorRole: 'amin',
      action: 'assignment_rejected',
      entityType: 'booking',
      entityId: bookingId,
      details: reason,
    });

    await sendAppNotification({
      recipientRole: 'admin',
      titleBn: 'অ্যাসাইনমেন্ট প্রত্যাখ্যান',
      titleEn: 'Assignment Rejected',
      messageBn: `আমিন ${currentAmin.name} বুকিং ${bookingId} প্রত্যাখ্যান করেছেন। কারণ: ${reason}`,
      messageEn: `Surveyor rejected booking ${bookingId}. Reason: ${reason}`,
      bookingId,
      type: 'assignment',
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
          status: 'pending',
          aminNotes: `প্রত্যাখ্যাত: ${reason}`,
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('Firestore amin reject note:', err);
      }
    }
  };

  // 3. Admin actions
  const handleAdminAssignAmin = async (
    bookingId: string,
    aminId: string,
    aminName: string,
    aminPhone: string
  ) => {
    const now = new Date().toLocaleString();
    let targetBooking: CustomerBooking | null = null;
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;
        targetBooking = {
          ...b,
          status: 'assigned' as BookingStatus,
          assignedAminId: aminId,
          assignedAminName: aminName,
          assignedAminPhone: aminPhone,
          assignedBy: currentUser?.name || 'Supervision Admin',
          assignedAt: now,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...(b.statusHistory || []),
            {
              status: 'assigned' as BookingStatus,
              previousStatus: b.status,
              changedAt: now,
              changedBy: currentUser?.name || 'Supervision Admin',
              actorUid: currentUser?.id,
              role: 'admin',
              note: `অ্যাডমিন কর্তৃক আমিন (${aminName}) বরাদ্দ করা হয়েছে।`,
            },
          ],
        };
        return targetBooking;
      });
      saveStoredBookings(updated);
      return updated;
    });

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'amin_assigned',
      entityType: 'booking',
      entityId: bookingId,
      details: `Assigned surveyor: ${aminName} (${aminId})`,
    });

    // Notify Customer
    if (targetBooking) {
      const b: CustomerBooking = targetBooking;
      await sendAppNotification({
        recipientUid: b.customerId,
        recipientRole: 'customer',
        titleBn: 'আমিন সার্ভেয়ার বরাদ্দ করা হয়েছে',
        titleEn: 'Surveyor Assigned',
        messageBn: `আপনার বুকিং ${bookingId}-এর জন্য সার্টিফাইড আমিন ${aminName} (মোবাইল: ${aminPhone})-কে দায়িত্ব দেওয়া হয়েছে।`,
        messageEn: `Surveyor ${aminName} has been assigned to booking ${bookingId}.`,
        bookingId,
        type: 'assignment',
      });
    }

    // Notify Amin
    await sendAppNotification({
      recipientUid: aminId,
      recipientRole: 'amin',
      titleBn: 'নতুন সার্ভে কাজ বরাদ্দ',
      titleEn: 'New Assignment Allocated',
      messageBn: `আপনাকে নতুন একটি সার্ভে কাজের দায়িত্ব দেওয়া হয়েছে (বুকিং: ${bookingId})। ওয়ার্কস্পেস থেকে গ্রহণ করুন।`,
      messageEn: `A new survey job has been assigned to you (Booking: ${bookingId}).`,
      bookingId,
      type: 'assignment',
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
          status: 'assigned',
          assignedAminId: aminId,
          assignedAminName: aminName,
          assignedAminPhone: aminPhone,
          assignedBy: currentUser?.name || 'Admin',
          assignedAt: now,
          updatedAt: new Date().toISOString(),
        }));

        // Record in assignments collection for supervised logs
        const asgnId = `asgn_${Date.now()}_${aminId.substring(0, 5)}`;
        await setDoc(doc(db, 'assignments', asgnId), cleanForFirestore({
          id: asgnId,
          bookingId,
          aminId,
          assignedAt: new Date().toISOString(),
          assignedBy: currentUser?.id || 'admin',
          status: 'accepted',
        }));
      } catch (err) {
        console.warn('Firestore admin assign update note:', err);
      }
    }
  };

  const handleAdminChangeStatus = async (
    bookingId: string,
    newStatus: BookingStatus,
    note: string
  ) => {
    const now = new Date().toLocaleString();
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...(b.statusHistory || []),
            {
              status: newStatus,
              changedAt: now,
              changedBy: currentUser?.name || 'Supervision Admin',
              role: 'admin',
              note,
            },
          ],
        };
      });
      saveStoredBookings(updated);
      return updated;
    });

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'booking_status_overridden',
      entityType: 'booking',
      entityId: bookingId,
      details: `Status: ${newStatus}, Note: ${note}`,
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('Firestore admin status update note:', err);
      }
    }
  };

  const handleApproveQualityCheck = async (bookingId: string) => {
    const now = new Date().toLocaleString();
    let updatedBooking: CustomerBooking | null = null;
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;
        updatedBooking = {
          ...b,
          status: 'completed' as BookingStatus,
          qualityCheckApproved: true,
          qualityCheckedBy: currentUser?.name || 'Quality Audit Team',
          linkedReportId: b.linkedReportId || `rep-${bookingId}`,
          linkedSurveyId: b.linkedSurveyId || 'srv-001',
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...(b.statusHistory || []),
            {
              status: 'completed' as BookingStatus,
              previousStatus: b.status,
              changedAt: now,
              changedBy: currentUser?.name || 'Quality Audit Team',
              actorUid: currentUser?.id,
              role: 'admin',
              note: 'কোয়ালিটি কন্ট্রোল টিম কর্তৃক সার্ভে ও ডিজিটাল নকশা অনুমোদিত এবং চূড়ান্ত সার্টিফিকেট ইস্যু করা হয়েছে।',
            },
          ],
        };
        return updatedBooking;
      });
      saveStoredBookings(updated);
      return updated;
    });

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'quality_check_approved',
      entityType: 'booking',
      entityId: bookingId,
    });

    if (updatedBooking) {
      const b: CustomerBooking = updatedBooking;
      // Notify Customer
      await sendAppNotification({
        recipientUid: b.customerId,
        recipientRole: 'customer',
        titleBn: 'সার্ভে সার্টিফিকেট ও রিপোর্ট প্রস্তুত!',
        titleEn: 'Survey Certificate & Report Issued',
        messageBn: `আপনার বুকিং ${bookingId}-এর ডিজিটাল সীমানা পরিমাপ মান নিয়ন্ত্রণ অডিটে অনুমোদিত হয়েছে। এখন রিপোর্ট দেখতে ও ডাউনলোড করতে পারবেন।`,
        messageEn: `Survey report approved and issued for booking ${bookingId}.`,
        bookingId,
        type: 'report',
      });

      // Notify Amin
      if (b.assignedAminId) {
        await sendAppNotification({
          recipientUid: b.assignedAminId,
          recipientRole: 'amin',
          titleBn: 'সার্ভে কাজ অনুমোদিত ও সম্পন্ন',
          titleEn: 'Job Approved & Completed',
          messageBn: `বুকিং ${bookingId}-এর জন্য আপনার জমা দেওয়া কাজ কোয়ালিটি চেকে সফলভাবে অনুমোদিত হয়েছে।`,
          messageEn: `Survey job approved by QC for booking ${bookingId}.`,
          bookingId,
          type: 'qc',
        });
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
          status: 'completed',
          qualityCheckApproved: true,
          qualityCheckedBy: currentUser?.name || 'Quality Audit Team',
          linkedReportId: `rep-${bookingId}`,
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('Firestore quality approve note:', err);
      }
    }
  };

  const handleRequestCorrection = async (bookingId: string, note: string) => {
    const now = new Date().toLocaleString();
    let updatedBooking: CustomerBooking | null = null;
    setBookings((prev) => {
      const updated = prev.map((b) => {
        if (b.id !== bookingId) return b;
        updatedBooking = {
          ...b,
          status: 'processing' as BookingStatus,
          qualityCheckNotes: note,
          qualityCheckApproved: false,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...(b.statusHistory || []),
            {
              status: 'processing' as BookingStatus,
              previousStatus: b.status,
              changedAt: now,
              changedBy: currentUser?.name || 'Quality Audit Team',
              actorUid: currentUser?.id,
              role: 'admin',
              note: `সংশোধন প্রত্যাশিত: ${note}`,
            },
          ],
        };
        return updatedBooking;
      });
      saveStoredBookings(updated);
      return updated;
    });

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'correction_requested',
      entityType: 'booking',
      entityId: bookingId,
      details: note,
    });

    if (updatedBooking) {
      const b: CustomerBooking = updatedBooking;
      if (b.assignedAminId) {
        await sendAppNotification({
          recipientUid: b.assignedAminId,
          recipientRole: 'amin',
          titleBn: 'সার্ভে সংশোধনের নির্দেশ (QC)',
          titleEn: 'Survey Revision Requested',
          messageBn: `বুকিং ${bookingId}-এর কাজে সুপারভাইজার সংশোধনের নির্দেশ দিয়েছেন: ${note}। দয়া করে সার্ভে আপডেট করে পুনরায় জমা দিন।`,
          messageEn: `QC Revision requested for booking ${bookingId}: ${note}`,
          bookingId,
          type: 'correction',
        });
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'bookings', bookingId), cleanForFirestore({
          status: 'processing',
          qualityCheckNotes: note,
          qualityCheckApproved: false,
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('Firestore correction request note:', err);
      }
    }
  };

  const handleApproveAminApplication = async (applicationId: string) => {
    const app = applications.find((a) => a.id === applicationId);
    if (!app) return;

    // Update application
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, status: 'approved' } : a))
    );

    // Create new verified Amin Profile
    const newAmin: AminProfile = {
      id: `amin-${Date.now()}`,
      name: app.applicantName,
      mobile: app.mobile,
      email: app.email,
      serviceDistricts: [app.district],
      serviceUpazilas: [app.upazila],
      experienceYears: app.experienceYears,
      rating: 5.0,
      completedJobsCount: 0,
      verificationStatus: 'verified',
      availability: 'available',
      bioBn: app.description || `${app.experienceYears} বছরের অভিজ্ঞতাসম্পন্ন সার্টিফাইড আমিন।`,
      bioEn: app.description || `Certified surveyor with ${app.experienceYears} years experience.`,
      servicesOffered: app.services,
      isDemo: false,
    };

    setAmins((prev) => [newAmin, ...prev]);

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'amin_application_approved',
      entityType: 'amin',
      entityId: newAmin.id,
      details: `Approved surveyor: ${newAmin.name}`,
    });

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'aminProfiles', newAmin.id), newAmin);
        await setDoc(doc(db, 'amins', newAmin.id), newAmin);
      } catch (err) {
        console.warn('Firestore amin profile save note:', err);
      }
    }
  };

  const handleRejectAminApplication = async (applicationId: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, status: 'rejected' } : a))
    );

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'amin_application_rejected',
      entityType: 'amin',
      entityId: applicationId,
    });
  };

  const handleUpdateServiceFee = async (
    serviceId: string,
    newBaseFee: number,
    newPlatformFee: number
  ) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const normalized = normalizeServicePricing({
          ...s,
          baseFee: newBaseFee,
          basePrice: newBaseFee,
          platformFee: newPlatformFee,
          platformCommission: newPlatformFee,
        });
        return normalized;
      })
    );

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'service_fee_updated',
      entityType: 'service',
      entityId: serviceId,
      details: `Base: ${newBaseFee}, Platform: ${newPlatformFee}`,
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'services', serviceId), {
          baseFee: newBaseFee,
          basePrice: newBaseFee,
          platformFee: newPlatformFee,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Firestore service fee update note:', err);
      }
    }
  };

  const handleSaveServicePricing = async (updatedService: MarketplaceService) => {
    const normalized = normalizeServicePricing(updatedService);
    setServices((prev) =>
      prev.map((s) => (s.id === normalized.id ? normalized : s))
    );

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'service_pricing_configured',
      entityType: 'service',
      entityId: normalized.id,
      details: `BasePrice: ${normalized.basePrice}, Comm: ${normalized.commissionPercentage}%, Status: ${normalized.active ? 'active' : 'disabled'}`,
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'services', normalized.id), {
          ...normalized,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Firestore service pricing update note:', err);
      }
    }
  };

  const handleToggleServiceStatus = async (serviceId: string, active: boolean) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, active } : s))
    );

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'service_status_toggled',
      entityType: 'service',
      entityId: serviceId,
      details: `Active status set to: ${active}`,
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'services', serviceId), {
          active,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Firestore service status update note:', err);
      }
    }
  };

  const handleAddNewService = async (newService: MarketplaceService) => {
    const normalized = normalizeServicePricing(newService);
    setServices((prev) => [normalized, ...prev]);

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'new_service_created',
      entityType: 'service',
      entityId: normalized.id,
      details: `Created service: ${normalized.nameEn} (Base: ${normalized.basePrice}, Comm: ${normalized.commissionPercentage}%)`,
    });
  };

  const handleResolveComplaint = async (complaintId: string, resolutionNotes: string) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === complaintId
          ? {
              ...c,
              status: 'resolved',
              resolutionNotes,
              resolvedAt: new Date().toISOString(),
            }
          : c
      )
    );

    await logAuditEvent({
      actorUserId: currentUser?.id || 'admin',
      actorRole: 'admin',
      action: 'complaint_resolved',
      entityType: 'complaint',
      entityId: complaintId,
      details: resolutionNotes,
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'complaints', complaintId), {
          status: 'resolved',
          resolutionNotes,
          resolvedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Firestore complaint resolve note:', err);
      }
    }
  };

  // 4. Rating & Complaint Submissions
  const handleSubmitRating = async (newRating: CustomerRating) => {
    const customerId = currentUser?.id || newRating.customerId || 'cust-demo-1';
    const ratingWithCustomer: CustomerRating = {
      ...newRating,
      customerId,
    };
    setRatings((prev) => [ratingWithCustomer, ...prev]);

    await logAuditEvent({
      actorUserId: customerId,
      actorRole: 'customer',
      action: 'rating_submitted',
      entityType: 'booking',
      entityId: ratingWithCustomer.bookingId,
      details: `Score: ${ratingWithCustomer.rating}/5`,
    });

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'ratings', ratingWithCustomer.id), ratingWithCustomer);
      } catch (err) {
        console.warn('Firestore rating save note:', err);
      }
    }
  };

  const handleSubmitComplaint = async (newComplaint: CustomerComplaint) => {
    const customerId = currentUser?.id || newComplaint.customerId || 'cust-demo-1';
    const complaintWithCustomer: CustomerComplaint = {
      ...newComplaint,
      customerId,
    };
    setComplaints((prev) => [complaintWithCustomer, ...prev]);

    await logAuditEvent({
      actorUserId: customerId,
      actorRole: 'customer',
      action: 'complaint_submitted',
      entityType: 'complaint',
      entityId: complaintWithCustomer.id,
      details: `Issue: ${complaintWithCustomer.issueType}`,
    });

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'complaints', complaintWithCustomer.id), complaintWithCustomer);
      } catch (err) {
        console.warn('Firestore complaint save note:', err);
      }
    }
  };

  return (
    <div id="marketplace-screen-container" className="space-y-4 pb-12">
      {/* Role Navigation Bar (When in Customer mode, show sub-tabs: Market, My Services, Directory) */}
      {activeRole === 'customer' && (
        <div className="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCustomerView('marketplace')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                customerView === 'marketplace'
                  ? 'bg-emerald-850 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>{isBn ? 'মার্কেটপ্লেস ও সেবা' : 'Marketplace & Services'}</span>
            </button>

            <button
              onClick={() => setCustomerView('my_bookings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                customerView === 'my_bookings'
                  ? 'bg-emerald-850 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FolderHeart className="w-4 h-4" />
              <span>{isBn ? 'আমার সেবা' : 'My Bookings'}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  customerView === 'my_bookings'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {bookings.length}
              </span>
            </button>

            <button
              onClick={() => setCustomerView('directory')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                customerView === 'directory'
                  ? 'bg-emerald-850 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isBn ? 'আমিন ডিরেক্টরি' : 'Surveyor Directory'}</span>
            </button>
          </div>

          <button
            onClick={() => setIsRegistrationOpen(true)}
            className="hidden sm:flex px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-xs items-center gap-1 transition"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isBn ? 'আমিন নিবন্ধন' : 'Join as Amin'}</span>
          </button>
        </div>
      )}

      {/* RENDER BY ACTIVE ROLE */}
      {activeRole === 'customer' ? (
        customerView === 'marketplace' ? (
          <MarketplaceLanding
            services={services}
            onSelectService={(s) => setSelectedServiceForDetail(s)}
            onBookService={(s) => setSelectedServiceForBooking(s)}
            onOpenAminDirectory={() => setCustomerView('directory')}
            onOpenCustomerDashboard={() => setCustomerView('my_bookings')}
            onOpenAminRegistration={() => setIsRegistrationOpen(true)}
            activeRole={activeRole}
            onChangeRole={handleRoleChange}
            customerBookingsCount={bookings.length}
            lang={lang}
          />
        ) : customerView === 'my_bookings' ? (
          <CustomerDashboard
            bookings={customerVisibleBookings}
            onSelectBooking={(b) => setSelectedBookingForDetails(b)}
            onCancelBooking={handleCancelBooking}
            onOpenReport={onOpenReport || (() => {})}
            onOpenRating={(b) => setRatingBooking(b)}
            onOpenComplaint={(b) => setComplaintBooking(b)}
            onOpenPayment={handleOpenPayment}
            onNewBookingClick={() => setCustomerView('marketplace')}
            lang={lang}
          />
        ) : (
          <AminDirectory
            amins={amins}
            services={services}
            onOpenRegistration={() => setIsRegistrationOpen(true)}
            lang={lang}
          />
        )
      ) : activeRole === 'amin' ? (
        /* AMIN ROLE WORKSPACE */
        <div className="space-y-3">
          {/* Quick Role Switcher Header for Amin */}
          <div className="p-2.5 rounded-2xl bg-slate-900 text-white shadow-xs flex items-center justify-between gap-2 border border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {isBn ? 'আমিন ভিউ' : 'Surveyor View'}
              </span>
              <span className="text-slate-300 font-medium">
                {isBn ? 'ভূমিকা পরিবর্তন:' : 'Switch Role:'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['customer', 'amin', 'admin'] as MarketplaceRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    activeRole === r ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'customer' ? 'গ্রাহক' : r === 'amin' ? 'আমিন' : 'অ্যাডমিন'}
                </button>
              ))}
            </div>
          </div>

          {/* Role Protection for Amin Workspace */}
          {currentUser && currentUser.role === 'customer' ? (
            <div className="p-8 rounded-3xl bg-white border border-amber-200 shadow-xs text-center space-y-3 max-w-lg mx-auto my-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {isBn ? 'প্রবেশাধিকার সংরক্ষিত (আমিন সুরক্ষা)' : 'Restricted Surveyor Access'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isBn
                  ? 'আমিন ফিল্ড কনসোল ও বুকিং ব্যবস্থাপনা শুধুমাত্র সার্টিফাইড আমিনদের জন্য। আপনার অ্যাকাউন্টটি সাধারণ গ্রাহক হিসেবে নিবন্ধিত।'
                  : 'Surveyor Field Console is restricted to certified Amins. Your account is registered as a Customer.'}
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => handleRoleChange('customer')}
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition"
                >
                  {isBn ? 'গ্রাহক হোমে ফিরে যান' : 'Back to Customer View'}
                </button>
                <button
                  onClick={() => setIsRegistrationOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs transition border border-amber-300"
                >
                  {isBn ? 'আমিন নিবন্ধন আবেদন' : 'Apply as Amin'}
                </button>
              </div>
            </div>
          ) : (
            <AminDashboard
              currentAmin={currentAmin}
              assignedBookings={assignedToCurrentAmin}
              onUpdateBookingStatus={handleAminUpdateStatus}
              onRejectAssignment={handleAminRejectAssignment}
              onOpenReport={onOpenReport}
              onOpenSurvey={onOpenSurvey}
              surveys={surveys}
              lang={lang}
            />
          )}
        </div>
      ) : (
        /* ADMIN ROLE WORKSPACE */
        <div className="space-y-3">
          {/* Quick Role Switcher Header for Admin */}
          <div className="p-2.5 rounded-2xl bg-slate-900 text-white shadow-xs flex items-center justify-between gap-2 border border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {isBn ? 'সুপারভিশন অ্যাডমিন' : 'Admin Control'}
              </span>
              <span className="text-slate-300 font-medium">
                {isBn ? 'ভূমিকা পরিবর্তন:' : 'Switch Role:'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['customer', 'amin', 'admin'] as MarketplaceRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    activeRole === r ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'customer' ? 'গ্রাহক' : r === 'amin' ? 'আমিন' : 'অ্যাডমিন'}
                </button>
              ))}
            </div>
          </div>

          {/* Role Protection for Admin Workspace */}
          {currentUser && currentUser.role !== 'admin' ? (
            <div className="p-8 rounded-3xl bg-white border border-amber-200 shadow-xs text-center space-y-3 max-w-lg mx-auto my-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {isBn ? 'প্রবেশাধিকার সংরক্ষিত (অ্যাডমিন সুরক্ষা)' : 'Restricted Admin Access'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isBn
                  ? 'এই সুপারভিশন কনসোলটি শুধুমাত্র অনুমোদিত সিস্টেম অ্যাডমিনদের (Mehedifeni33@gmail.com) জন্য সংরক্ষিত। আপনার বর্তমান ভূমিকা: ' +
                    (currentUser.role === 'customer' ? 'গ্রাহক' : 'আমিন')
                  : 'This supervision console is restricted to platform administrators (Mehedifeni33@gmail.com). Your active role is ' +
                    currentUser.role + '.'}
              </p>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => handleRoleChange(currentUser.role)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
                >
                  {isBn ? 'আমার ড্যাশবোর্ডে ফিরে যান' : 'Return to My Workspace'}
                </button>
              </div>
            </div>
          ) : (
            <AdminDashboard
              bookings={bookings}
              amins={amins}
              applications={applications}
              services={services}
              complaints={complaints}
              onAssignAmin={handleAdminAssignAmin}
              onAdminChangeStatus={handleAdminChangeStatus}
              onApproveQualityCheck={handleApproveQualityCheck}
              onRequestCorrection={handleRequestCorrection}
              onApproveAminApplication={handleApproveAminApplication}
              onRejectAminApplication={handleRejectAminApplication}
              onUpdateServiceFee={handleUpdateServiceFee}
              onSaveServicePricing={handleSaveServicePricing}
              onToggleServiceStatus={handleToggleServiceStatus}
              onAddNewService={handleAddNewService}
              onResolveComplaint={handleResolveComplaint}
              onOpenPayment={handleOpenPayment}
              onOpenReport={onOpenReport}
              lang={lang}
            />
          )}
        </div>
      )}

      {/* MODAL 1: SERVICE DETAIL MODAL */}
      <ServiceDetailModal
        service={selectedServiceForDetail}
        isOpen={!!selectedServiceForDetail}
        onClose={() => setSelectedServiceForDetail(null)}
        onBookService={(s) => {
          setSelectedServiceForDetail(null);
          setSelectedServiceForBooking(s);
        }}
        lang={lang}
      />

      {/* MODAL 2: CUSTOMER BOOKING FORM */}
      {selectedServiceForBooking && (
        <CustomerBookingModal
          service={selectedServiceForBooking}
          isOpen={!!selectedServiceForBooking}
          onClose={() => setSelectedServiceForBooking(null)}
          onSuccessBooking={handleSuccessBooking}
          existingBookings={bookings}
          lang={lang}
        />
      )}

      {/* MODAL 3: BOOKING DETAILS (TIMELINE & ACTIONS) */}
      <BookingDetailsModal
        booking={selectedBookingForDetails}
        isOpen={!!selectedBookingForDetails}
        onClose={() => setSelectedBookingForDetails(null)}
        onCancelBooking={handleCancelBooking}
        onOpenPayment={handleOpenPayment}
        onOpenReport={onOpenReport}
        onOpenComplaint={(b) => {
          setSelectedBookingForDetails(null);
          setComplaintBooking(b);
        }}
        onOpenRating={(b) => {
          setSelectedBookingForDetails(null);
          setRatingBooking(b);
        }}
        userRole={activeRole}
        lang={lang}
      />

      {/* MODAL 4: AMIN REGISTRATION APPLICATION */}
      <AminRegistrationModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
        onSubmitApplication={(app) => {
          setApplications((prev) => [app, ...prev]);
        }}
        services={services}
        lang={lang}
      />

      {/* MODAL 5: RATING & REVIEW MODAL */}
      <RatingModal
        booking={ratingBooking}
        isOpen={!!ratingBooking}
        onClose={() => setRatingBooking(null)}
        onSubmitRating={handleSubmitRating}
        lang={lang}
      />

      {/* MODAL 6: COMPLAINT & DISPUTE MODAL */}
      <ComplaintModal
        booking={complaintBooking}
        isOpen={!!complaintBooking}
        onClose={() => setComplaintBooking(null)}
        onSubmitComplaint={handleSubmitComplaint}
        lang={lang}
      />

      {/* MODAL 7: PAYMENT MANAGEMENT & METHOD FLOW (Phase 17B) */}
      <PaymentModal
        booking={paymentBooking}
        isOpen={!!paymentBooking}
        onClose={() => setPaymentBooking(null)}
        onSavePayment={handleSavePayment}
        currentUserRole={activeRole}
        currentUserName={currentUser?.name}
        lang={lang}
      />
    </div>
  );
};
