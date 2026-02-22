'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
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

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
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
  const [search, setSearch] = useState('');
  const { aircraft, connected } = useAircraftWebSocket();

  useEffect(() => {
    fetch(`${API_URL}/api/cameras`)
      .then((r) => r.json())
      .then((d) => setCameras(d.items || []))
      .catch(() => setCameras([]));
  }, []);

  const [mapState, setMapState] = useState({ zoom: 8, lng: -76.6, lat: 39.3 });

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const container = mapContainer.current;
    map.current = new maplibregl.Map({
      container,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-76.6, 39.3],
      zoom: 8,
      attributionControl: false,
    });

    // Add navigation controls (zoom, compass)
    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const onLoad = () => {
      map.current?.resize();
    };
    map.current.on('load', onLoad);

    const onMove = () => {
      const m = map.current;
      if (m) setMapState({ zoom: Math.round(m.getZoom() * 10) / 10, lng: Math.round(m.getCenter().lng * 1000) / 1000, lat: Math.round(m.getCenter().lat * 1000) / 1000 });
    };
    map.current.on('move', onMove);

    return () => {
      map.current?.off('load', onLoad);
      map.current?.off('move', onMove);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const sourceAircraft = m.getSource('aircraft') as maplibregl.GeoJSONSource | undefined;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: showAircraft ? aircraft.map((a) => ({
        type: 'Feature' as const,
        properties: { icao24: a.icao24, callsign: a.callsign, altitude: a.altitude, velocity: a.velocity, heading: a.heading, ts: a.ts },
        geometry: { type: 'Point' as const, coordinates: [a.lon, a.lat] },
      })) : [],
    };

    const addOrUpdate = () => {
      if (sourceAircraft) {
        sourceAircraft.setData(fc);
      } else {
        m.addSource('aircraft', { type: 'geojson', data: fc });
        m.addLayer({
          id: 'aircraft-layer',
          type: 'circle',
          source: 'aircraft',
          paint: {
            'circle-radius': 8,
            'circle-color': '#06b6d4',
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(6, 182, 212, 0.6)',
          },
        });
      }
    };
    if (m.loaded()) addOrUpdate();
    else m.once('load', addOrUpdate);
  }, [aircraft, showAircraft]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const sourceCameras = m.getSource('cameras') as maplibregl.GeoJSONSource | undefined;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: showCameras ? cameras.map((c) => ({
        type: 'Feature' as const,
        properties: { camera_id: c.camera_id, name: c.name, stream_url: c.stream_url, region: c.region, congestion_score: c.congestion_score ?? 0 },
        geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
      })) : [],
    };

    const addOrUpdate = () => {
      if (sourceCameras) {
        sourceCameras.setData(fc);
      } else {
        m.addSource('cameras', { type: 'geojson', data: fc });
        m.addLayer({
          id: 'cameras-layer',
          type: 'circle',
          source: 'cameras',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'congestion_score'], 0, 5, 0.5, 8, 1, 14],
            'circle-color': ['interpolate', ['linear'], ['get', 'congestion_score'], 0, '#10b981', 0.5, '#f59e0b', 1, '#ef4444'],
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(255,255,255,0.3)',
          },
        });
      }
    };
    if (m.loaded()) addOrUpdate();
    else m.once('load', addOrUpdate);
  }, [cameras, showCameras]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const onAircraftClick = (e: maplibregl.MapMouseEvent) => {
      const f = m!.queryRenderedFeatures(e.point, { layers: ['aircraft-layer'] })[0];
      if (f?.properties) {
        setSelectedAircraft({
          icao24: String(f.properties.icao24 ?? ''),
          callsign: f.properties.callsign,
          altitude: f.properties.altitude,
          velocity: f.properties.velocity,
          heading: f.properties.heading,
          ts: Number(f.properties.ts ?? 0),
        });
        setSelectedCamera(null);
      }
    };

    const onCameraClick = (e: maplibregl.MapMouseEvent) => {
      const f = m!.queryRenderedFeatures(e.point, { layers: ['cameras-layer'] })[0];
      if (f?.properties) {
        const c = cameras.find((x) => x.camera_id === f.properties!.camera_id);
        if (c) {
          setSelectedCamera(c);
          setSelectedAircraft(null);
        }
      }
    };

    const handler = (e: maplibregl.MapMouseEvent) => {
      onAircraftClick(e);
      onCameraClick(e);
    };
    m.on('click', handler);

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const features = m!.queryRenderedFeatures(e.point, { layers: ['aircraft-layer', 'cameras-layer'] });
      m!.getCanvas().style.cursor = features.length ? 'pointer' : '';
    };
    m.on('mousemove', onMouseMove);

    return () => {
      m.off('click', handler);
      m.off('mousemove', onMouseMove);
    };
  }, [cameras]);

  const filteredAircraft = search
    ? aircraft.filter(
        (a) =>
          (a.callsign && a.callsign.toLowerCase().includes(search.toLowerCase())) ||
          (a.icao24 && a.icao24.toLowerCase().includes(search.toLowerCase()))
      )
    : aircraft;
  const filteredCameras = search
    ? cameras.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.camera_id.toLowerCase().includes(search.toLowerCase()))
    : cameras;

  return (
    <div className="flex h-screen flex-col bg-[#0a0f1a]">
      {/* Header */}
      <header className="relative flex items-center justify-between border-b border-white/10 bg-[#0f172a]/95 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-glow">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">GeoTrack</h1>
            <p className="text-[11px] font-medium text-slate-400">ADS-B • MD CHART • Real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Callsign / camera..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52 rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
            <button
              onClick={() => setShowAircraft(!showAircraft)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                showAircraft ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${showAircraft ? 'bg-cyan-400' : 'bg-slate-600'}`} />
              Aircraft
            </button>
            <button
              onClick={() => setShowCameras(!showCameras)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                showCameras ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${showCameras ? 'bg-cyan-400' : 'bg-slate-600'}`} />
              Cameras
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-mono text-[11px] text-slate-400">{connected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>
      </header>

      {/* Map area */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={mapContainer} className="absolute inset-0 h-full w-full min-h-[400px] [&_.maplibregl-ctrl-group]:rounded-lg [&_.maplibregl-ctrl-group]:border-white/10 [&_.maplibregl-ctrl-group]:bg-slate-900/90 [&_.maplibregl-ctrl-group_button]:text-slate-300" />
        {/* Detail panels */}
        {selectedAircraft && (
          <div className="absolute right-5 top-5 z-10 w-72 rounded-xl border border-white/10 bg-slate-900/95 p-4 shadow-panel backdrop-blur-sm transition-all">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white">Aircraft</h3>
              </div>
              <button onClick={() => setSelectedAircraft(null)} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Callsign</span><span className="text-cyan-400">{selectedAircraft.callsign || selectedAircraft.icao24}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Altitude</span><span className="text-white">{selectedAircraft.altitude != null ? `${Math.round(selectedAircraft.altitude).toLocaleString()} ft` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Velocity</span><span className="text-white">{selectedAircraft.velocity != null ? `${Math.round(selectedAircraft.velocity)} kt` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Heading</span><span className="text-white">{selectedAircraft.heading != null ? `${Math.round(selectedAircraft.heading)}°` : '—'}</span></div>
              <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-slate-500">Updated {selectedAircraft.ts ? new Date(selectedAircraft.ts * 1000).toLocaleTimeString() : '—'}</div>
            </div>
          </div>
        )}
        {selectedCamera && (
          <div className="absolute right-5 top-5 z-10 w-72 rounded-xl border border-white/10 bg-slate-900/95 p-4 shadow-panel backdrop-blur-sm transition-all">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white">Camera</h3>
              </div>
              <button onClick={() => setSelectedCamera(null)} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="mb-1 text-sm font-medium text-white">{selectedCamera.name}</p>
            <p className="mb-3 text-xs text-slate-400">{selectedCamera.region ?? 'Maryland'}</p>
            <a
              href={selectedCamera.stream_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Open stream
            </a>
          </div>
        )}

        {/* Coordinates / Zoom - pointer-events-none so map clicks pass through */}
        <div className="pointer-events-none absolute bottom-20 right-5 z-10 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 font-mono text-[11px] text-slate-400 backdrop-blur-sm">
          <div><span className="text-slate-500">Lng</span> {mapState.lng}</div>
          <div><span className="text-slate-500">Lat</span> {mapState.lat}</div>
          <div><span className="text-slate-500">Zoom</span> {mapState.zoom}</div>
        </div>
        {/* Legend - pointer-events-none so map clicks pass through */}
        <div className="pointer-events-none absolute bottom-20 left-5 z-10 rounded-xl border border-white/10 bg-slate-900/95 px-4 py-3 shadow-panel backdrop-blur-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Congestion</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-slate-300">Low</span></div>
            <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-amber-500" /><span className="text-xs text-slate-300">Medium</span></div>
            <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-red-500" /><span className="text-xs text-slate-300">High</span></div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-white/10 bg-[#0f172a]/95 px-5 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-6 font-mono text-xs text-slate-400">
          <span><span className="text-cyan-400">{filteredAircraft.length}</span> aircraft</span>
          <span><span className="text-cyan-400">{filteredCameras.length}</span> cameras</span>
        </div>
        <div className="text-[11px] text-slate-500">GeoTrack MVP • ADS-B + MD CHART</div>
      </footer>
    </div>
  )
}
