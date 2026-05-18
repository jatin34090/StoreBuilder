import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A0E8F',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env['EXPO_PUBLIC_EAS_PROJECT_ID'],
  });

  // Send token to server
  try {
    await api.post('/users/me/push-token', { token: tokenData.data });
  } catch (error) {
    console.error('Failed to register push token:', error);
  }

  return tokenData.data;
}
