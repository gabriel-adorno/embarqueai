import { APP_MESSAGES, type AppMessageKey, type AppMessageKind } from '@/src/lib/messages';
import { useToastStore, type FlashMessage } from '@/src/store/toast';

const SUCCESS_KEYS: AppMessageKey[] = [
  'accountCreated',
  'codeSent',
  'passwordChanged',
  'routeCreated',
  'profileUpdated',
  'groupCreated',
  'memberAdded',
];

export function flashFromCatalog(
  key: AppMessageKey,
  kind?: AppMessageKind,
): FlashMessage {
  const msg = APP_MESSAGES[key];
  return {
    title: msg.title,
    body: msg.body,
    kind: kind ?? (SUCCESS_KEYS.includes(key) ? 'success' : 'error'),
  };
}

export function flashFromAuthError(error: {
  title?: string;
  message: string;
} | null | undefined): FlashMessage {
  return {
    title: error?.title ?? APP_MESSAGES.genericError.title,
    body: error?.message ?? APP_MESSAGES.genericError.body,
    kind: 'error',
  };
}

export function notify(flash: FlashMessage): void {
  useToastStore.getState().show(flash);
}

export function notifyKey(key: AppMessageKey, kind?: AppMessageKind): void {
  notify(flashFromCatalog(key, kind));
}

export function notifyError(title: string, body?: string): void {
  notify({ title, body, kind: 'error' });
}
