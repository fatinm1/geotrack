'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { MapLibreGlobe } from './MapLibreGlobe';
import { useAircraftWebSocket } from '@/lib/useAircraftWebSocket';
import { API_URL } from '@/lib/config';

interface CameraItem {
  camera_id: string;
  name: string;
  lon: number;
  lat: number;
  stream_url: string;
  region?: string | null;
  vehicle_count?: number | null;
  congestion_score?: number | null;
}

type VisualMode = 'normal' | 'crt' | 'nvg' | 'flir';

const LOCATIONS = [
  { name: 'Baltimore', lat: 39.28, lng: -76.61, altitude: 2 },
  { name: 'Washington DC', lat: 38.9, lng: -77.04, altitude: 2 },
  { name: 'Annapolis', lat: 38.98, lng: -76.49, altitude: 2 },
  { name: 'Maryland', lat: 39.3, lng: -76.6, altitude: 2.5 },
];

// 3D building footprints (GeoJSON Polygon: [lng, lat]) - Maryland street-level blocks
const BUILDING_POLYGONS = [
  // Baltimore Inner Harbor
  { name: 'Baltimore Block 1', geometry: { type: 'Polygon' as const, coordinates: [[[-76.615, 39.278], [-76.608, 39.278], [-76.608, 39.283], [-76.615, 39.283], [-76.615, 39.278]]] }, altitude: 0.025, color: '#1e3a5f' },
  { name: 'Baltimore Block 2', geometry: { type: 'Polygon' as const, coordinates: [[[-76.608, 39.278], [-76.601, 39.278], [-76.601, 39.283], [-76.608, 39.283], [-76.608, 39.278]]] }, altitude: 0.02, color: '#2d4a6f' },
  { name: 'Baltimore Block 3', geometry: { type: 'Polygon' as const, coordinates: [[[-76.615, 39.283], [-76.608, 39.283], [-76.608, 39.288], [-76.615, 39.288], [-76.615, 39.283]]] }, altitude: 0.03, color: '#1e3a5f' },
  // Washington DC
  { name: 'DC Block 1', geometry: { type: 'Polygon' as const, coordinates: [[[-77.045, 38.895], [-77.038, 38.895], [-77.038, 38.902], [-77.045, 38.902], [-77.045, 38.895]]] }, altitude: 0.04, color: '#1e3a5f' },
  { name: 'DC Block 2', geometry: { type: 'Polygon' as const, coordinates: [[[-77.038, 38.895], [-77.031, 38.895], [-77.031, 38.902], [-77.038, 38.902], [-77.038, 38.895]]] }, altitude: 0.035, color: '#2d4a6f' },
  { name: 'DC Block 3', geometry: { type: 'Polygon' as const, coordinates: [[[-77.045, 38.902], [-77.038, 38.902], [-77.038, 38.909], [-77.045, 38.909], [-77.045, 38.902]]] }, altitude: 0.02, color: '#1e3a5f' },
  // Annapolis
  { name: 'Annapolis Block 1', geometry: { type: 'Polygon' as const, coordinates: [[[-76.495, 38.975], [-76.488, 38.975], [-76.488, 38.982], [-76.495, 38.982], [-76.495, 38.975]]] }, altitude: 0.018, color: '#2d4a6f' },
  { name: 'Annapolis Block 2', geometry: { type: 'Polygon' as const, coordinates: [[[-76.488, 38.975], [-76.481, 38.975], [-76.481, 38.982], [-76.488, 38.982], [-76.488, 38.975]]] }, altitude: 0.022, color: '#1e3a5f' },
];

