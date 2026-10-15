import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';

export async function requestGpsPermission(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) return 'geolocation' in navigator;
    const p = await Geolocation.requestPermissions({ permissions: ['location'] });
    return p.location === 'granted';
  } catch {
    return false;
  }
}

function haversineM(a: Position['coords'], b: Position['coords']): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Foreground distance tracker. Ignores low-accuracy fixes and implausible jumps
 * (> 12 m/s). `paused` stops accumulation without dropping the watch.
 */
export class DistanceTracker {
  distanceM = 0;
  paused = false;
  private last: Position['coords'] | null = null;
  private lastTs = 0;
  private watchId: string | null = null;

  async start(onUpdate: (distanceM: number) => void) {
    try {
      this.watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 2000 }, (pos) => {
        if (!pos || pos.coords.accuracy > 30) return;
        if (this.paused) { this.last = null; return; }
        if (this.last) {
          const d = haversineM(this.last, pos.coords);
          const dt = Math.max(1, (pos.timestamp - this.lastTs) / 1000);
          if (d / dt < 12 && d > 2) {
            this.distanceM += d;
            onUpdate(this.distanceM);
          }
          if (d <= 2) return; // keep the older anchor to avoid accumulating jitter
        }
        this.last = pos.coords;
        this.lastTs = pos.timestamp;
      });
    } catch {
      this.watchId = null;
    }
  }

  stop() {
    if (this.watchId) Geolocation.clearWatch({ id: this.watchId }).catch(() => undefined);
    this.watchId = null;
  }
}
