import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { Point } from '@/storage/measurements';
import { formatDateTime, formatShortDate } from '@/util/format';
import { buildChart, nearestIndex } from './chartPaths';
import { ThemedText } from './ThemedText';
import { useColors } from './theme';

/**
 * Line + soft area chart over time, with the first and last dates underneath. Press and drag along it
 * to read the value and date of the nearest reading.
 */
export function TrendChart({
  points,
  color,
  height = 150,
  format,
}: {
  points: readonly Point[];
  color: string;
  height?: number;
  /** Turns a value into display text (units included) for the readout. */
  format?: (v: number) => string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const g = useMemo(() => buildChart(points, width, height), [points, width, height]);

  // Rebuilt only when the geometry changes (new data or width), not on every drag update.
  const pan = useMemo(() => {
    const pick = (x: number) => setPicked(nearestIndex(g.coords, x));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture: the page's ScrollView must not steal it mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => setPicked(null),
      onPanResponderTerminate: () => setPicked(null),
    });
  }, [g.coords]);

  const sel = picked !== null && picked >= 0 && picked < points.length ? picked : null;
  const selPoint = sel === null ? null : points[sel];
  const selXY = sel === null ? null : g.coords[sel];

  return (
    <View>
      <View style={[styles.readout, { height: 20 }]}>
        {selPoint && (
          <ThemedText style={styles.readoutText}>
            <ThemedText style={{ color, fontWeight: '700' }}>{format ? format(selPoint.v) : String(selPoint.v)}</ThemedText>
            <ThemedText subtle> · {formatDateTime(selPoint.t)}</ThemedText>
          </ThemedText>
        )}
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && points.length > 0 && (
          <Svg width={width} height={height}>
            {g.area !== '' && <Path d={g.area} fill={color} fillOpacity={0.22} />}
            <Path d={g.line} stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            {selXY ? (
              <>
                <Line x1={selXY.x} x2={selXY.x} y1={0} y2={height} stroke={c.subtext} strokeWidth={1} strokeDasharray="4 4" />
                <Circle cx={selXY.x} cy={selXY.y} r={6} fill={color} stroke={c.card} strokeWidth={2} />
              </>
            ) : (
              g.last && <Circle cx={g.last.x} cy={g.last.y} r={4.5} fill={color} />
            )}
          </Svg>
        )}
        {width > 0 && points.length > 0 && <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />}
      </View>
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
  readout: { justifyContent: 'center', alignItems: 'center' },
  readoutText: { fontSize: 14 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  axisText: { fontSize: 12 },
});
