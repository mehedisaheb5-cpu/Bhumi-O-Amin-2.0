import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { CurrentGpsPosition, GpsPoint } from '../../lib/gps-types';
import { Language } from '../../types';
import { formatNumberByLang } from '../../lib/land-units';
import { formatCoordinate } from '../../lib/gps-utils';
import {
  ParcelBoundaryPoint,
  SavedParcelRecord,
  getPointLabel,
  getStoredParcels,
  saveParcelToStorage,
  deleteParcelFromStorage,
} from '../../lib/google-maps-types';
import {
  calculatePolygonArea,
  calculateDistance,
  LatLngPoint,
} from '../../lib/gps-geometry';
import {
  MapPin,
  Layers,
  AlertTriangle,
  Info,
  Key,
  Loader2,
  Crosshair,
  Maximize2,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Save,
  FolderOpen,
  X,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Search,
  Navigation,
  LocateFixed,
  Eye,
  EyeOff,
  Clock,
  Target,
} from 'lucide-react';

interface GoogleMapsParcelViewProps {
  currentPos: CurrentGpsPosition | null;
  points: GpsPoint[];
  isWatching: boolean;
  lang: Language;
  onStartGps?: () => void;
  onSaveParcel?: (parcel: SavedParcelRecord) => void;
}

