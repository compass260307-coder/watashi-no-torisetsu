import { Image, StyleSheet, type ImageStyle } from 'react-native';

import type { Guide } from '@/types/foundation';

const guideImages = {
  alice: require('@/assets/characters/alice.png'),
  harry: require('@/assets/characters/harry.png'),
};

export function GuideFigure({ guide, style }: { guide: Guide; style?: ImageStyle }) {
  return (
    <Image
      accessibilityLabel={guide === 'alice' ? 'Alice' : 'Harry'}
      resizeMode="contain"
      source={guideImages[guide]}
      style={[styles.image, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: 160,
    height: 200,
  },
});