export default function Home() {
  const globeRef = useRef<import('./MapLibreGlobe').MapLibreGlobeRef>(null!);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraItem | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<{
    icao24: string;
    callsign?: string | null;
    altitude?: number | null;
    velocity?: number | null;
    heading?: number | null;
    ts: number;
  } | null>(null);
  const [showAircraft, setShowAircraft] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [visualMode, setVisualMode] = useState<VisualMode>('normal');
  const [bloom, setBloom] = useState(100);
  const [sharpen, setSharpen] = useState(56);
  const [pixelation, setPixelation] = useState(0);
  const [distortion, setDistortion] = useState(0);
  const [instability, setInstability] = useState(0);
  const { aircraft, connected } = useAircraftWebSocket();

  useEffect(() => {
    fetch(`${API_URL}/api/cameras`)
      .then((r) => r.json())
      .then((d) => setCameras(d.items || []))
      .catch(() => setCameras([]));
  }, []);

  type PointData = { lat: number; lng: number; type: 'aircraft' | 'camera'; aircraft?: (typeof aircraft)[0]; camera?: CameraItem };
  const pointsData = (() => {
    const pts: PointData[] = [];
    if (showAircraft) {
      aircraft.forEach((a) => pts.push({ lat: a.lat, lng: a.lon, type: 'aircraft', aircraft: a }));
    }
    if (showCameras) {
      cameras.forEach((c) => pts.push({ lat: c.lat, lng: c.lon, type: 'camera', camera: c }));
    }
    return pts;
  })();

  const flyTo = useCallback((lat: number, lng: number, altitude: number) => {
    globeRef.current?.pointOfView({ lat, lng, altitude }, 1000);
  }, []);

  const handlePointClick = useCallback((point: { lat: number; lng: number; type?: string; aircraft?: unknown; camera?: unknown }) => {
    const p = point as PointData;
    if (p.type === 'aircraft' && p.aircraft) {
      setSelectedAircraft({
        icao24: p.aircraft.icao24,
        callsign: p.aircraft.callsign,
        altitude: p.aircraft.altitude,
        velocity: p.aircraft.velocity,
        heading: p.aircraft.heading,
        ts: p.aircraft.ts,
      });
      setSelectedCamera(null);
    } else if (p.type === 'camera' && p.camera) {
      setSelectedCamera(p.camera);
      setSelectedAircraft(null);
    }
  }, []);

  const visCount = showAircraft ? aircraft.length : 0;
  const srcCount = showCameras ? cameras.length : 0;

  return (
    <div className="flex h-screen flex-col bg-[#050810] text-slate-300">
      <header className="flex items-center justify-between border-b border-cyan-500/20 bg-black/60 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-light tracking-widest text-cyan-400">GEOTRACK</h1>
            <p className="text-[10px] text-slate-500 tracking-widest">ADS-B • MD CHART • REAL-TIME</p>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            VIS:{visCount} SRC:{srcCount} DENS:{(visCount + srcCount) / 1000}
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span className={connected ? 'text-emerald-400' : 'text-red-400'}>{connected ? 'ACTIVE' : 'OFFLINE'}</span>
          <span className="text-slate-500" suppressHydrationWarning>REC {new Date().toISOString().slice(0, 19).replace('T', ' ')}Z</span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className="w-56 flex-shrink-0 border-r border-white/5 bg-black/40 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">DATA LAYERS</p>
          <div className="space-y-2">
            <div className="rounded border border-white/5 bg-white/5 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs">Live Flights</span>
                <button
                  onClick={() => setShowAircraft(!showAircraft)}
                  className={`rounded px-2 py-0.5 text-[10px] font-mono ${showAircraft ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/5 text-slate-500'}`}
                >{showAircraft ? 'ON' : 'OFF'}</button>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{aircraft.length} • OpenSky • {connected ? 'live' : '—'}</p>
            </div>
            <div className="rounded border border-white/5 bg-white/5 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs">CCTV Mesh</span>
                <button
                  onClick={() => setShowCameras(!showCameras)}
                  className={`rounded px-2 py-0.5 text-[10px] font-mono ${showCameras ? 'bg-cyan-500/30 text-cyan-400' : 'bg-white/5 text-slate-500'}`}
                >{showCameras ? 'ON' : 'OFF'}</button>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{cameras.length} • MD CHART</p>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
          <div
            className={`map-viewport relative ${visualMode}`}
            style={
              visualMode === 'nvg'
                ? { filter: 'hue-rotate(85deg) saturate(2.5) brightness(0.85) contrast(1.3)' }
                : visualMode === 'flir'
                ? { filter: 'grayscale(1) invert(1) contrast(1.4) brightness(0.95)' }
                : visualMode === 'crt'
                ? {
                    ...(pixelation > 50 && { imageRendering: 'pixelated' as const }),
                    ...(distortion > 0 && { filter: `contrast(${1 + distortion / 80}) brightness(${1 - distortion / 300})` }),
                    ['--scan-opacity']: 0.12 + (instability / 100) * 0.2,
                  } as React.CSSProperties
                : undefined
            }
          >
            <div className="absolute inset-0">
              <MapLibreGlobe
                ref={globeRef}
                pointsData={pointsData}
                polygonsData={BUILDING_POLYGONS}
                onPointClick={handlePointClick}
                onReady={() => globeRef.current?.pointOfView({ lat: 39.0, lng: -76.5, altitude: 2.2 }, 1000)}
                pointColor={(d) => { const p = d as PointData; if (!p || !p.type) return '#06b6d4'; return p.type === 'aircraft' ? (visualMode === 'nvg' ? '#00ff88' : '#06b6d4') : (p.camera && (p.camera.congestion_score ?? 0) > 0.5 ? '#f59e0b' : '#10b981'); }}
                pointRadius={(d) => { const p = d as PointData; return p.type === 'aircraft' ? 0.4 : 0.12; }}
                pointLabel={(d) => { const p = d as PointData; return p.type === 'aircraft' ? `${(p.aircraft as { callsign?: string; icao24?: string })?.callsign || (p.aircraft as { icao24?: string })?.icao24}` : (p.camera as { name?: string })?.name ?? ''; }}
                width="100%"
                height="100%"
              />
            </div>
          </div>

          {selectedAircraft && (
            <div className="absolute right-4 top-4 z-20 w-64 rounded border border-cyan-500/30 bg-black/90 p-3 font-mono">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-cyan-400 text-xs">AIRCRAFT</span>
                <button onClick={() => setSelectedAircraft(null)} className="text-slate-500 hover:text-white">×</button>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-500">Callsign</span><span className="text-cyan-400">{selectedAircraft.callsign || selectedAircraft.icao24}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Altitude</span><span>{selectedAircraft.altitude != null ? `${Math.round(selectedAircraft.altitude).toLocaleString()} ft` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Velocity</span><span>{selectedAircraft.velocity != null ? `${Math.round(selectedAircraft.velocity)} kt` : '—'}</span></div>
              </div>
            </div>
          )}
          {selectedCamera && (
            <div className="absolute right-4 top-4 z-20 w-64 rounded border border-cyan-500/30 bg-black/90 p-3 font-mono">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-cyan-400 text-xs">CCTV</span>
                <button onClick={() => setSelectedCamera(null)} className="text-slate-500 hover:text-white">×</button>
              </div>
              <p className="mb-2 text-xs">{selectedCamera.name}</p>
              <a href={selectedCamera.stream_url} target="_blank" rel="noopener noreferrer" className="block w-full rounded bg-cyan-500/30 py-1.5 text-center text-[11px] text-cyan-400 hover:bg-cyan-500/50">OPEN STREAM</a>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] text-slate-500">
            3D GLOBE
          </div>
        </main>

        <aside className="w-56 flex-shrink-0 border-l border-white/5 bg-black/40 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">PARAMETERS</p>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-slate-500">BLOOM</label>
              <input type="range" min="0" max="100" value={bloom} onChange={(e) => setBloom(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500">SHARPEN</label>
              <input type="range" min="0" max="100" value={sharpen} onChange={(e) => setSharpen(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500">PIXELATION</label>
              <input type="range" min="0" max="100" value={pixelation} onChange={(e) => setPixelation(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500">DISTORTION</label>
              <input type="range" min="0" max="100" value={distortion} onChange={(e) => setDistortion(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500">INSTABILITY</label>
              <input type="range" min="0" max="100" value={instability} onChange={(e) => setInstability(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500">HUD</label>
              <select className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs">
                <option>Tactical</option>
              </select>
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex flex-col gap-2 border-t border-white/5 bg-black/60 px-4 py-3">
        <div>
          <p className="mb-1 text-[10px] text-slate-500">LOCATIONS</p>
          <div className="flex gap-2">
            {LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                onClick={() => flyTo(loc.lat, loc.lng, loc.altitude)}
                className="rounded border border-white/10 bg-white/5 px-3 py-1 text-xs hover:border-cyan-500/50 hover:bg-cyan-500/10"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] text-slate-500">VISUAL MODE</p>
          <div className="flex gap-2">
            {(['normal', 'crt', 'nvg', 'flir'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setVisualMode(mode)}
                className={`rounded border px-3 py-1 text-xs uppercase ${visualMode === mode ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
