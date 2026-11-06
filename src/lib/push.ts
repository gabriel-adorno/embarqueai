import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api } from '@/src/lib/api';
import { isRemote } from '@/src/lib/config';

const TOKEN_KEY = '@embarqueai/push-token';

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/**
 * Pede permissão, gera o token Expo deste aparelho e envia ao Worker.
 * Retorna true quando o aparelho passa a receber push do servidor.
 * No web, no modo mock ou sem projectId do EAS, retorna false e o app
 * continua usando os avisos locais (FamilyNotifier).
 */
export async function registerPushToken(): Promise<boolean> {
  if (Platform.OS === 'web' || !isRemote()) return false;
  const id = projectId();
  if (!id) {
    console.warn('push: sem projectId do EAS; rode `eas init` e defina EAS_PROJECT_ID.');
    return false;
  }
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Avisos da viagem',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return false;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await api('/push/token', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch (err) {
    console.warn('push: não foi possível registrar', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Desvincula o aparelho da conta (chamar antes de sair). */
export async function unregisterPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
  if (!isRemote()) return;
  await api('/push/token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
    allowError: true,
  }).catch(() => undefined);
}
