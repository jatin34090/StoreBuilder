import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { io } from 'socket.io-client';

const TASK_NAME = 'AGENT_LOCATION';
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const SOCKET_URL = API_URL.replace('/api/v1', '');

let activeDeliveryId: string | null = null;
let socket: ReturnType<typeof io> | null = null;

TaskManager.defineTask(TASK_NAME, ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  const location = data.locations[0];
  if (!location || !activeDeliveryId || !socket?.connected) return;

  socket.emit('delivery:location', {
    deliveryId: activeDeliveryId,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    timestamp: Date.now(),
  });
});

export async function startLocationTracking(deliveryId: string, authToken: string): Promise<void> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Background location permission not granted');
  }

  activeDeliveryId = deliveryId;

  // Connect socket for GPS streaming
  socket = io(SOCKET_URL, {
    auth: { token: authToken },
    transports: ['websocket'],
  });

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,    // 30 seconds
    distanceInterval: 50,    // or every 50 meters
    foregroundService: {
      notificationTitle: 'Delivery Active',
      notificationBody: 'Tracking your location for delivery',
      notificationColor: '#4A0E8F',
    },
    pausesUpdatesAutomatically: false,
  });
}

export async function stopLocationTracking(): Promise<void> {
  activeDeliveryId = null;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }

  socket?.disconnect();
  socket = null;
}
