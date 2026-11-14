import { isFirebaseConfigured, db, doc, setDoc, cleanForFirestore } from './firebase';
import { UserProfile, SurveyRecord, SurveyReportRecord, CustomerBooking, ComparativePentagraphProject } from '../types';
import { getSavedReports } from './survey-report-utils';
import { getStoredBookings } from './marketplaceStorage';
import { getStoredPentagraphProjects } from './mouza-map';
import { logAuditEvent } from './auditLog';

export interface SyncStats {
  surveysSynced: number;
  reportsSynced: number;
  bookingsSynced: number;
  pentagraphSynced: number;
  success: boolean;
  messageBn: string;
  messageEn: string;
}

export async function syncLocalDataToCloud(user: UserProfile): Promise<SyncStats> {
  if (!isFirebaseConfigured || !db) {
    return {
      surveysSynced: 0,
      reportsSynced: 0,
      bookingsSynced: 0,
      pentagraphSynced: 0,
      success: false,
      messageBn: 'ক্লাউড সংযোগ বর্তমানে পাওয়া যাচ্ছে না। আপনার পুরোনো ডিভাইসের স্থানীয় ডেটা এখনও এই ডিভাইসে সংরক্ষিত আছে।',
      messageEn: 'Cloud connection currently unavailable. Your legacy local device data remains safely stored on this device.',
    };
  }

  let surveysSynced = 0;
  let reportsSynced = 0;
  let bookingsSynced = 0;
  let pentagraphSynced = 0;

  try {
    // 1. Sync Local Surveys from bhumi_surveys
    const rawSurveys = localStorage.getItem('bhumi_surveys');
    if (rawSurveys) {
      const surveys: SurveyRecord[] = JSON.parse(rawSurveys);
      for (const survey of surveys) {
        // Enforce ownership so firestore.rules validates request.auth.uid
        const cloudSurvey: SurveyRecord = {
          ...survey,
          ownerId: user.role === 'admin' && survey.ownerId ? survey.ownerId : user.id,
          updatedAt: Date.now(),
        };
        const path = `surveyRecords/${cloudSurvey.id}`;
        try {
          await setDoc(doc(db, 'surveyRecords', cloudSurvey.id), cleanForFirestore(cloudSurvey));
          surveysSynced++;
        } catch (err) {
          console.warn('Failed to sync survey to cloud:', path, err);
        }
      }
    }

    // 2. Sync Local Reports from bhumi-amin-reports
    const reports = getSavedReports();
    for (const report of reports) {
      const cloudReport: SurveyReportRecord = {
        ...report,
        ownerId: user.role === 'admin' && report.ownerId ? report.ownerId : user.id,
        updatedAt: Date.now(),
      };
      try {
        await setDoc(doc(db, 'reports', cloudReport.id), cleanForFirestore(cloudReport));
        reportsSynced++;
      } catch (err) {
        console.warn('Failed to sync report to cloud:', report.id, err);
      }
    }

    // 3. Sync Bookings if applicable
    const bookings = getStoredBookings();
    for (const booking of bookings) {
      // Only sync non-demo bookings matching current user or owned
      if (!booking.isDemo) {
        const cloudBooking: CustomerBooking = {
          ...booking,
          customerId: user.role === 'admin' && booking.customerId ? booking.customerId : user.id,
          fee: booking.pricing?.totalFee || booking.fee || 2500,
          serviceName: booking.serviceNameBn || booking.serviceNameEn,
          updatedAt: new Date().toISOString(),
        };
        try {
          await setDoc(doc(db, 'bookings', cloudBooking.id), cleanForFirestore(cloudBooking));
          bookingsSynced++;
        } catch (err) {
          console.warn('Failed to sync booking to cloud:', booking.id, err);
        }
      }
    }

    // 4. Sync Pentagraph Projects
    const pentagraphProjects = getStoredPentagraphProjects();
    for (const proj of pentagraphProjects) {
      const cloudProj: ComparativePentagraphProject = {
        ...proj,
        ownerId: user.role === 'admin' && proj.ownerId ? proj.ownerId : user.id,
        updatedAt: Date.now(),
      };
      try {
        await setDoc(doc(db, 'pentagraphProjects', cloudProj.id), cleanForFirestore(cloudProj));
        pentagraphSynced++;
      } catch (err) {
        console.warn('Failed to sync pentagraph project to cloud:', proj.id, err);
      }
    }

    // Record audit event for cloud migration
    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'local_data_synced_to_cloud',
      entityType: 'user',
      entityId: user.id,
      details: `Synced ${surveysSynced} surveys, ${reportsSynced} reports, ${bookingsSynced} bookings, ${pentagraphSynced} pentagraph projects to cloud.`,
    });

    return {
      surveysSynced,
      reportsSynced,
      bookingsSynced,
      pentagraphSynced,
      success: true,
      messageBn: `ক্লাউডে সফলভাবে সংরক্ষিত হয়েছে: ${surveysSynced}টি সার্ভে, ${reportsSynced}টি রিপোর্ট, ${bookingsSynced}টি বুকিং, ${pentagraphSynced}টি পেন্টাগ্রাফ প্রকল্প। আপনার স্থানীয় ডেটাও অক্ষত রয়েছে।`,
      messageEn: `Successfully saved to cloud: ${surveysSynced} surveys, ${reportsSynced} reports, ${bookingsSynced} bookings, ${pentagraphSynced} pentagraph projects. Local data also preserved.`,
    };
  } catch (error) {
    console.error('Data synchronization error:', error);
    return {
      surveysSynced,
      reportsSynced,
      bookingsSynced,
      pentagraphSynced,
      success: false,
      messageBn: 'ক্লাউড সিঙ্ক প্রক্রিয়ায় ত্রুটি ঘটেছে। আপনার পুরোনো ডিভাইসের স্থানীয় ডেটা এখনও এই ডিভাইসে সম্পূর্ণ নিরাপদ ও সংরক্ষিত আছে।',
      messageEn: 'Error during cloud sync. Your legacy local device data remains safely stored on this device.',
    };
  }
}
