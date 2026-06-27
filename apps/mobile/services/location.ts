import * as Location from 'expo-location';
import { agentApi } from './agent';

export type LocationPermission = 'granted' | 'denied' | 'disabled';

/** How often to push a fix to the backend while a delivery is active. */
export const LOCATION_INTERVAL_MS = 30_000;

/**
 * Ensure foreground location permission is granted and the device's location
 * services are enabled. Returns a discriminated status the UI can act on.
 */
export async function ensureLocationPermission(): Promise<LocationPermission> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return 'disabled';

  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * Foreground GPS tracker: pushes the agent's position to the backend every
 * LOCATION_INTERVAL_MS while running. REST-based (PATCH /agent/location), which
 * the API records on the agent and appends to the active delivery's locationLog.
 */
export class LocationTracker {
  private subscription: Location.LocationSubscription | null = null;
  private running = false;

  isRunning() {
    return this.running;
  }

  async start(onError?: (message: string) => void): Promise<LocationPermission> {
    const permission = await ensureLocationPermission();
    if (permission !== 'granted') return permission;
    if (this.running) return 'granted';
    this.running = true;

    const push = async (loc: Location.LocationObject) => {
      try {
        await agentApi.updateLocation(loc.coords.latitude, loc.coords.longitude);
      } catch {
        onError?.('Failed to send location update.');
      }
    };

    // Immediate first fix, then a watcher throttled to the interval.
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await push(current);
    } catch {
      onError?.('Could not get current location.');
    }

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: 25,
      },
      (loc) => {
        void push(loc);
      },
    );

    return 'granted';
  }

  stop() {
    this.subscription?.remove();
    this.subscription = null;
    this.running = false;
  }
}
