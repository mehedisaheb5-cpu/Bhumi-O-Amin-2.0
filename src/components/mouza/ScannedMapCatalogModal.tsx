import React from 'react';
import { Language } from '../../types';
import {
  ScannedMouzaMapCatalogRecord,
  SurveyRecordType,
  LocationSelectionValue,
} from '../../types/administrative-location';
import { MouzaMapLibraryItem } from '../../types/mouza-server-library';
import { AdminMouzaMapLibrary } from './AdminMouzaMapLibrary';

interface ScannedMapCatalogModalProps {
  lang?: Language;
  onClose: () => void;
  onSelectMap?: (record: any) => void;
  onSelectForPentagraph?: (item: MouzaMapLibraryItem) => void;
  onSelectAsCs?: (item: MouzaMapLibraryItem) => void;
  onSelectAsBs?: (item: MouzaMapLibraryItem) => void;
  filterSurveyType?: SurveyRecordType;
  initialLocation?: Partial<LocationSelectionValue>;
}

export const ScannedMapCatalogModal: React.FC<ScannedMapCatalogModalProps> = ({
  lang = 'bn',
  onClose,
  onSelectMap,
  onSelectForPentagraph,
  onSelectAsCs,
  onSelectAsBs,
  filterSurveyType,
  initialLocation,
}) => {
  const handleSelectMapAdapter = (item: MouzaMapLibraryItem) => {
    if (onSelectMap) {
      // Pass adapted record providing backwards compatibility with ScannedMouzaMapCatalogRecord
      const adapted: ScannedMouzaMapCatalogRecord & {
        district: string;
        upazila: string;
        mouza: string;
        sheet: string;
        catalogStatus?: string;
        libraryItem: MouzaMapLibraryItem;
      } = {
        id: item.id,
        mapTitle: item.mapTitle,
        divisionId: item.divisionId,
        districtId: item.districtId,
        upazilaId: item.upazilaId,
        mouzaNameBn: item.mouzaNameBn,
        mouzaNameEn: item.mouzaNameEn,
        jlNo: item.jlNo,
        surveyType: item.surveyType,
        sheetNumber: item.sheetNumber,
        originalFileName: item.originalFileName,
        fileReference: item.fileReference,
        fileSizeBytes: item.fileSizeBytes,
        mimeType: item.mimeType,
        uploadDate: item.uploadDate,
        source: item.source || item.storageProvider,
        verificationStatus: item.verificationStatus === 'Verified' ? 'verified' : 'unverified',
        catalogStatus: item.verificationStatus,
        scale: item.scale,
        georeferencingStatus: item.georeferencingStatus || 'none',
        isDemo: item.isDemo,
        district: item.districtNameBn,
        upazila: item.upazilaNameBn,
        mouza: item.mouzaNameBn,
        sheet: item.sheetNumber,
        libraryItem: item,
      };
      onSelectMap(adapted);
    }
  };

  return (
    <AdminMouzaMapLibrary
      lang={lang}
      onClose={onClose}
      onSelectMap={handleSelectMapAdapter}
      onSelectForPentagraph={(item) => {
        if (onSelectForPentagraph) {
          onSelectForPentagraph(item);
        } else if (onSelectMap) {
          handleSelectMapAdapter(item);
        }
      }}
      onSelectAsCs={(item) => {
        if (onSelectAsCs) {
          onSelectAsCs(item);
        } else if (onSelectMap) {
          handleSelectMapAdapter(item);
        }
      }}
      onSelectAsBs={(item) => {
        if (onSelectAsBs) {
          onSelectAsBs(item);
        } else if (onSelectMap) {
          handleSelectMapAdapter(item);
        }
      }}
      initialSurveyType={filterSurveyType}
      initialLocation={initialLocation}
      asModal={true}
    />
  );
};
