import * as Print from 'expo-print';
import { Share } from 'react-native';
import type { BpReading } from '@/domain/bloodPressure';
import { buildBpReportHtml } from './bpReport';
import type { PressureUnit } from './units';

/** Makes the PDF (US Letter, 0.5 inch margins) in the app's cache and opens the iOS share sheet for it. */
export async function shareBpReport(readings: readonly BpReading[], pressure: PressureUnit, rangeLabel: string): Promise<void> {
  const html = buildBpReportHtml(readings, { pressure, generatedAt: Date.now(), rangeLabel });
  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792, margins: { left: 36, right: 36, top: 40, bottom: 40 } });
  await Share.share({ url: uri });
}