export const GoogleMapsParcelView: React.FC<GoogleMapsParcelViewProps> = ({
  currentPos,
  points: surveyGpsPoints = [],
  isWatching,
  lang,
  onStartGps,
  onSaveParcel,
}) => {
  const isBn = lang === 'bn';

  // Environment Variable Check: ONLY read from import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
  const isApiKeyConfigured = Boolean(apiKey);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  // Manual Boundary Map Overlays
  const manualPolygonRef = useRef<google.maps.Polygon | null>(null);
  const manualPolylineRef = useRef<google.maps.Polyline | null>(null);
  const manualMarkersRef = useRef<any[]>([]);

  // GPS Survey Map Overlays
  const surveyPolygonRef = useRef<google.maps.Polygon | null>(null);
  const surveyPolylineRef = useRef<google.maps.Polyline | null>(null);
  const surveyMarkersRef = useRef<any[]>([]);

  // Real GPS Device Location Overlay
  const realGpsMarkerRef = useRef<any>(null);
  const realGpsCircleRef = useRef<google.maps.Circle | null>(null);

  // Search Location Overlay
  const searchMarkerRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Map Lifecycle States
  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    isApiKeyConfigured ? 'loading' : 'idle'
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');

  // Layer Visibility Controls
  const [layers, setLayers] = useState({
    manualBoundary: true,
    gpsBoundary: true,
    surveyPoints: true,
    currentLocation: true,
  });
  const [showLayersMenu, setShowLayersMenu] = useState(false);

  // Manual Parcel Boundary Points State (A-Z)
  const [boundaryPoints, setBoundaryPoints] = useState<ParcelBoundaryPoint[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const isDrawingModeRef = useRef<boolean>(false);
  isDrawingModeRef.current = isDrawingMode;

  // Real Device GPS Location State
  const [deviceLocation, setDeviceLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null>(() =>
    currentPos
      ? {
          latitude: currentPos.latitude,
          longitude: currentPos.longitude,
          accuracy: currentPos.accuracy,
          timestamp: currentPos.timestamp,
        }
      : null
  );
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);
  const [deviceLocationError, setDeviceLocationError] = useState<string | null>(null);

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [searchUnavailableError, setSearchUnavailableError] = useState<string | null>(null);

  // Point Info Modal / Popover (for GPS Survey Point Details)
  const [selectedSurveyPoint, setSelectedSurveyPoint] = useState<GpsPoint | null>(null);

  // UI Modals & Drawers
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showSavedParcelsModal, setShowSavedParcelsModal] = useState<boolean>(false);
  const [showPointsTable, setShowPointsTable] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Saved Parcels list from localStorage
  const [savedParcels, setSavedParcels] = useState<SavedParcelRecord[]>(() => getStoredParcels());

  // Form state for saving parcel
  const [saveForm, setSaveForm] = useState({
    title: '',
    district: '',
    upazila: '',
    union: '',
    mouza: '',
    jlNo: '',
    dagNo: '',
    khatianNo: '',
    notes: '',
  });

  // Keep device location updated when currentPos prop updates
  useEffect(() => {
    if (currentPos) {
      setDeviceLocation({
        latitude: currentPos.latitude,
        longitude: currentPos.longitude,
        accuracy: currentPos.accuracy,
        timestamp: currentPos.timestamp,
      });
    }
  }, [currentPos]);

  // Calculate polygon geometry and land units for manual boundary
  const manualCalculationResult = useMemo(() => {
    if (boundaryPoints.length < 2) return null;

    const latLngPoints: LatLngPoint[] = boundaryPoints.map((p) => ({
      latitude: p.lat,
      longitude: p.lng,
      label: p.label,
      id: p.id,
    }));

    if (boundaryPoints.length >= 3) {
      return calculatePolygonArea(latLngPoints);
    } else {
      const p1 = latLngPoints[0];
      const p2 = latLngPoints[1];
      const distM = calculateDistance(p1, p2);
      const distFt = distM * 3.28084;
      return {
        isValid: false,
        pointCount: 2,
        areaSqMeters: 0,
        areaSqFt: 0,
        perimeterMeters: distM,
        perimeterFt: distFt,
        segments: [],
        landUnits: {
          sqFt: 0,
          sqMeter: 0,
          shatangsha: 0,
          katha: 0,
          bigha: 0,
          acre: 0,
          gonda: 0,
          kora: 0,
          kranti: 0,
          til: 0,
        },
        validation: {
          isValid: false,
          totalPoints: 2,
          validPointsCount: 2,
          hasEnoughPoints: false,
          hasDuplicates: false,
          errors: [],
          warnings: [],
        },
      };
    }
  }, [boundaryPoints]);

  // Calculate polygon geometry for GPS Survey boundary if 3+ points exist
  const gpsSurveyCalculationResult = useMemo(() => {
    if (surveyGpsPoints.length < 3) return null;

    const latLngPoints: LatLngPoint[] = surveyGpsPoints.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      label: p.label,
      id: p.id,
    }));

    return calculatePolygonArea(latLngPoints);
  }, [surveyGpsPoints]);

  // Add a new boundary point in manual drawing mode
  const handleAddPoint = useCallback((lat: number, lng: number) => {
    setBoundaryPoints((prev) => {
      const newIndex = prev.length;
      const newPoint: ParcelBoundaryPoint = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: getPointLabel(newIndex),
        lat,
        lng,
        createdAt: Date.now(),
      };
      return [...prev, newPoint];
    });
  }, []);

  // ---------------------------------------------------------------------------
  // 1. Initialize Google Maps
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isApiKeyConfigured) {
      setMapStatus('idle');
      return;
    }

    let isMounted = true;
    setMapStatus('loading');
    setLoadError(null);

    const initMap = async () => {
      try {
        setOptions({
          key: apiKey,
          v: 'weekly',
          libraries: ['geometry', 'places', 'marker'],
        });

        const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;

        if (!isMounted || !mapContainerRef.current) return;

        // Choose initial map center prioritizing survey points, current GPS, or default
        let initialLat = 23.8103;
        let initialLng = 90.4125;
        let initialZoom = 15;

        if (surveyGpsPoints.length > 0) {
          initialLat = surveyGpsPoints[0].latitude;
          initialLng = surveyGpsPoints[0].longitude;
          initialZoom = 18;
        } else if (currentPos) {
          initialLat = currentPos.latitude;
          initialLng = currentPos.longitude;
          initialZoom = 18;
        }

        const mapOptions: google.maps.MapOptions = {
          center: { lat: initialLat, lng: initialLng },
          zoom: initialZoom,
          mapTypeId: mapTypeId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: false,
          gestureHandling: 'greedy',
          // @ts-ignore
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
        };

        const map = new Map(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = map;

        // Map Click Handler for Manual Drawing Mode
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!isDrawingModeRef.current) return;
          if (!e.latLng) return;
          handleAddPoint(e.latLng.lat(), e.latLng.lng());
        });

        if (isMounted) {
          setMapStatus('ready');
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const errorMsg = err instanceof Error ? err.message : 'Failed to load Google Maps SDK';
        console.error('Failed to load Google Maps SDK:', err);
        setMapStatus('error');
        setLoadError(errorMsg);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      mapInstanceRef.current = null;
    };
  }, [isApiKeyConfigured, apiKey, handleAddPoint]);

  // ---------------------------------------------------------------------------
  // 2. Google Places Autocomplete Setup on Search Input
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isApiKeyConfigured || mapStatus !== 'ready' || !searchInputRef.current) return;
    if (!window.google?.maps?.places?.Autocomplete) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ['geometry', 'formatted_address', 'name'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || place.name || '';
          setSearchQuery(address);
          setSearchResult({ lat, lng, address });
          setSearchUnavailableError(null);

          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo({ lat, lng });
            mapInstanceRef.current.setZoom(17);
          }
        }
      });
    } catch {
      // Graceful fallback to Geocoder on manual submission
    }
  }, [mapStatus, isApiKeyConfigured]);

  // Execute Search via Geocoder or Places
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (!window.google || !window.google.maps) {
      setSearchUnavailableError(
        isBn
          ? 'Google Maps প্রস্তুত নয়। অনুগ্রহ করে অপেক্ষা করুন।'
          : 'Google Maps is not ready yet. Please wait.'
      );
      return;
    }

    setIsSearching(true);
    setSearchUnavailableError(null);

    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        setIsSearching(false);
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          const loc = results[0].geometry.location;
          const lat = loc.lat();
          const lng = loc.lng();
          const address = results[0].formatted_address;

          setSearchResult({ lat, lng, address });

          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo({ lat, lng });
            mapInstanceRef.current.setZoom(17);
          }
        } else {
          setSearchUnavailableError(
            isBn
              ? `অনুসন্ধান সেবা অনুপলব্ধ: "${query}" এর অবস্থান পাওয়া যায়নি (${status})`
              : `Search unavailable: Location not found for "${query}" (${status})`
          );
        }
      });
    } catch (err: any) {
      setIsSearching(false);
      setSearchUnavailableError(
        isBn
          ? 'অনুসন্ধান সেবা অনুপলব্ধ: Google Geocoding API ত্রুটি ঘটেছে।'
          : 'Search unavailable: Google Geocoding API service error.'
      );
    }
  };

  // Clear Search Result
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResult(null);
    setSearchUnavailableError(null);
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Real Device Geolocation ("আমার অবস্থান")
  // ---------------------------------------------------------------------------
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      setDeviceLocationError(
        isBn
          ? 'আপনার ব্রাউজার বা ডিভাইসে জিপিএস সেবা সমর্থিত নয়।'
          : 'Geolocation is not supported by your browser or device.'
      );
      return;
    }

    setIsLocatingDevice(true);
    setDeviceLocationError(null);

    // Explicit user action to request current location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingDevice(false);
        const { latitude, longitude, accuracy } = pos.coords;
        const newPos = {
          latitude,
          longitude,
          accuracy,
          timestamp: pos.timestamp,
        };
        setDeviceLocation(newPos);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat: latitude, lng: longitude });
          mapInstanceRef.current.setZoom(18);
        }
      },
      (err) => {
        setIsLocatingDevice(false);
        let msg = '';
        switch (err.code) {
          case 1: // PERMISSION_DENIED
            msg = isBn
              ? 'লোকেশন অনুমতি প্রত্যাখ্যাত। ব্রাউজার সেটিংসে লোকেশন অন করুন।'
              : 'Location permission denied. Please allow location access.';
            break;
          case 2: // POSITION_UNAVAILABLE
            msg = isBn
              ? 'ডিভাইসের সঠিক অবস্থান শনাক্ত করা সম্ভব হয়নি।'
              : 'Location information is unavailable.';
            break;
          case 3: // TIMEOUT
            msg = isBn
              ? 'লোকেশন পেতে নির্ধারিত সময় অতিক্রান্ত হয়েছে (Timeout)।'
              : 'Location request timed out. Please try again.';
            break;
          default:
            msg = isBn ? 'অবস্থান নির্ণয়ে সমস্যা হয়েছে।' : 'Failed to determine device location.';
        }
        setDeviceLocationError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // ---------------------------------------------------------------------------
  // 4. Overlays Management: Manual Boundary + Markers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mapStatus !== 'ready') return;

    // Clear old manual markers
    manualMarkersRef.current.forEach((m) => m.setMap(null));
    manualMarkersRef.current = [];

    // Clear old manual polygon & polyline
    if (manualPolygonRef.current) {
      manualPolygonRef.current.setMap(null);
      manualPolygonRef.current = null;
    }
    if (manualPolylineRef.current) {
      manualPolylineRef.current.setMap(null);
      manualPolylineRef.current = null;
    }

    // Only draw manual markers and boundary if layer is enabled and points exist
    if (!layers.manualBoundary || boundaryPoints.length === 0) return;

    // Create markers for manual boundary points (Green Theme)
    const newMarkers: any[] = [];
    boundaryPoints.forEach((pt) => {
      const marker = new google.maps.Marker({
        position: { lat: pt.lat, lng: pt.lng },
        map,
        title: `ম্যানুয়াল পয়েন্ট ${pt.label}`,
        label: {
          text: pt.label,
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '12px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: '#059669', // Emerald
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      newMarkers.push(marker);
    });
    manualMarkersRef.current = newMarkers;

    // Connect manual points
    const pathCoords = boundaryPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
    if (boundaryPoints.length === 2) {
      const polyline = new google.maps.Polyline({
        path: pathCoords,
        strokeColor: '#059669',
        strokeOpacity: 0.95,
        strokeWeight: 3.5,
        clickable: false,
        map,
      });
      manualPolylineRef.current = polyline;
    } else if (boundaryPoints.length >= 3) {
      const polygon = new google.maps.Polygon({
        paths: pathCoords,
        strokeColor: '#059669',
        strokeOpacity: 0.95,
        strokeWeight: 3.5,
        fillColor: '#10b981',
        fillOpacity: 0.25,
        clickable: false,
        map,
      });
      manualPolygonRef.current = polygon;
    }
  }, [boundaryPoints, layers.manualBoundary, mapStatus]);

  // ---------------------------------------------------------------------------
  // 5. Overlays Management: GPS Survey Points & GPS Survey Boundary Layer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mapStatus !== 'ready') return;

    // Clear old survey markers
    surveyMarkersRef.current.forEach((m) => m.setMap(null));
    surveyMarkersRef.current = [];

    // Clear old survey polygon & polyline
    if (surveyPolygonRef.current) {
      surveyPolygonRef.current.setMap(null);
      surveyPolygonRef.current = null;
    }
    if (surveyPolylineRef.current) {
      surveyPolylineRef.current.setMap(null);
      surveyPolylineRef.current = null;
    }

    if (surveyGpsPoints.length === 0) return;

    // Render GPS Survey Point Markers (Royal Blue / Indigo Theme) if layer enabled
    if (layers.surveyPoints) {
      const newMarkers: any[] = [];
      surveyGpsPoints.forEach((pt) => {
        const marker = new google.maps.Marker({
          position: { lat: pt.latitude, lng: pt.longitude },
          map,
          title: `জরিপ পয়েন্ট ${pt.label} (সঠিকতা: ±${pt.accuracy.toFixed(1)} মি.)`,
          label: {
            text: pt.label,
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '11px',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: '#2563eb', // Royal Blue
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
          },
        });

        // Click on GPS Survey Point to display detailed info
        marker.addListener('click', () => {
          setSelectedSurveyPoint(pt);
          map.panTo({ lat: pt.latitude, lng: pt.longitude });
        });

        newMarkers.push(marker);
      });
      surveyMarkersRef.current = newMarkers;
    }

    // Render GPS Survey Boundary (Blue) if layer enabled
    if (layers.gpsBoundary && surveyGpsPoints.length >= 2) {
      const pathCoords = surveyGpsPoints.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
      }));

      if (surveyGpsPoints.length === 2) {
        const polyline = new google.maps.Polyline({
          path: pathCoords,
          strokeColor: '#2563eb',
          strokeOpacity: 0.95,
          strokeWeight: 3.5,
          clickable: false,
          map,
        });
        surveyPolylineRef.current = polyline;
      } else if (surveyGpsPoints.length >= 3) {
        const polygon = new google.maps.Polygon({
          paths: pathCoords,
          strokeColor: '#1d4ed8',
          strokeOpacity: 0.95,
          strokeWeight: 3.5,
          fillColor: '#3b82f6',
          fillOpacity: 0.22,
          clickable: false,
          map,
        });
        surveyPolygonRef.current = polygon;
      }
    }
  }, [surveyGpsPoints, layers.surveyPoints, layers.gpsBoundary, mapStatus]);

  // ---------------------------------------------------------------------------
  // 6. Overlays Management: Real Device Location & Search Marker
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mapStatus !== 'ready') return;

    // 6a. Device GPS Marker & Accuracy Circle
    if (realGpsMarkerRef.current) {
      realGpsMarkerRef.current.setMap(null);
      realGpsMarkerRef.current = null;
    }
    if (realGpsCircleRef.current) {
      realGpsCircleRef.current.setMap(null);
      realGpsCircleRef.current = null;
    }

    if (layers.currentLocation && deviceLocation) {
      // Blue pulsing dot
      const marker = new google.maps.Marker({
        position: { lat: deviceLocation.latitude, lng: deviceLocation.longitude },
        map,
        title: `আমার অবস্থান (±${deviceLocation.accuracy.toFixed(1)} মি.)`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#0284c7', // Cyan-blue
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      realGpsMarkerRef.current = marker;

      // Accuracy circle
      const circle = new google.maps.Circle({
        strokeColor: '#0284c7',
        strokeOpacity: 0.5,
        strokeWeight: 1.5,
        fillColor: '#38bdf8',
        fillOpacity: 0.15,
        map,
        center: { lat: deviceLocation.latitude, lng: deviceLocation.longitude },
        radius: Math.min(deviceLocation.accuracy, 100), // Cap visual radius for aesthetics
      });
      realGpsCircleRef.current = circle;
    }

    // 6b. Search Marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
    }

    if (searchResult) {
      const marker = new google.maps.Marker({
        position: { lat: searchResult.lat, lng: searchResult.lng },
        map,
        title: searchResult.address,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#dc2626',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      searchMarkerRef.current = marker;
    }
  }, [deviceLocation, searchResult, layers.currentLocation, mapStatus]);

  // ---------------------------------------------------------------------------
  // 7. Boundary Tools: Fit Bounds Handlers
  // ---------------------------------------------------------------------------
  // Fit GPS Survey Boundary
  const handleFitGpsBoundary = useCallback(() => {
    if (!mapInstanceRef.current || surveyGpsPoints.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    surveyGpsPoints.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    mapInstanceRef.current.fitBounds(bounds, 60);
  }, [surveyGpsPoints]);

  // Fit Manual Boundary
  const handleFitManualBoundary = useCallback(() => {
    if (!mapInstanceRef.current || boundaryPoints.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    boundaryPoints.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    mapInstanceRef.current.fitBounds(bounds, 60);
  }, [boundaryPoints]);

  // Fit All Boundaries & Locations
  const handleFitAll = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;

    boundaryPoints.forEach((p) => {
      bounds.extend({ lat: p.lat, lng: p.lng });
      count++;
    });

    surveyGpsPoints.forEach((p) => {
      bounds.extend({ lat: p.latitude, lng: p.longitude });
      count++;
    });

    if (deviceLocation) {
      bounds.extend({ lat: deviceLocation.latitude, lng: deviceLocation.longitude });
      count++;
    }

    if (searchResult) {
      bounds.extend({ lat: searchResult.lat, lng: searchResult.lng });
      count++;
    }

    if (count > 0) {
      mapInstanceRef.current.fitBounds(bounds, 60);
    }
  }, [boundaryPoints, surveyGpsPoints, deviceLocation, searchResult]);

  // Sync Map Type (roadmap / satellite / hybrid)
  const handleMapTypeChange = (type: 'roadmap' | 'satellite' | 'hybrid') => {
    setMapTypeId(type);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(type);
    }
  };

  // Zoom In / Out
  const handleZoom = (delta: number) => {
    if (!mapInstanceRef.current) return;
    const currentZoom = mapInstanceRef.current.getZoom() || 16;
    mapInstanceRef.current.setZoom(currentZoom + delta);
  };

  // Undo Last Manual Point
  const handleUndoLastPoint = () => {
    if (boundaryPoints.length === 0) return;
    setBoundaryPoints((prev) => prev.slice(0, -1));
  };

  // Delete Individual Manual Point
  const handleDeletePoint = (deleteId: string) => {
    setBoundaryPoints((prev) => {
      const filtered = prev.filter((p) => p.id !== deleteId);
      return filtered.map((p, idx) => ({
        ...p,
        label: getPointLabel(idx),
      }));
    });
  };

  // Clear All Manual Points
  const handleClearAllPoints = () => {
    setBoundaryPoints([]);
    setShowClearConfirm(false);
  };

  // Open Save Modal
  const handleOpenSaveModal = () => {
    if (boundaryPoints.length < 3) return;
    setSaveForm({
      title: `পার্সেল দাগ সীমানা (${boundaryPoints.length} পয়েন্ট)`,
      district: '',
      upazila: '',
      union: '',
      mouza: '',
      jlNo: '',
      dagNo: '',
      khatianNo: '',
      notes: '',
    });
    setShowSaveModal(true);
  };

  // Confirm Save Parcel
  const handleConfirmSaveParcel = (e: React.FormEvent) => {
    e.preventDefault();
    if (boundaryPoints.length < 3 || !manualCalculationResult) return;

    const newParcel: SavedParcelRecord = {
      id: `parcel_${Date.now()}`,
      title: saveForm.title.trim() || `দাগ পরিমাপ ${Date.now()}`,
      district: saveForm.district.trim(),
      upazila: saveForm.upazila.trim(),
      union: saveForm.union.trim(),
      mouza: saveForm.mouza.trim(),
      jlNo: saveForm.jlNo.trim(),
      dagNo: saveForm.dagNo.trim(),
      khatianNo: saveForm.khatianNo.trim(),
      notes: saveForm.notes.trim(),
      points: boundaryPoints,
      perimeterMeters: manualCalculationResult.perimeterMeters,
      perimeterFeet: manualCalculationResult.perimeterFt,
      areaSqMeters: manualCalculationResult.areaSqMeters,
      areaSqFt: manualCalculationResult.areaSqFt,
      shatangsha: manualCalculationResult.landUnits.shatangsha,
      katha: manualCalculationResult.landUnits.katha,
      bigha: manualCalculationResult.landUnits.bigha,
      acre: manualCalculationResult.landUnits.acre,
      source: 'google_maps_manual',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = saveParcelToStorage(newParcel);
    setSavedParcels(updated);
    if (onSaveParcel) onSaveParcel(newParcel);

    setShowSaveModal(false);
    setSaveSuccessMsg(
      isBn ? 'পার্সেল সীমানা সফলভাবে সংরক্ষিত হয়েছে!' : 'Parcel boundary saved successfully!'
    );
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Load a Saved Parcel
  const handleLoadSavedParcel = (parcel: SavedParcelRecord) => {
    setBoundaryPoints(parcel.points);
    setShowSavedParcelsModal(false);

    setTimeout(() => {
      if (mapInstanceRef.current && parcel.points.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        parcel.points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        mapInstanceRef.current.fitBounds(bounds, 60);
      }
    }, 150);
  };

  // Delete a Saved Parcel
  const handleDeleteSavedParcel = (parcelId: string) => {
    const updated = deleteParcelFromStorage(parcelId);
    setSavedParcels(updated);
  };

  // ---------------------------------------------------------------------------
  // STATE: API Key Missing (Not Configured)
  // ---------------------------------------------------------------------------
  if (!isApiKeyConfigured) {
    return (
      <div
        id="google-maps-unconfigured-container"
        className="rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-b from-amber-50/80 to-white p-6 sm:p-8 text-center shadow-xs"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-2xs mb-4">
          <Key className="h-7 w-7" />
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-900">
          {isBn
            ? 'Google Maps চালু করতে API Key কনফিগার করতে হবে।'
            : 'API Key configuration required to enable Google Maps.'}
        </h3>

        <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          {isBn
            ? 'উচ্চমানের স্যাটেলাইট ম্যাপ ও দাগ/পার্সেল চিহ্নিতকরণের জন্য গুগল ম্যাপস প্ল্যাটফর্ম এপিআই কি প্রয়োজন। আপনার এনভায়রনমেন্টে VITE_GOOGLE_MAPS_API_KEY সেট করুন।'
            : 'A Google Maps Platform API key is required for high-resolution satellite imagery and parcel mapping. Configure VITE_GOOGLE_MAPS_API_KEY in your environment.'}
        </p>

        {/* Informative Guidance Card */}
        <div className="mt-5 max-w-md mx-auto rounded-xl bg-white p-3.5 border border-amber-200/90 text-left text-xs text-slate-700 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{isBn ? 'কীভাবে কনফিগার করবেন:' : 'How to configure:'}</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
            <li>
              {isBn
                ? 'Google Cloud Console থেকে Maps JavaScript API সক্রিয় করুন।'
                : 'Enable Maps JavaScript API in Google Cloud Console.'}
            </li>
            <li>
              {isBn
                ? 'AI Studio সেটিংস অথবা .env ফাইলে VITE_GOOGLE_MAPS_API_KEY মানটি যুক্ত করুন।'
                : 'Add VITE_GOOGLE_MAPS_API_KEY to your environment or .env file.'}
            </li>
            <li>
              {isBn
                ? 'ততক্ষণ পর্যন্ত ওপরের OpenStreetMap (Leaflet) মোড সম্পূর্ণ সক্রিয় ও ব্যবহারযোগ্য থাকবে।'
                : 'Meanwhile, the OpenStreetMap (Leaflet) mode remains fully active and functional.'}
            </li>
          </ol>
        </div>

        {/* Fallback assurance message */}
        <div className="mt-4 text-[11px] text-emerald-800 font-semibold flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>
            {isBn
              ? 'বিদ্যমান ওপেনস্ট্রিট ম্যাপ ও জিপিএস জরিপ সম্পূর্ণ সচল রয়েছে'
              : 'Existing OpenStreetMap and GPS Survey remain 100% functional'}
          </span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE: API Key Present — Interactive Google Maps, Search & Survey Overlay
  // ---------------------------------------------------------------------------
  return (
    <div id="google-maps-parcel-boundary-wrapper" className="space-y-3">
      {/* Search Bar & Location Controls Header */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        {/* Search Input Box */}
        <form
          onSubmit={handleExecuteSearch}
          className="relative flex-1 flex items-center rounded-xl bg-white border border-slate-200 shadow-2xs focus-within:ring-2 focus-within:ring-emerald-500 overflow-hidden"
        >
          <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isBn
                ? 'লোকেশন বা স্থান অনুসন্ধান করুন (যেমন: মিরপুর, ঢাকা)...'
                : 'Search location or place...'
            }
            className="w-full py-2 px-2.5 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1.5 text-slate-400 hover:text-slate-600 mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="h-full px-3 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-semibold flex items-center gap-1 transition"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{isBn ? 'খুঁজুন' : 'Search'}</span>}
          </button>
        </form>

        {/* Action Controls: "আমার অবস্থান" Button & Layer Controls Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleGetDeviceLocation}
            disabled={isLocatingDevice}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-xs shadow-2xs transition disabled:opacity-60"
            title={isBn ? 'ডিভাইসের আসল অবস্থান জানুন' : 'Get Real Device Location'}
          >
            {isLocatingDevice ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            <span>{isBn ? 'আমার অবস্থান' : 'My Location'}</span>
          </button>

          {/* Layer Controls Dropdown Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLayersMenu((prev) => !prev)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isBn ? 'লেয়ার' : 'Layers'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Layer Controls Dropdown Menu */}
            {showLayersMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl bg-white border border-slate-200 p-2.5 shadow-lg space-y-2 text-xs animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-bold text-slate-800">{isBn ? 'ম্যাপের লেয়ারসমূহ' : 'Map Layers'}</span>
                  <button
                    type="button"
                    onClick={() => setShowLayersMenu(false)}
                    className="p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      {isBn ? 'ম্যানুয়াল সীমানা' : 'Manual Boundary'}
                    </span>
                    <input
                      type="checkbox"
                      checked={layers.manualBoundary}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, manualBoundary: e.target.checked }))
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      {isBn ? 'জিপিএস জরিপ সীমানা' : 'GPS Survey Boundary'}
                    </span>
                    <input
                      type="checkbox"
                      checked={layers.gpsBoundary}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, gpsBoundary: e.target.checked }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <span className="flex items-center gap-2 text-slate-700">
                      <Target className="w-3.5 h-3.5 text-blue-600" />
                      {isBn ? 'জরিপ পয়েন্টসমূহ (A-Z)' : 'Survey Points'}
                    </span>
                    <input
                      type="checkbox"
                      checked={layers.surveyPoints}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, surveyPoints: e.target.checked }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <span className="flex items-center gap-2 text-slate-700">
                      <LocateFixed className="w-3.5 h-3.5 text-sky-500" />
                      {isBn ? 'আমার অবস্থান মার্কার' : 'Current Location'}
                    </span>
                    <input
                      type="checkbox"
                      checked={layers.currentLocation}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, currentLocation: e.target.checked }))
                      }
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Unavailable State Notification */}
      {searchUnavailableError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{searchUnavailableError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSearchUnavailableError(null)}
            className="text-amber-700 hover:text-amber-900 text-xs font-bold px-1"
          >
            {isBn ? 'বাতিল' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Device Geolocation Error Notification */}
      {deviceLocationError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-900 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{deviceLocationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeviceLocationError(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold px-1"
          >
            {isBn ? 'বাতিল' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Real Geolocation Status Bar */}
      {deviceLocation && (
        <div className="rounded-xl bg-sky-50 border border-sky-200/90 px-3 py-1.5 text-xs text-sky-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />
            <span>{isBn ? 'আসল জিপিএস অবস্থান:' : 'Real GPS Location:'}</span>
            <span className="font-mono text-sky-900">
              {formatCoordinate(deviceLocation.latitude, 'lat')}, {formatCoordinate(deviceLocation.longitude, 'lng')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-sky-700">
            <span>
              {isBn ? 'সঠিকতা (Accuracy):' : 'Accuracy:'}{' '}
              <strong className="font-mono text-sky-950">
                ±{formatNumberByLang(deviceLocation.accuracy.toFixed(1), lang)} {isBn ? 'মি.' : 'm'}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Toast Save Message */}
      {saveSuccessMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Google Maps Canvas Container */}
      <div
        id="google-maps-parcel-container"
        className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm transition-all"
      >
        {/* Top Controls Bar inside Map */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Map Type Toggle: Roadmap vs Hybrid */}
          <div className="pointer-events-auto flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-md text-[11px] font-bold text-white">
            <button
              type="button"
              onClick={() => handleMapTypeChange('hybrid')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                mapTypeId === 'hybrid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {isBn ? 'স্যাটেলাইট' : 'Satellite'}
            </button>
            <button
              type="button"
              onClick={() => handleMapTypeChange('roadmap')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                mapTypeId === 'roadmap'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {isBn ? 'সাধারণ ম্যাপ' : 'Map'}
            </button>
          </div>

          {/* Action Buttons: "সীমানা পয়েন্ট নিন" Drawing Mode & Saved Parcels */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsDrawingMode((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 border ${
                isDrawingMode
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-white animate-pulse'
                  : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200'
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${isDrawingMode ? 'text-white' : 'text-emerald-700'}`} />
              <span>
                {isDrawingMode
                  ? isBn
                    ? 'ম্যাপে ট্যাপ করুন...'
                    : 'Tap on Map...'
                  : isBn
                  ? 'সীমানা পয়েন্ট নিন'
                  : 'Add Boundary Points'}
              </span>
            </button>

            {/* Saved Parcels Drawer Button */}
            <button
              type="button"
              onClick={() => setShowSavedParcelsModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white border border-white/20 shadow-md hover:bg-slate-800 transition text-xs font-semibold"
              title={isBn ? 'সংরক্ষিত পার্সেল' : 'Saved Parcels'}
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{isBn ? 'সংরক্ষিত পার্সেল' : 'Saved'}</span>
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {savedParcels.length}
              </span>
            </button>
          </div>
        </div>

        {/* Drawing Mode Active Status Notice Banner */}
        {isDrawingMode && (
          <div className="absolute top-14 left-3 right-3 z-10 pointer-events-none flex justify-center">
            <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-400/80 text-emerald-100 px-3.5 py-1.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>
                {isBn
                  ? 'সীমানা পয়েন্ট চিহ্নিতকরণ সক্রিয়: ম্যাপের কোণায় ট্যাপ করে পয়েন্ট (A, B, C...) নিন'
                  : 'Boundary point mode active: Tap corners on the map to add points (A, B, C...)'}
              </span>
            </div>
          </div>
        )}

        {/* Selected GPS Survey Point Info Card Popover */}
        {selectedSurveyPoint && (
          <div className="absolute top-14 right-3 z-20 w-64 rounded-xl bg-white/95 backdrop-blur-md border border-blue-200 p-3 shadow-xl text-slate-800 text-xs pointer-events-auto animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-blue-100 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px]">
                  {selectedSurveyPoint.label}
                </span>
                <span className="font-bold text-slate-900">
                  {isBn ? `জরিপ পয়েন্ট ${selectedSurveyPoint.label}` : `Survey Point ${selectedSurveyPoint.label}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSurveyPoint(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>{isBn ? 'অক্ষাংশ (Lat):' : 'Latitude:'}</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {formatCoordinate(selectedSurveyPoint.latitude, 'lat')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isBn ? 'দ্রাঘিমাংশ (Lng):' : 'Longitude:'}</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {formatCoordinate(selectedSurveyPoint.longitude, 'lng')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isBn ? 'সঠিকতা (Accuracy):' : 'Accuracy:'}</span>
                <span className="font-mono text-blue-700 font-bold">
                  ±{formatNumberByLang(selectedSurveyPoint.accuracy.toFixed(1), lang)} {isBn ? 'মি.' : 'm'}
                </span>
              </div>
              {selectedSurveyPoint.timeStr && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {isBn ? 'সময়:' : 'Time:'}
                  </span>
                  <span>{selectedSurveyPoint.timeStr}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {mapStatus === 'loading' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm text-white">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
            <span className="text-xs font-bold tracking-wide">
              {isBn ? 'গুগল ম্যাপস লোড হচ্ছে...' : 'Loading Google Maps...'}
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {mapStatus === 'error' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center text-white">
            <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
            <h4 className="text-sm font-bold text-white mb-1">
              {isBn ? 'গুগল ম্যাপস লোড হতে ব্যর্থ হয়েছে' : 'Google Maps failed to load'}
            </h4>
            <p className="text-xs text-slate-300 max-w-sm mb-3">{loadError}</p>
            <span className="text-[11px] text-amber-200">
              {isBn ? 'Google Maps চালু করতে API Key কনফিগার করতে হবে।' : 'Please check your API key configuration.'}
            </span>
          </div>
        )}

        {/* Actual Google Maps DOM Container */}
        <div
          ref={mapContainerRef}
          id="google-maps-canvas"
          className={`w-full min-h-[380px] h-[450px] sm:h-[530px] bg-slate-800 ${
            isDrawingMode ? 'cursor-crosshair' : 'cursor-grab'
          }`}
        />

        {/* Floating Map Action Controls (Bottom-Right) */}
        <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5 pointer-events-auto">
          {/* Fit Bounds Controls */}
          <button
            type="button"
            onClick={handleFitAll}
            title={isBn ? 'সবগুলো সীমানা ও অবস্থান ম্যাপে দেখুন' : 'Fit all boundaries to map'}
            className="p-2.5 rounded-xl bg-white/95 text-slate-800 shadow-md hover:bg-white hover:text-emerald-950 transition active:scale-95 border border-slate-200"
          >
            <Maximize2 className="w-4 h-4 text-emerald-800" />
          </button>

          <button
            type="button"
            onClick={handleGetDeviceLocation}
            title={isBn ? 'আমার আসল অবস্থান' : 'My Location'}
            className="p-2.5 rounded-xl bg-white/95 text-slate-800 shadow-md hover:bg-white hover:text-sky-700 transition active:scale-95 border border-slate-200"
          >
            <Crosshair className="w-4 h-4 text-sky-700" />
          </button>

          {/* Zoom Buttons */}
          <div className="flex flex-col rounded-xl bg-white/95 shadow-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => handleZoom(1)}
              title={isBn ? 'জুম ইন' : 'Zoom In'}
              className="p-2 text-slate-800 hover:bg-slate-100 transition border-b border-slate-200 font-bold text-sm"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-1)}
              title={isBn ? 'জুম আউট' : 'Zoom Out'}
              className="p-2 text-slate-800 hover:bg-slate-100 transition font-bold text-sm"
            >
              -
            </button>
          </div>
        </div>
      </div>

      {/* Boundary Tools Bar: Fit Buttons, Layer Stats, & Drawing Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        {/* Layer Indicators and Fit Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Fit GPS Survey Boundary Button */}
          {surveyGpsPoints.length > 0 && (
            <button
              type="button"
              onClick={handleFitGpsBoundary}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200 transition"
              title={isBn ? 'জিপিএস সীমানা ম্যাপে দেখুন' : 'Fit GPS boundary'}
            >
              <Target className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {isBn
                  ? `জিপিএস সীমানা (${formatNumberByLang(surveyGpsPoints.length, lang)} পয়েন্ট)`
                  : `Fit GPS (${surveyGpsPoints.length})`}
              </span>
            </button>
          )}

          {/* Fit Manual Boundary Button */}
          {boundaryPoints.length > 0 && (
            <button
              type="button"
              onClick={handleFitManualBoundary}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition"
              title={isBn ? 'ম্যানুয়াল সীমানা ম্যাপে দেখুন' : 'Fit manual boundary'}
            >
              <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {isBn
                  ? `ম্যানুয়াল সীমানা (${formatNumberByLang(boundaryPoints.length, lang)} পয়েন্ট)`
                  : `Fit Manual (${boundaryPoints.length})`}
              </span>
            </button>
          )}

          {/* Fit All Button */}
          {(surveyGpsPoints.length > 0 || boundaryPoints.length > 0) && (
            <button
              type="button"
              onClick={handleFitAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <span>{isBn ? 'সবগুলো দেখুন' : 'Fit All'}</span>
            </button>
          )}
        </div>

        {/* Manual Point Management Actions: Undo, Clear, Save */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {boundaryPoints.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleUndoLastPoint}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                title={isBn ? 'শেষ পয়েন্ট বাদ দিন' : 'Undo last point'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isBn ? 'আগের অবস্থা' : 'Undo'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition"
                title={isBn ? 'সব ম্যানুয়াল পয়েন্ট মুছুন' : 'Clear all manual points'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'সব মুছুন' : 'Clear'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPointsTable((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <span>{isBn ? 'পয়েন্ট তালিকা' : 'Points'}</span>
                {showPointsTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          {boundaryPoints.length >= 3 && (
            <button
              type="button"
              onClick={handleOpenSaveModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isBn ? 'পার্সেল সংরক্ষণ' : 'Save Parcel'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear Confirmation Prompt */}
      {showClearConfirm && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {isBn
                ? 'আপনি কি সব চিহ্নিত ম্যানুয়াল সীমানা পয়েন্ট মুছে ফেলতে চান?'
                : 'Are you sure you want to delete all manual boundary points?'}
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 rounded-lg bg-white text-slate-700 font-semibold border border-slate-200 hover:bg-slate-50"
            >
              {isBn ? 'না' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleClearAllPoints}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700"
            >
              {isBn ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Expandable Manual Points Table */}
      {showPointsTable && boundaryPoints.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-800">
              {isBn ? 'চিহ্নিত সীমানা পয়েন্টসমূহ (A-Z)' : 'Boundary Points Table (A-Z)'}
            </span>
            <span className="text-[11px] text-slate-500">
              {isBn ? 'মুছলে পয়েন্ট লেবেল স্বয়ংক্রিয়ভাবে সাজবে' : 'Points relabel automatically'}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
            {boundaryPoints.map((pt) => (
              <div
                key={pt.id}
                className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs shrink-0">
                    {pt.label}
                  </span>
                  <div className="truncate">
                    <span className="font-mono text-slate-700 text-[11px]">
                      {formatCoordinate(pt.lat, 'lat')}, {formatCoordinate(pt.lng, 'lng')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.panTo({ lat: pt.lat, lng: pt.lng });
                        mapInstanceRef.current.setZoom(19);
                      }
                    }}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    title={isBn ? 'ম্যাপে দেখুন' : 'View on map'}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePoint(pt.id)}
                    className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    title={isBn ? 'এই পয়েন্টটি মুছুন' : 'Delete this point'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Measurement Results Display (Sq Ft, Decimal, Katha, Bigha, Acre, Perimeter) */}
      {manualCalculationResult && (
        <div
          id="google-maps-measurement-card"
          className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 p-4 shadow-sm space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                  {isBn ? 'ম্যানুয়াল দাগ সীমানা পরিমাপ' : 'Manual Boundary Measurement'}
                </h4>
                <span className="text-[10px] text-emerald-700">
                  {boundaryPoints.length >= 3
                    ? isBn
                      ? 'স্থানীয় প্রজেকশন দ্বারা ক্ষেত্রফল নির্ণীত'
                      : 'Calculated using local geodesic projection'
                    : isBn
                    ? '২টি পয়েন্টের দূরত্ব নির্ণীত'
                    : '2-point linear distance'}
                </span>
              </div>
            </div>

            {/* Perimeter Pill */}
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                {isBn ? 'মোট পরিসীমা' : 'Perimeter'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-900 font-mono">
                {formatNumberByLang(manualCalculationResult.perimeterFt.toFixed(1), lang)}{' '}
                <span className="text-[11px] font-normal text-slate-600">{isBn ? 'ফুট' : 'ft'}</span>{' '}
                <span className="text-[10px] text-slate-400">
                  ({formatNumberByLang(manualCalculationResult.perimeterMeters.toFixed(1), lang)} {isBn ? 'মি.' : 'm'})
                </span>
              </span>
            </div>
          </div>

          {/* Area Units Grid */}
          {boundaryPoints.length >= 3 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-emerald-800 block">
                  {isBn ? 'শতাংশ / শতক' : 'Decimal'}
                </span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-950 font-mono block mt-0.5">
                  {formatNumberByLang(manualCalculationResult.landUnits.shatangsha.toFixed(3), lang)}
                </span>
                <span className="text-[9px] text-slate-500">
                  1 {isBn ? 'শতক' : 'dec'} = 435.6 {isBn ? 'বর্গফুট' : 'sqft'}
                </span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-slate-700 block">
                  {isBn ? 'বর্গফুট' : 'Square Feet'}
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono block mt-0.5">
                  {formatNumberByLang(manualCalculationResult.areaSqFt.toFixed(1), lang)}
                </span>
                <span className="text-[9px] text-slate-500">
                  {formatNumberByLang(manualCalculationResult.areaSqMeters.toFixed(1), lang)} {isBn ? 'বর্গমিটার' : 'sqm'}
                </span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-slate-700 block">
                  {isBn ? 'কাঠা' : 'Katha'}
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono block mt-0.5">
                  {formatNumberByLang(manualCalculationResult.landUnits.katha.toFixed(3), lang)}
                </span>
                <span className="text-[9px] text-slate-500">
                  1 {isBn ? 'কাঠা' : 'katha'} = 720 {isBn ? 'বর্গফুট' : 'sqft'}
                </span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs text-center">
                <span className="text-[10px] font-bold text-slate-700 block">
                  {isBn ? 'বিঘা' : 'Bigha'}
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono block mt-0.5">
                  {formatNumberByLang(manualCalculationResult.landUnits.bigha.toFixed(3), lang)}
                </span>
                <span className="text-[9px] text-slate-500">
                  1 {isBn ? 'বিঘা' : 'bigha'} = 20 {isBn ? 'কাঠা' : 'katha'}
                </span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-slate-700 block">
                  {isBn ? 'একর' : 'Acre'}
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono block mt-0.5">
                  {formatNumberByLang(manualCalculationResult.landUnits.acre.toFixed(4), lang)}
                </span>
                <span className="text-[9px] text-slate-500">
                  1 {isBn ? 'একর' : 'acre'} = 100 {isBn ? 'শতক' : 'dec'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GPS Survey Overlay Metrics Card (when active survey points exist) */}
      {gpsSurveyCalculationResult && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white shadow-2xs">
                <Target className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-blue-950">
                  {isBn ? 'জিপিএস জরিপ সীমানা পরিমাপ (GPS Survey Layer)' : 'GPS Survey Boundary Measurement'}
                </h4>
                <span className="text-[10px] text-blue-700">
                  {isBn
                    ? `চলমান জিপিএস জরিপের ${formatNumberByLang(surveyGpsPoints.length, lang)}টি পয়েন্ট থেকে নির্ণীত`
                    : `Calculated from ${surveyGpsPoints.length} real GPS survey points`}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                {isBn ? 'জরিপ পরিসীমা' : 'Survey Perimeter'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-blue-900 font-mono">
                {formatNumberByLang(gpsSurveyCalculationResult.perimeterFt.toFixed(1), lang)}{' '}
                <span className="text-[11px] font-normal text-slate-600">{isBn ? 'ফুট' : 'ft'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="rounded-xl bg-white p-2 border border-blue-100 shadow-2xs text-center">
              <span className="text-[10px] font-bold text-blue-800 block">{isBn ? 'শতাংশ' : 'Decimal'}</span>
              <span className="text-base font-extrabold text-blue-950 font-mono block mt-0.5">
                {formatNumberByLang(gpsSurveyCalculationResult.landUnits.shatangsha.toFixed(3), lang)}
              </span>
            </div>
            <div className="rounded-xl bg-white p-2 border border-blue-100 shadow-2xs text-center">
              <span className="text-[10px] font-bold text-slate-700 block">{isBn ? 'বর্গফুট' : 'Sq Ft'}</span>
              <span className="text-base font-extrabold text-slate-900 font-mono block mt-0.5">
                {formatNumberByLang(gpsSurveyCalculationResult.areaSqFt.toFixed(1), lang)}
              </span>
            </div>
            <div className="rounded-xl bg-white p-2 border border-blue-100 shadow-2xs text-center">
              <span className="text-[10px] font-bold text-slate-700 block">{isBn ? 'কাঠা' : 'Katha'}</span>
              <span className="text-base font-extrabold text-slate-900 font-mono block mt-0.5">
                {formatNumberByLang(gpsSurveyCalculationResult.landUnits.katha.toFixed(3), lang)}
              </span>
            </div>
            <div className="rounded-xl bg-white p-2 border border-blue-100 shadow-2xs text-center">
              <span className="text-[10px] font-bold text-slate-700 block">{isBn ? 'বিঘা' : 'Bigha'}</span>
              <span className="text-base font-extrabold text-slate-900 font-mono block mt-0.5">
                {formatNumberByLang(gpsSurveyCalculationResult.landUnits.bigha.toFixed(3), lang)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Legal Notice (Requirement 8) */}
      <div className="rounded-2xl bg-amber-50/90 border border-amber-200 p-3.5 text-amber-950 text-xs leading-relaxed flex items-start gap-2.5 shadow-2xs">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-amber-900 text-xs sm:text-sm">
            {isBn ? 'আইনি সতর্কীকরণ ও তথ্য সংক্রান্ত বিজ্ঞপ্তি:' : 'Legal Notice & Information:'}
          </span>
          <p className="mt-1 text-slate-700 font-medium">
            {isBn
              ? 'GPS ও Google Maps ভিত্তিক এই তথ্য ডিজিটাল/আনুমানিক। এটি আইনগত সীমানা নির্ধারণ বা সরকারি রেকর্ডের বিকল্প নয়।'
              : 'This information based on GPS and Google Maps is digital and approximate. It is not a substitute for legal boundary determination or official government records.'}
          </p>
        </div>
      </div>

      {/* SAVE PARCEL MODAL */}
      {showSaveModal && manualCalculationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {isBn ? 'পার্সেল সীমানা সংরক্ষণ করুন' : 'Save Parcel Boundary'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Summary Badge */}
            <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-950 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-emerald-700 block font-bold uppercase">
                  {isBn ? 'পরিমাপকৃত ক্ষেত্রফল' : 'Measured Area'}
                </span>
                <span className="font-mono font-extrabold text-sm">
                  {formatNumberByLang(manualCalculationResult.landUnits.shatangsha.toFixed(3), lang)}{' '}
                  {isBn ? 'শতাংশ' : 'Dec'} (
                  {formatNumberByLang(manualCalculationResult.areaSqFt.toFixed(0), lang)}{' '}
                  {isBn ? 'বর্গফুট' : 'sqft'})
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-700 block font-bold uppercase">
                  {isBn ? 'পয়েন্ট সংখ্যা' : 'Points'}
                </span>
                <span className="font-mono font-bold">
                  {formatNumberByLang(boundaryPoints.length, lang)} {isBn ? 'টি' : 'pts'}
                </span>
              </div>
            </div>

            {/* Parcel Details Form */}
            <form onSubmit={handleConfirmSaveParcel} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'পার্সেল / সীমানার নাম *' : 'Parcel Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={saveForm.title}
                  onChange={(e) => setSaveForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={isBn ? 'যেমন: দাগ ১২৪৫ - পারিবারিক জমি' : 'e.g., Dag 1245'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'জেলা (District)' : 'District'}
                  </label>
                  <input
                    type="text"
                    value={saveForm.district}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, district: e.target.value }))}
                    placeholder={isBn ? 'যেমন: ঢাকা' : 'e.g., Dhaka'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'উপজেলা (Upazila)' : 'Upazila'}
                  </label>
                  <input
                    type="text"
                    value={saveForm.upazila}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, upazila: e.target.value }))}
                    placeholder={isBn ? 'যেমন: সাভার' : 'e.g., Savar'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'ইউনিয়ন (Union)' : 'Union'}
                  </label>
                  <input
                    type="text"
                    value={saveForm.union}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, union: e.target.value }))}
                    placeholder={isBn ? 'যেমন: বিরুলিয়া' : 'e.g., Birulia'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'মৌজা (Mouza)' : 'Mouza'}
                  </label>
                  <input
                    type="text"
                    value={saveForm.mouza}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, mouza: e.target.value }))}
                    placeholder={isBn ? 'যেমন: বিরুলিয়া' : 'e.g., Birulia'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'জে.এল নং' : 'JL No'}
                  </label>
                  <input
                    type="text"
                    value={saveForm.jlNo}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, jlNo: e.target.value }))}
                    placeholder="12"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'দাগ নং' : 'Dag No'}
                  </label>
                  <input
                    type="text"
                    value={saveForm.dagNo}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, dagNo: e.target.value }))}
                    placeholder="1245"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'খতিয়ান নং' : 'Khatian'}
                  </label>
                  <input
                    type="text"
                    value={saveForm.khatianNo}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, khatianNo: e.target.value }))}
                    placeholder="342"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'মন্তব্য বা অতিরিক্ত তথ্য' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={saveForm.notes}
                  onChange={(e) => setSaveForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={isBn ? 'যেমন: উত্তর সীমানায় রাস্তা আছে...' : 'Any remarks...'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition"
                >
                  {isBn ? 'সংরক্ষণ করুন' : 'Confirm Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAVED PARCELS DRAWER / MODAL */}
      {showSavedParcelsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {isBn ? 'সংরক্ষিত পার্সেলসমূহ' : 'Saved Parcels'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedParcelsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {savedParcels.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <FolderOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p>{isBn ? 'কোনো পার্সেল সংরক্ষিত নেই।' : 'No saved parcels found.'}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {isBn
                    ? 'ম্যাপে কমপক্ষে ৩টি সীমানা পয়েন্ট নিয়ে "পার্সেল সংরক্ষণ" বাটনে চাপুন।'
                    : 'Add 3+ points on the map and click "Save Parcel".'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
                {savedParcels.map((parcel) => (
                  <div
                    key={parcel.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900">{parcel.title}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 mt-0.5">
                          {parcel.dagNo && <span>দাগ: <strong>{parcel.dagNo}</strong></span>}
                          {parcel.khatianNo && <span>খতিয়ান: <strong>{parcel.khatianNo}</strong></span>}
                          {parcel.mouza && <span>মৌজা: {parcel.mouza}</span>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold font-mono text-emerald-800 text-xs sm:text-sm block">
                          {formatNumberByLang(parcel.shatangsha.toFixed(3), lang)} {isBn ? 'শতক' : 'Dec'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatNumberByLang(parcel.areaSqFt.toFixed(0), lang)} {isBn ? 'বর্গফুট' : 'sqft'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                      <span className="text-[10px] text-slate-400">
                        {new Date(parcel.createdAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedParcel(parcel)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition"
                        >
                          {isBn ? 'ম্যাপে লোড করুন' : 'Load on Map'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedParcel(parcel.id)}
                          className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          title={isBn ? 'মুছুন' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
