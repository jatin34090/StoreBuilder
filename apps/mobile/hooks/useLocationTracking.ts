import { useEffect, useRef, useState } from 'react';
import { LocationTracker, type LocationPermission } from '../services/location';

/**
 * Runs the foreground GPS tracker while `active` is true (i.e. the delivery is
 * in progress) and stops it as soon as the delivery completes or the screen
 * unmounts — satisfying "stop tracking after delivery is completed".
 */
export function useLocationTracking(active: boolean) {
  const trackerRef = useRef<LocationTracker | null>(null);
  const [permission, setPermission] = useState<LocationPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackerRef.current) trackerRef.current = new LocationTracker();
    const tracker = trackerRef.current;

    if (active) {
      setError(null);
      tracker.start((msg) => setError(msg)).then(setPermission);
    } else {
      tracker.stop();
    }

    return () => {
      tracker.stop();
    };
  }, [active]);

  return { permission, error, isTracking: !!trackerRef.current?.isRunning() && active };
}
