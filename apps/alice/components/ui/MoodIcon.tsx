import { StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';

export type MoodIconName = 'clear' | 'calm' | 'mixed' | 'hard';

export function MoodIcon({ mood, size = 36 }: { mood: MoodIconName; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: size, height: size }]}>
      <View style={[styles.scaler, { transform: [{ scale: size / 36 }] }]}>
        {mood === 'clear' ? <SunIcon /> : null}
        {mood === 'calm' ? <CloudIcon /> : null}
        {mood === 'mixed' ? <RainIcon /> : null}
        {mood === 'hard' ? <ThunderIcon /> : null}
      </View>
    </View>
  );
}

function SunIcon() {
  return (
    <View style={styles.center}>
      <View style={[styles.sunRay, styles.rayTop]} />
      <View style={[styles.sunRay, styles.rayRight]} />
      <View style={[styles.sunRay, styles.rayBottom]} />
      <View style={[styles.sunRay, styles.rayLeft]} />
      <View style={[styles.sunRay, styles.rayTopRight]} />
      <View style={[styles.sunRay, styles.rayBottomRight]} />
      <View style={[styles.sunRay, styles.rayBottomLeft]} />
      <View style={[styles.sunRay, styles.rayTopLeft]} />
      <View style={styles.sunCore} />
    </View>
  );
}

function CloudIcon() {
  return (
    <View style={styles.center}>
      <View style={[styles.cloudPart, styles.cloudLeft]} />
      <View style={[styles.cloudPart, styles.cloudTop]} />
      <View style={[styles.cloudPart, styles.cloudRight]} />
      <View style={styles.cloudBase} />
    </View>
  );
}

function ThunderIcon() {
  return (
    <View style={styles.center}>
      <View style={[styles.thunderCloudPart, styles.thunderCloudLeft]} />
      <View style={[styles.thunderCloudPart, styles.thunderCloudTop]} />
      <View style={[styles.thunderCloudPart, styles.thunderCloudRight]} />
      <View style={styles.thunderCloudBase} />
      <View style={[styles.thunderBoltSegment, styles.thunderBoltTop]} />
      <View style={[styles.thunderBoltSegment, styles.thunderBoltMiddle]} />
      <View style={[styles.thunderBoltSegment, styles.thunderBoltBottom]} />
    </View>
  );
}

function RainIcon() {
  return (
    <View style={styles.center}>
      <View style={[styles.rainCloudPart, styles.cloudLeft]} />
      <View style={[styles.rainCloudPart, styles.cloudTop]} />
      <View style={[styles.rainCloudPart, styles.cloudRight]} />
      <View style={styles.rainCloudBase} />
      <View style={[styles.rainDrop, styles.rainDropLeft]} />
      <View style={[styles.rainDrop, styles.rainDropCenter]} />
      <View style={[styles.rainDrop, styles.rainDropRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scaler: { width: 36, height: 36 },
  center: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sunCore: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#F7B731' },
  sunRay: { position: 'absolute', width: 2.5, height: 6, borderRadius: 2, backgroundColor: '#F7B731' },
  rayTop: { top: 2, left: 17 },
  rayRight: { top: 15, right: 3, transform: [{ rotate: '90deg' }] },
  rayBottom: { bottom: 2, left: 17 },
  rayLeft: { top: 15, left: 3, transform: [{ rotate: '90deg' }] },
  rayTopRight: { top: 6, right: 7, transform: [{ rotate: '45deg' }] },
  rayBottomRight: { right: 7, bottom: 6, transform: [{ rotate: '-45deg' }] },
  rayBottomLeft: { bottom: 6, left: 7, transform: [{ rotate: '45deg' }] },
  rayTopLeft: { top: 6, left: 7, transform: [{ rotate: '-45deg' }] },
  cloudPart: { position: 'absolute', backgroundColor: palette.lightBlue },
  cloudLeft: { left: 5, top: 15, width: 13, height: 13, borderRadius: 7 },
  cloudTop: { left: 12, top: 8, width: 17, height: 17, borderRadius: 9 },
  cloudRight: { right: 4, top: 14, width: 13, height: 13, borderRadius: 7 },
  cloudBase: { position: 'absolute', left: 6, bottom: 7, width: 26, height: 11, borderRadius: 7, backgroundColor: palette.lightBlue },
  thunderCloudPart: { position: 'absolute', backgroundColor: '#6C63D9' },
  thunderCloudLeft: { left: 4, top: 10, width: 12, height: 12, borderRadius: 7 },
  thunderCloudTop: { left: 11, top: 4, width: 16, height: 16, borderRadius: 9 },
  thunderCloudRight: { right: 3, top: 9, width: 12, height: 12, borderRadius: 7 },
  thunderCloudBase: { position: 'absolute', left: 5, top: 13, width: 27, height: 9, borderRadius: 6, backgroundColor: '#6C63D9' },
  thunderBoltSegment: { position: 'absolute', zIndex: 1, backgroundColor: '#FFC83D' },
  thunderBoltTop: { top: 17, left: 15, width: 5, height: 12, borderRadius: 1, transform: [{ rotate: '30deg' }] },
  thunderBoltMiddle: { top: 24, left: 13, width: 9, height: 5, borderRadius: 1 },
  thunderBoltBottom: { top: 24, left: 15, width: 5, height: 12, borderRadius: 1, transform: [{ rotate: '30deg' }] },
  rainCloudPart: { position: 'absolute', backgroundColor: '#6F9EF8' },
  rainCloudBase: { position: 'absolute', left: 6, top: 17, width: 26, height: 9, borderRadius: 6, backgroundColor: '#6F9EF8' },
  rainDrop: { position: 'absolute', top: 27, width: 2.5, height: 7, borderRadius: 2, backgroundColor: palette.brand, transform: [{ rotate: '16deg' }] },
  rainDropLeft: { left: 10 },
  rainDropCenter: { left: 18 },
  rainDropRight: { right: 7 },
});
