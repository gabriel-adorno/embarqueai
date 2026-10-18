import { Platform } from 'react-native';

export async function deviceNotice(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }

  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    if (asked.status !== 'granted') return;
  }
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}
