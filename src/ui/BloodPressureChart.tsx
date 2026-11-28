import { Fragment, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { BP_CATEGORY_COLOR, BP_CATEGORY_LABEL, classifyBp, type BpReading } from '@/domain/bloodPressure';
import { formatDateTime, formatShortDate } from '@/util/format';
import { formatForDisplay, type PressureUnit } from '@/util/units';
import { buildBandChart, nearestBandIndex } from './chartPaths';
import { ThemedText } from './ThemedText';
import { useColors } from './theme';

const SYSTOLIC = '#e53935';
const DIASTOLIC = '#fb8c00';
const BP_DEF = { unit: 'mmHg', digits: 0 };

/**
 * Systolic and diastolic as two lines on one scale, with the space between them shaded. Press and drag
 * to read a reading. `readings` must be oldest first.
 */
export function BloodPressureChart({
  readings,
  pressure,
  height = 170,
}: {
  readings: readonly BpReading[];
  pressure: PressureUnit;
  height?: number;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const series = useMemo(() => readings.map((r) => ({ t: r.takenAt, sys: r.systolic, dia: r.diastolic })), [readings]);
  const g = useMemo(() => buildBandChart(series, width, height), [series, width, height]);

  const pan = useMemo(() => {
    const pick = (x: number) => setPicked(nearestBandIndex(g.coords, x));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => setPicked(null),
      onPanResponderTerminate: () => setPicked(null),
    });
  }, [g.coords]);

  const fmt = (v: number) => formatForDisplay(BP_DEF, v, 'metric', pressure).text;
  const sel = picked !== null && picked >= 0 && picked < readings.length ? readings[picked] : null;
  const selXY = sel ? g.coords[picked as number] : null;

  if (readings.length === 0) {
    return (
      <ThemedText subtle style={styles.empty}>
        No readings in this period.
      </ThemedText>
    );
  }

  return (
    <View>
      <View style={styles.readout}>
        {sel ? (
          <ThemedText style={styles.readoutText}>
            <ThemedText style={{ fontWeight: '700' }}>
              {fmt(sel.systolic)}/{fmt(sel.diastolic)} {pressure}
            </ThemedText>
            <ThemedText style={{ color: BP_CATEGORY_COLOR[classifyBp(sel.systolic, sel.diastolic)], fontWeight: '600' }}>
              {' '}
              {BP_CATEGORY_LABEL[classifyBp(sel.systolic, sel.diastolic)]}
            </ThemedText>
            <ThemedText subtle> · {formatDateTime(sel.takenAt)}</ThemedText>
          </ThemedText>
        ) : (
          <ThemedText subtle style={styles.readoutText}>
            <ThemedText style={{ color: SYSTOLIC, fontWeight: '700' }}>Systolic</ThemedText> and{' '}
            <ThemedText style={{ color: DIASTOLIC, fontWeight: '700' }}>diastolic</ThemedText>, {pressure}
          </ThemedText>
        )}
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {g.band !== '' && <Path d={g.band} fill={SYSTOLIC} fillOpacity={0.12} />}
            <Path d={g.systolicLine} stroke={SYSTOLIC} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            <Path d={g.diastolicLine} stroke={DIASTOLIC} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            {readings.length <= 31 &&
              g.coords.map((p, i) => (
                <Fragment key={i}>
                  <Circle cx={p.x} cy={p.ys} r={3} fill={SYSTOLIC} />
                  <Circle cx={p.x} cy={p.yd} r={3} fill={DIASTOLIC} />
                </Fragment>
              ))}
            {selXY && (
              <>
                <Line x1={selXY.x} x2={selXY.x} y1={0} y2={height} stroke={c.subtext} strokeWidth={1} strokeDasharray="4 4" />
                <Circle cx={selXY.x} cy={selXY.ys} r={6} fill={SYSTOLIC} stroke={c.card} strokeWidth={2} />
                <Circle cx={selXY.x} cy={selXY.yd} r={6} fill={DIASTOLIC} stroke={c.card} strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
        {width > 0 && <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />}
      </View>
      <View style={styles.axis}>
        <ThemedText subtle style={styles.axisText}>
          {formatShortDate(readings[0].takenAt)}
        </ThemedText>
        <ThemedText subtle style={styles.axisText}>
          {fmt(g.max)} to {fmt(g.min)}
        </ThemedText>
        <ThemedText subtle style={styles.axisText}>
          {formatShortDate(readings[readings.length - 1].takenAt)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: 24 },
  readout: { minHeight: 36, justifyContent: 'center', alignItems: 'center' },
  readoutText: { fontSize: 14, textAlign: 'center' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  axisText: { fontSize: 12 },
});
