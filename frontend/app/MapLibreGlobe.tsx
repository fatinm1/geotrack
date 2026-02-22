'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapLibreGlobeProps {
  pointsData: Array<{ lat: number; lng: number; type: string; aircraft?: unknown; camera?: unknown }>;
  polygonsData: Array<{ geometry: { type: string; coordinates: number[][][] }; color: string; altitude?: number }>;
  onPointClick?: (point: { lat: number; lng: number; type?: string; aircraft?: unknown; camera?: unknown }) => void;
  onReady?: () => void;
  pointColor?: (d: unknown) => string;
  pointRadius?: (d: unknown) => number;
  pointLabel?: (d: unknown) => string;
  width?: number | string;
  height?: number | string;
}

export interface MapLibreGlobeRef {
  pointOfView: (pov: { lat?: number; lng?: number; altitude?: number }, ms?: number) => void;
}

export const MapLibreGlobe = forwardRef<MapLibreGlobeRef, MapLibreGlobeProps>(function MapLibreGlobe(
  { pointsData, polygonsData, onPointClick, onReady, pointColor, pointRadius, pointLabel, width = '100%', height = '100%' },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useImperativeHandle(ref, () => ({
    pointOfView: (pov: { lat?: number; lng?: number; altitude?: number }, ms = 1000) => {
      const map = mapRef.current;
      if (!map) return;
      const zoom = pov.altitude != null ? Math.max(1, 10 - pov.altitude * 2.5) : 3;
      map.flyTo({
        center: [pov.lng ?? 0, pov.lat ?? 0],
        zoom,
        duration: ms,
      });
    },
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    import('maplibre-gl').then((maplibregl) => {
      const map = new maplibregl.Map({
        container: containerRef.current!,
        renderWorldCopies: false,
        style: {
          version: 8,
          projection: { type: 'vertical-perspective' },
          sources: {
            satellite: {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
            },
          },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': 'rgb(5, 8, 16)' } },
            { id: 'satellite', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 19 },
          ],
        },
        center: [-76.5, 39],
        zoom: 3,
        minZoom: 1.5,
        maxZoom: 19,
      });
      map.on('style.load', () => {
        map.setRenderWorldCopies(false);
        map.setFog({ color: 'rgb(5, 8, 16)', 'high-color': 'rgb(5, 8, 16)', 'horizon-blend': 0 });

        // Add polygon layer
        if (polygonsData.length > 0) {
          map.addSource('buildings', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: polygonsData.map((p) => ({
                type: 'Feature',
                properties: { color: p.color, height: (p.altitude ?? 0.02) * 1000 },
                geometry: p.geometry,
              })),
            },
          });
          map.addLayer({
            id: 'buildings-extrusion',
            type: 'fill-extrusion',
            source: 'buildings',
            paint: {
              'fill-extrusion-color': ['get', 'color'],
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.8,
            },
          });
        }

        // Add points layer
        if (pointsData.length > 0) {
          map.addSource('points', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
        features: pointsData.map((p) => ({
          type: 'Feature',
          properties: {
            color: pointColor?.(p) ?? '#06b6d4',
            radius: pointRadius?.(p) ?? 0.2,
            label: pointLabel?.(p) ?? '',
            type: p.type,
            aircraft: p.aircraft,
            camera: p.camera,
          },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
            },
          });
          map.addLayer({
            id: 'points-circle',
            type: 'circle',
            source: 'points',
            paint: {
              'circle-radius': ['*', ['get', 'radius'], 12],
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 1,
              'circle-stroke-color': '#fff',
            },
          });

          if (onPointClick) {
            map.on('click', 'points-circle', (e) => {
              const f = e.features?.[0];
              if (f?.properties) {
                const props = f.properties as Record<string, unknown>;
                onPointClick({
                  lat: f.geometry.type === 'Point' ? (f.geometry as { coordinates: [number, number] }).coordinates[1] : 0,
                  lng: f.geometry.type === 'Point' ? (f.geometry as { coordinates: [number, number] }).coordinates[0] : 0,
                  type: props.type as string,
                  aircraft: props.aircraft,
                  camera: props.camera,
                });
              }
            });
            map.getCanvas().style.cursor = 'pointer';
          }
          onReady?.();
        }
      });
      mapRef.current = map;
      const el = containerRef.current;
      let ro: ResizeObserver | null = null;
      if (el) {
        ro = new ResizeObserver(() => map.resize());
        ro.observe(el);
      }
      return () => {
        ro?.disconnect();
        map.remove();
        mapRef.current = null;
      };
    });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('points') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: pointsData.map((p) => ({
          type: 'Feature',
          properties: {
            color: pointColor?.(p) ?? '#06b6d4',
            radius: pointRadius?.(p) ?? 0.2,
            label: pointLabel?.(p) ?? '',
            type: p.type,
            aircraft: p.aircraft,
            camera: p.camera,
          },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
      });
    }
  }, [pointsData, pointColor, pointRadius, pointLabel]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minWidth: 400, minHeight: 400 }}
      className="maplibregl-map"
    />
  );
});
