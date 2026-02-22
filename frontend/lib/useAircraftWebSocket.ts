'use client';

import { useEffect, useState, useCallback } from 'react';
import { WS_URL } from './config';

export interface AircraftState {
  icao24: string;
  callsign?: string | null;
  lon: number;
  lat: number;
  altitude?: number | null;
  velocity?: number | null;
  heading?: number | null;
  ts: number;
}

export function useAircraftWebSocket() {
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = WS_URL.replace(/^http/, 'ws') + '/ws/aircraft';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'aircraft_update' && Array.isArray(msg.data)) {
          setAircraft(msg.data.map((a: Record<string, unknown>) => ({
            icao24: String(a.icao24 ?? ''),
            callsign: a.callsign != null ? String(a.callsign) : null,
            lon: Number(a.lon ?? 0),
            lat: Number(a.lat ?? 0),
            altitude: a.altitude != null ? Number(a.altitude) : null,
            velocity: a.velocity != null ? Number(a.velocity) : null,
            heading: a.heading != null ? Number(a.heading) : null,
            ts: Number(a.ts ?? 0),
          })));
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => ws.close();
  }, []);

  return { aircraft, connected };
}
