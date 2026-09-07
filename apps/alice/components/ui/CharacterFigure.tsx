import { Image, StyleSheet, type ImageStyle } from 'react-native';

import { ChatAvatar } from '@/components/ui/ChatAvatar';
import type { Guide } from '@/types/foundation';

const guideImages = {
  alice: require('@/assets/characters/alice.png'),
  harry: require('@/assets/characters/harry.png'),
};

export function CharacterFigure({ guide, style }: { guide: Guide; style?: ImageStyle }) {
  return <Image accessibilityLabel={guide === 'alice' ? 'Alice' : 'Harry'} resizeMode="contain" source={guideImages[guide]} style={[styles.image, style]} />;
}

export function CharacterAvatar({ guide, style }: { guide: Guide; style?: ImageStyle }) {
  return <ChatAvatar guide={guide} style={style} />;
}

const styles = StyleSheet.create({
  image: {
    width: 160,
    height: 200,
  },
});
