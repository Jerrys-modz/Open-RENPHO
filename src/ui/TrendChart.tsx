import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { Point } from '@/storage/measurements';
import { formatShortDate } from '@/util/format';
import { buildChart } from './chartPaths';
import { ThemedText } from './ThemedText';

/** Line + soft area chart over time, with the first and last dates underneath. */
export function TrendChart({ points, color, height = 150 }: { points: readonly Point[]; color: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const g = buildChart(points, width, height);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && points.length > 0 && (
        <Svg width={width} height={height}>
          {g.area !== '' && <Path d={g.area} fill={color} fillOpacity={0.22} />}
          <Path d={g.line} stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" fill="none" />
          {g.last && <Circle cx={g.last.x} cy={g.last.y} r={4.5} fill={color} />}
        </Svg>
      )}
      {points.length > 1 && (
        <View style={styles.axis}>
          <ThemedText subtle style={styles.axisText}>
            {formatShortDate(points[0].t)}
          </ThemedText>
          <ThemedText subtle style={styles.axisText}>
            {formatShortDate(points[points.length - 1].t)}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  axisText: { fontSize: 12 },
});
