import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { CurrentGpsPosition, GpsPoint } from '../../lib/gps-types';
import { GpsAreaResult, GpsPolygonSegment, GpsAccuracyStats } from '../../lib/gps-geometry';
import { Language } from '../../types';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import { formatCoordinate } from '../../lib/gps-utils';
import {
  Maximize2,
  Navigation,
  Crosshair,
  Compass,
  Layers,
  MapPin,
  ChevronDown,
  ChevronUp,
  Ruler,
  AlertCircle,
  Eye,
  Info,
} from 'lucide-react';

interface GpsLiveMapProps {
  currentPos: CurrentGpsPosition | null;
  points: GpsPoint[];
  segments: GpsPolygonSegment[];
  areaResult: GpsAreaResult | null;
  accuracyStats: GpsAccuracyStats | null;
  isWatching: boolean;
  lang: Language;
  onStartGps?: () => void;
}

export const GpsLiveMap: React.FC<GpsLiveMapProps> = ({
  currentPos,
  points,
  segments,
  areaResult,
  accuracyStats,
  isWatching,
  lang,
  onStartGps,
}) => {
  const isBn = lang === 'bn';

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups for dynamic synchronization
  const baseLayersRef = useRef<{
    currentLocationMarker?: L.Marker;
    accuracyCircle?: L.Circle;
    surveyPointMarkers: L.Marker[];
    polylineLayer?: L.Polyline;
    polygonLayer?: L.Polygon;
    segmentLabels: L.Marker[];
  }>({
    surveyPointMarkers: [],
    segmentLabels: [],
  });

  // UI state
  const [showSummaryOverlay, setShowSummaryOverlay] = useState<boolean>(true);
  const [activeTileType, setActiveTileType] = useState<'osm' | 'topo'>('osm');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Track initial centering so we only auto-pan to current position once on GPS start
  const hasAutoCenteredRef = useRef<boolean>(false);

  // ---------------------------------------------------------------------------
  // 1. Initialize Leaflet Map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    // Default center: Dhaka/Bangladesh center (23.8103, 90.4125) zoom 7 if no coords yet
    const initialLat = currentPos ? currentPos.latitude : 23.8103;
    const initialLng = currentPos ? currentPos.longitude : 90.4125;
    const initialZoom = currentPos ? 17 : 7;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false, // Custom placed zoom controls for mobile ergonomics
      attributionControl: true,
    });

    // Add Tile Layer (OpenStreetMap default)
    const tileUrl =
      activeTileType === 'topo'
        ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution =
      activeTileType === 'topo'
        ? '&copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution,
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Resize observer to keep map sharp and responsive
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch tile layer if tile type changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      activeTileType === 'topo'
        ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution =
      activeTileType === 'topo'
        ? '&copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const newLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution,
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [activeTileType]);

  // ---------------------------------------------------------------------------
  // 2. Sync Current Location Marker & Accuracy Circle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layers = baseLayersRef.current;

    // Remove old location marker and circle
    if (layers.currentLocationMarker) {
      map.removeLayer(layers.currentLocationMarker);
      layers.currentLocationMarker = undefined;
    }
    if (layers.accuracyCircle) {
      map.removeLayer(layers.accuracyCircle);
      layers.accuracyCircle = undefined;
    }

    if (!currentPos) return;

    const { latitude, longitude, accuracy } = currentPos;

    // Accuracy Circle
    if (accuracy && accuracy > 0) {
      const circle = L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#059669', // emerald-600
        weight: 1.5,
        fillColor: '#10b981', // emerald-500
        fillOpacity: 0.12,
        dashArray: '4, 4',
      }).addTo(map);
      layers.accuracyCircle = circle;
    }

    // Custom Current Position Pulse Marker
    const iconHtml = `
      <div class="relative flex items-center justify-center w-8 h-8">
        <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping"></span>
        <span class="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 border-2 border-white shadow-md text-white">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </span>
      </div>
    `;

    const locationIcon = L.divIcon({
      className: 'gps-current-location-marker',
      html: iconHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });

    const marker = L.marker([latitude, longitude], {
      icon: locationIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    const popupContent = `
      <div style="font-family: inherit; min-width: 180px; padding: 4px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: #059669;"></div>
          <strong style="font-size: 12px; color: #064e3b;">
            ${isBn ? 'আপনার বর্তমান অবস্থান' : 'Your Current Position'}
          </strong>
        </div>
        <div style="font-size: 11px; color: #334155; line-height: 1.5;">
          <div><b>Lat:</b> ${formatCoordinate(latitude, 'lat')} (${roundClean(latitude, 6)}°)</div>
          <div><b>Lng:</b> ${formatCoordinate(longitude, 'lng')} (${roundClean(longitude, 6)}°)</div>
          ${
            accuracy
              ? `<div style="margin-top: 4px; color: #047857; font-weight: 600;">
                  ±${roundClean(accuracy, 1)}m ${isBn ? 'নির্ভুলতা' : 'Accuracy'}
                </div>`
              : ''
          }
        </div>
      </div>
    `;
    marker.bindPopup(popupContent);
    layers.currentLocationMarker = marker;

    // Auto-center on first GPS lock if user hasn't collected points yet
    if (!hasAutoCenteredRef.current && points.length === 0) {
      map.setView([latitude, longitude], 17);
      hasAutoCenteredRef.current = true;
    }
  }, [currentPos, isBn]);

  // ---------------------------------------------------------------------------
  // 3. Sync Survey Point Markers, Boundary Polyline, Polygon, and Segment Badges
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layers = baseLayersRef.current;

    // Clear old survey point markers
    layers.surveyPointMarkers.forEach((m) => map.removeLayer(m));
    layers.surveyPointMarkers = [];

    // Clear old segment distance labels
    layers.segmentLabels.forEach((m) => map.removeLayer(m));
    layers.segmentLabels = [];

    // Clear old polyline & polygon
    if (layers.polylineLayer) {
      map.removeLayer(layers.polylineLayer);
      layers.polylineLayer = undefined;
    }
    if (layers.polygonLayer) {
      map.removeLayer(layers.polygonLayer);
      layers.polygonLayer = undefined;
    }

    if (points.length === 0) {
      return;
    }

    const latLngs: [number, number][] = points.map((p) => [p.latitude, p.longitude]);

    // 3A. Render Boundary Polygon (When >= 3 points)
    if (points.length >= 3) {
      const polygon = L.polygon(latLngs, {
        color: '#065f46', // emerald-800
        weight: 3,
        fillColor: '#10b981', // emerald-500
        fillOpacity: 0.22,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);

      if (areaResult && areaResult.isValid) {
        const polyPopup = `
          <div style="font-family: inherit; min-width: 175px; padding: 4px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
              <span style="font-size: 13px;">📐</span>
              <strong style="font-size: 12px; color: #064e3b;">
                ${isBn ? 'জমির সীমানা ও ক্ষেত্রফল' : 'Plot Boundary & Area'}
              </strong>
            </div>
            <div style="font-size: 11px; color: #334155; line-height: 1.5;">
              <div><b>${isBn ? 'শতক' : 'Decimal'}:</b> <strong style="color: #92400e; font-size: 12px;">${roundClean(areaResult.landUnits.shatangsha, 3)}</strong></div>
              <div><b>${isBn ? 'কাঠা' : 'Katha'}:</b> <strong style="color: #0f172a;">${roundClean(areaResult.landUnits.katha, 3)}</strong></div>
              <div><b>${isBn ? 'ক্ষেত্রফল' : 'Area'}:</b> ${roundClean(areaResult.areaSqFt, 1)} sq ft</div>
              <div><b>${isBn ? 'পরিসীমা' : 'Perimeter'}:</b> ${roundClean(areaResult.perimeterFt, 1)} ft</div>
              <div style="margin-top: 3px; color: #059669; font-size: 10px;">
                ${isBn ? '✓ সীমানা সঠিকভাবে আবদ্ধ' : '✓ Boundary properly closed'}
              </div>
            </div>
          </div>
        `;
        polygon.bindPopup(polyPopup);
      }

      layers.polygonLayer = polygon;
    } else if (points.length === 2) {
      // 3B. Render Boundary Polyline (When exactly 2 points: A -> B)
      const polyline = L.polyline(latLngs, {
        color: '#047857',
        weight: 3.5,
        dashArray: '6, 6',
        lineCap: 'round',
      }).addTo(map);

      layers.polylineLayer = polyline;
    }

    // 3C. Render Survey Point Markers (A, B, C...)
    points.forEach((point, idx) => {
      const isStart = idx === 0;
      const isLast = idx === points.length - 1 && points.length >= 3;

      const markerHtml = `
        <div class="relative group cursor-pointer">
          <div class="flex items-center justify-center w-7 h-7 rounded-full font-black text-xs shadow-md border-2 border-white transition-transform active:scale-95 ${
            isStart
              ? 'bg-emerald-800 text-white ring-2 ring-emerald-400'
              : isLast
              ? 'bg-emerald-700 text-white'
              : 'bg-slate-800 text-white'
          }">
            ${point.label}
          </div>
          ${
            isStart
              ? `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white"></div>`
              : ''
          }
        </div>
      `;

      const pointIcon = L.divIcon({
        className: 'gps-survey-point-marker',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      });

      const ptMarker = L.marker([point.latitude, point.longitude], {
        icon: pointIcon,
        zIndexOffset: 500 + idx,
      }).addTo(map);

      const ptPopup = `
        <div style="font-family: inherit; min-width: 170px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="background: ${isStart ? '#065f46' : '#1e293b'}; color: white; border-radius: 6px; padding: 2px 7px; font-weight: 800; font-size: 11px;">
                ${point.label}
              </span>
              <strong style="font-size: 12px; color: #0f172a;">
                ${isBn ? `পয়েন্ট ${point.label}` : `Point ${point.label}`}
              </strong>
            </div>
            ${
              isStart
                ? `<span style="font-size: 10px; background: #ecfdf5; color: #047857; font-weight: 700; padding: 1px 5px; border-radius: 4px; border: 1px solid #a7f3d0;">
                    ${isBn ? 'সূচনা' : 'Start'}
                  </span>`
                : ''
            }
          </div>
          <div style="font-size: 11px; color: #334155; line-height: 1.5;">
            <div><b>Lat:</b> ${formatCoordinate(point.latitude, 'lat')}</div>
            <div><b>Lng:</b> ${formatCoordinate(point.longitude, 'lng')}</div>
            ${
              point.accuracy !== undefined
                ? `<div style="color: #059669; margin-top: 2px;"><b>Accuracy:</b> ±${roundClean(point.accuracy, 1)}m</div>`
                : ''
            }
            ${
              point.timeStr
                ? `<div style="color: #64748b; font-size: 10px; margin-top: 3px;">🕒 ${point.timeStr}</div>`
                : ''
            }
          </div>
        </div>
      `;
      ptMarker.bindPopup(ptPopup);
      layers.surveyPointMarkers.push(ptMarker);
    });

    // 3D. Render Segment Distance & Bearing Labels at Midpoints
    segments.forEach((seg) => {
      const midLat = (seg.from.latitude + seg.to.latitude) / 2;
      const midLng = (seg.from.longitude + seg.to.longitude) / 2;

      const isClosing = seg.isClosing;

      const badgeHtml = `
        <div class="px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-xs whitespace-nowrap border cursor-pointer select-none transition-transform hover:scale-105 ${
          isClosing
            ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
            : 'bg-white/95 text-slate-800 border-slate-300'
        }">
          <span>${roundClean(seg.distanceFeet, 1)} ft</span>
        </div>
      `;

      const badgeIcon = L.divIcon({
        className: 'gps-segment-badge',
        html: badgeHtml,
        iconSize: [60, 20],
        iconAnchor: [30, 10],
      });

      const labelMarker = L.marker([midLat, midLng], {
        icon: badgeIcon,
        zIndexOffset: 300,
      }).addTo(map);

      // Popup with full distance and bearing details (TASK 6 & 7)
      const labelPopup = `
        <div style="font-family: inherit; min-width: 175px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
            <strong style="font-size: 12px; color: #064e3b;">
              ${seg.fromLabel} → ${seg.toLabel}
            </strong>
            ${
              isClosing
                ? `<span style="font-size: 10px; background: #d1fae5; color: #065f46; font-weight: bold; padding: 1px 6px; border-radius: 9999px;">
                    ${isBn ? 'সমাপ্তি' : 'Closure'}
                  </span>`
                : ''
            }
          </div>
          <div style="font-size: 11px; color: #334155; line-height: 1.5;">
            <div><b>${isBn ? 'দূরত্ব' : 'Distance'}:</b> ${roundClean(seg.distanceFeet, 2)} ft (${roundClean(seg.distanceMeters, 2)} m)</div>
            <div style="margin-top: 3px;"><b>${isBn ? 'বেয়ারিং' : 'Bearing'}:</b> ${roundClean(seg.bearingDegrees, 1)}°</div>
            <div><b>${isBn ? 'কম্পাস দিক' : 'Direction'}:</b> <span style="color: #047857; font-weight: bold;">${isBn ? seg.compassDirectionBn : seg.compassDirectionEn}</span></div>
          </div>
        </div>
      `;
      labelMarker.bindPopup(labelPopup);
      layers.segmentLabels.push(labelMarker);
    });
  }, [points, segments, areaResult, isBn]);

  // ---------------------------------------------------------------------------
  // 4. Auto-Fit Bounds when survey points change (TASK 8)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 18);
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 19,
      });
    }
  }, [points.length]);

  // ---------------------------------------------------------------------------
  // Handlers for Map Controls (TASK 9)
  // ---------------------------------------------------------------------------
  const handleCenterMyLocation = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentPos) {
      map.setView([currentPos.latitude, currentPos.longitude], 18, { animate: true });
      if (baseLayersRef.current.currentLocationMarker) {
        baseLayersRef.current.currentLocationMarker.openPopup();
      }
    } else if (onStartGps) {
      onStartGps();
    }
  }, [currentPos, onStartGps]);

  const handleFitBoundary = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 18, { animate: true });
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 19,
        animate: true,
      });
    }
  }, [points]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div
      id="gps-live-map-wrapper"
      className="relative rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100 shadow-xs animate-fadeIn"
    >
      {/* Map Header bar with status badge & tile switcher */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></div>
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-emerald-800" />
            <span>{isBn ? 'লাইভ GPS ম্যাপ ও সীমানা নকশা' : 'Live GPS Map & Boundary'}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Tile Layer Toggle (OSM Standard / Topo) */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-semibold border border-slate-200">
            <button
              onClick={() => setActiveTileType('osm')}
              className={`px-2 py-0.5 rounded transition ${
                activeTileType === 'osm'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              OSM
            </button>
            <button
              onClick={() => setActiveTileType('topo')}
              className={`px-2 py-0.5 rounded transition ${
                activeTileType === 'topo'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Topo
            </button>
          </div>

          {/* Points counter badge */}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 font-bold border border-emerald-200">
            {formatNumberByLang(points.length, lang)} {isBn ? 'পয়েন্ট' : 'pts'}
          </span>
        </div>
      </div>

      {/* Leaflet Map Canvas Container */}
      <div
        ref={mapContainerRef}
        id="leaflet-gps-map"
        className="w-full h-80 sm:h-96 z-0 bg-slate-100"
        style={{ minHeight: '320px' }}
      />

      {/* Empty State Overlay when GPS is not started and no points recorded */}
      {!isWatching && !currentPos && points.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-900/40 backdrop-blur-2xs text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-900/90 text-emerald-300 flex items-center justify-center mb-3 shadow-lg border border-emerald-400/40">
            <Navigation className="w-6 h-6 animate-pulse" />
          </div>
          <h4 className="text-sm font-bold">
            {isBn ? 'GPS ম্যাপ প্রস্তুত' : 'GPS Map Ready'}
          </h4>
          <p className="text-xs text-slate-200 mt-1 max-w-xs leading-relaxed">
            {isBn
              ? 'বাস্তব স্যাটেলাইট অবস্থান দেখতে উপরের "GPS দিয়ে মাপ শুরু করুন" বাটনে চাপ দিন।'
              : 'Tap "Start GPS" above to track your live position on the real map.'}
          </p>
          {onStartGps && (
            <button
              onClick={onStartGps}
              className="mt-3.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <Crosshair className="w-4 h-4" />
              <span>{isBn ? 'GPS চালু করুন' : 'Start GPS'}</span>
            </button>
          )}
        </div>
      )}

      {/* Touch-Friendly Floating Map Controls (TASK 9) */}
      <div className="absolute top-14 right-3 z-10 flex flex-col gap-1.5">
        {/* My Location Button */}
        <button
          onClick={handleCenterMyLocation}
          title={isBn ? 'আমার অবস্থান' : 'My Location'}
          className="w-10 h-10 rounded-xl bg-white/95 text-slate-800 shadow-md border border-slate-200/90 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-800 transition active:scale-90"
        >
          <Crosshair className="w-5 h-5 text-emerald-800" />
        </button>

        {/* Boundary Fit Button (Enabled when points exist) */}
        <button
          onClick={handleFitBoundary}
          disabled={points.length === 0}
          title={isBn ? 'সীমানা ফিট করুন' : 'Fit Boundary'}
          className={`w-10 h-10 rounded-xl shadow-md border flex items-center justify-center transition active:scale-90 ${
            points.length > 0
              ? 'bg-white/95 text-slate-800 border-slate-200/90 hover:bg-emerald-50 hover:text-emerald-800'
              : 'bg-white/60 text-slate-300 border-slate-200 cursor-not-allowed'
          }`}
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Zoom In / Zoom Out */}
        <div className="flex flex-col rounded-xl bg-white/95 shadow-md border border-slate-200/90 overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="w-10 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-black text-base border-b border-slate-200 active:bg-slate-200"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-black text-base active:bg-slate-200"
          >
            −
          </button>
        </div>
      </div>

      {/* Floating Compact Measurement Summary Overlay (TASK 10) */}
      {points.length >= 3 && areaResult && areaResult.isValid && (
        <div className="absolute bottom-3 left-3 right-16 sm:right-auto sm:max-w-xs z-10 animate-scaleUp">
          <div className="p-3 rounded-xl bg-white/95 backdrop-blur-xs border border-emerald-300 shadow-lg text-slate-900">
            {/* Header with Collapsible Toggle */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                <span className="text-[11px] font-bold text-emerald-950">
                  {isBn ? '📐 জমির পরিমাপ' : '📐 Land Measurement'}
                </span>
              </div>
              <button
                onClick={() => setShowSummaryOverlay(!showSummaryOverlay)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
              >
                {showSummaryOverlay ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {showSummaryOverlay && (
              <div className="space-y-1.5 text-[11px]">
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Decimal */}
                  <div className="bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/80">
                    <span className="text-[10px] text-amber-900 font-semibold block">
                      {isBn ? 'শতক / Decimal' : 'Decimal'}
                    </span>
                    <strong className="text-xs text-amber-950">
                      {formatNumberByLang(roundClean(areaResult.landUnits.shatangsha, 3), lang)}
                    </strong>
                  </div>

                  {/* Katha */}
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-600 font-semibold block">
                      {isBn ? 'কাঠা / Katha' : 'Katha'}
                    </span>
                    <strong className="text-xs text-slate-900">
                      {formatNumberByLang(roundClean(areaResult.landUnits.katha, 3), lang)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5 px-0.5">
                  <span>
                    {isBn ? 'ক্ষেত্রফল' : 'Area'}:{' '}
                    <strong className="text-slate-900">
                      {formatNumberByLang(roundClean(areaResult.areaSqFt, 1), lang)} sq ft
                    </strong>
                  </span>
                  <span>
                    {isBn ? 'পরিসীমা' : 'Perimeter'}:{' '}
                    <strong className="text-slate-900">
                      {formatNumberByLang(roundClean(areaResult.perimeterFt, 1), lang)} ft
                    </strong>
                  </span>
                </div>

                {/* Accuracy */}
                {accuracyStats && (
                  <div className="text-[10px] text-emerald-800 font-medium pt-0.5 px-0.5 flex items-center justify-between">
                    <span>{isBn ? 'গড় GPS নির্ভুলতা:' : 'Avg GPS Accuracy:'}</span>
                    <span className="font-mono font-bold">±{formatNumberByLang(accuracyStats.averageAccuracy, lang)}m</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom info strip */}
      <div className="px-3.5 py-1.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-emerald-700" />
          <span>
            {points.length >= 3
              ? isBn
                ? 'সীমানা আবদ্ধ (Closed Polygon) • পয়েন্ট A-তে সংযুক্ত'
                : 'Closed Polygon • Connected to Point A'
              : points.length === 2
              ? isBn
                ? 'সরলরৈখিক বাহু A → B • ৩য় পয়েন্ট যোগ করুন'
                : 'Linear Leg A → B • Add 3rd point'
              : points.length === 1
              ? isBn
                ? 'পয়েন্ট A সংরক্ষিত • পরবর্তী কোণায় যান'
                : 'Point A recorded • Move to next corner'
              : isBn
              ? 'খোলা আকাশের নিচে দাঁড়িয়ে পয়েন্ট নিন'
              : 'Stand in an open area to take points'}
          </span>
        </div>

        {currentPos && currentPos.accuracy !== null && (
          <span className="text-[10px] text-emerald-800 font-mono font-semibold">
            ±{formatNumberByLang(roundClean(currentPos.accuracy, 1), lang)}m
          </span>
        )}
      </div>
    </div>
  );
};
