import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { palette } from '@/constants/theme';
import { useBootstrap } from '@/providers/BootstrapProvider';

const iconSize = 29;

export default function TabLayout() {
  const { data: bootstrap } = useBootstrap();
  const chatEnabled = __DEV__ || bootstrap?.feature_flags.alice_chat === true;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: {
          height: 88,
          paddingTop: 9,
          paddingBottom: 17,
          borderTopColor: palette.border,
          backgroundColor: palette.white,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} size={iconSize} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '対話',
          href: chatEnabled ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat_bubble', web: 'chat_bubble' }}
              size={iconSize}
              tintColor={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
