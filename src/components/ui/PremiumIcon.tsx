import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

type Props = {
  name: IconName;
  color: string;
  size?: number;
};

export type IconName =
  | 'map'
  | 'groups'
  | 'routes'
  | 'account'
  | 'bus'
  | 'pin'
  | 'chevron'
  | 'compass'
  | 'back';

const ICONS: Record<
  IconName,
  {
    ios: SFSymbol;
    android: AndroidSymbol;
    ion: keyof typeof Ionicons.glyphMap;
  }
> = {
  map: { ios: 'map.fill', android: 'map', ion: 'map' },
  groups: { ios: 'person.3.fill', android: 'groups', ion: 'people' },
  routes: { ios: 'location.north.line.fill', android: 'near_me', ion: 'navigate' },
  account: { ios: 'person.crop.circle.fill', android: 'account_circle', ion: 'person' },
  bus: { ios: 'bus.fill', android: 'directions_bus', ion: 'bus' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', ion: 'location' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', ion: 'chevron-forward' },
  compass: { ios: 'safari.fill', android: 'explore', ion: 'compass' },
  back: { ios: 'chevron.left', android: 'chevron_left', ion: 'arrow-back' },
};

export function PremiumIcon({ name, color, size = 22 }: Props) {
  const icon = ICONS[name];
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android }}
      tintColor={color}
      size={size}
      type="hierarchical"
      weight="semibold"
      fallback={<Ionicons name={icon.ion} size={size} color={color} />}
    />
  );
}

export function iconFromIon(name: keyof typeof Ionicons.glyphMap): IconName {
  if (name.startsWith('map')) return 'map';
  if (name.startsWith('people')) return 'groups';
  if (name.startsWith('person')) return 'account';
  if (name.startsWith('navigate')) return 'routes';
  if (name.startsWith('bus')) return 'bus';
  if (name.startsWith('location')) return 'pin';
  if (name.startsWith('compass')) return 'compass';
  if (name.startsWith('chevron')) return 'chevron';
  if (name.startsWith('arrow-back')) return 'back';
  return 'map';
}
