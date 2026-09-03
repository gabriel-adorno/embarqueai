import type { Href } from 'expo-router';

/** Typed routes lag behind new files; keep navigation strings in one place. */
export function href(path: string): Href {
  return path as Href;
}
