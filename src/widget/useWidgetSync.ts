import { useEffect } from 'react';
import { useMeasurements } from '@/storage/useMeasurements';
import { usePressureUnit, useUnits } from '@/storage/useSettings';
import KeelWidget from './KeelWidget';
import { widgetSnapshot } from './snapshot';

/** Keeps the home-screen widget showing the latest weight and blood pressure. Call once, near the root. */
export function useWidgetSync(): void {
  const list = useMeasurements();
  const units = useUnits();
  const pressure = usePressureUnit();
  useEffect(() => {
    try {
      KeelWidget.updateSnapshot(widgetSnapshot(list, units, pressure));
    } catch (e) {
      // A widget that cannot refresh must never stop the app.
      console.warn('[widget] could not update', e);
    }
  }, [list, units, pressure]);
}
