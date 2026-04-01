/**
 * GET /api/fleet/locations — Live vehicle locations from Samsara
 *
 * Proxies the gateway's /samsara/fleet/locations endpoint and maps
 * the Samsara response into the LocationItem shape the UI expects.
 */

import { NextResponse } from 'next/server';
import { gatewayFetch } from '@/lib/gateway';

interface SamsaraVehicle {
  id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  location?: { latitude?: number; longitude?: number };
  gps?: { latitude?: number; longitude?: number };
  engineState?: string;
  obd?: { engineState?: string };
  status?: string;
  [key: string]: unknown;
}

function mapStatus(vehicle: SamsaraVehicle): 'active' | 'idle' | 'maintenance' | 'offline' {
  const engine = vehicle.engineState ?? vehicle.obd?.engineState ?? '';
  const rawStatus = (vehicle.status ?? '').toLowerCase();

  if (rawStatus === 'maintenance' || rawStatus === 'shop') return 'maintenance';
  if (rawStatus === 'offline' || rawStatus === 'deactivated') return 'offline';
  if (engine === 'Off' || engine === 'Idle' || rawStatus === 'idle') return 'idle';
  return 'active';
}

function extractCoords(v: SamsaraVehicle): { lat: number; lng: number } | null {
  const lat = v.latitude ?? v.location?.latitude ?? v.gps?.latitude;
  const lng = v.longitude ?? v.location?.longitude ?? v.gps?.longitude;
  if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
    return { lat, lng };
  }
  return null;
}

export async function GET() {
  try {
    const res = await gatewayFetch('/samsara/fleet/locations', 'admin', {
      timeout: 15000,
    });

    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error ?? 'Samsara request failed' },
        { status: 502 },
      );
    }

    const raw = Array.isArray(res.data) ? res.data : [];
    const locations = (raw as SamsaraVehicle[])
      .map((v) => {
        const coords = extractCoords(v);
        if (!coords) return null;
        return {
          name: v.name ?? v.id ?? 'Unknown',
          lat: coords.lat,
          lng: coords.lng,
          status: mapStatus(v),
          region: '',
          detail: '',
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data: locations });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch fleet locations',
      },
      { status: 500 },
    );
  }
}
