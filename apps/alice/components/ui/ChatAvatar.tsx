import { Image, StyleSheet, type ImageStyle } from 'react-native';

import type { Guide } from '@/types/foundation';

const guideAvatarImages = {
  alice: require('@/assets/characters/alice-chat-avatar.png'),
  harry: require('@/assets/characters/harry-chat-avatar.png'),
};

export function ChatAvatar({ guide, style }: { guide: Guide; style?: ImageStyle }) {
  return (
    <Image
      accessibilityLabel={guide === 'alice' ? 'Alice' : 'Harry'}
      resizeMode="contain"
      source={guideAvatarImages[guide]}
      style={[styles.avatar, style]}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 64,
    height: 64,
  },
});
