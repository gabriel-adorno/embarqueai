import { useContext, useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarHeightCallbackContext } from 'expo-router/build/react-navigation/bottom-tabs';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { PremiumIcon, type IconName } from '@/src/components/ui/PremiumIcon';
import { colors } from '@/src/theme/colors';
import { floatingTabBar } from '@/src/theme/layout';

const TAB_ICONS: Record<string, IconName> = {
  index: 'map',
  groups: 'groups',
  routes: 'routes',
  profile: 'account',
};

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const setTabBarHeight = useContext(BottomTabBarHeightCallbackContext);

  useLayoutEffect(() => {
    setTabBarHeight?.(0);
  }, [setTabBarHeight]);

  const routes = state.routes.filter((route) => {
    const options = descriptors[route.key].options as { href?: string | null };
    return options.href !== null;
  });

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View
        pointerEvents="auto"
        style={[
          styles.pill,
          { marginBottom: Math.max(insets.bottom, floatingTabBar.extraBottom) },
        ]}
      >
        {routes.map((route) => {
          const index = state.routes.findIndex((item) => item.key === route.key);
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const icon = TAB_ICONS[route.name] ?? 'map';
          const color = focused ? colors.white : colors.tabMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (event.defaultPrevented) return;
            if (focused) {
              navigation.navigate(route.name, { screen: 'index' });
              return;
            }
            navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.item}
            >
              <View style={[styles.iconChip, focused && styles.iconChipActive]}>
                <PremiumIcon name={icon} color={color} size={20} />
              </View>
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: floatingTabBar.sideInset,
    minHeight: floatingTabBar.height,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(18, 21, 26, 0.08)',
    shadowColor: '#0B1220',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconChip: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipActive: {
    backgroundColor: colors.tabInk,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: colors.tabMuted,
  },
  labelActive: {
    color: colors.tabInk,
    fontWeight: '800',
  },
});
