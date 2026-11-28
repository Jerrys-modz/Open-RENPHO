import { BP_CATEGORY_COLOR, BP_CATEGORY_LABEL, bpReadings, classifyBp } from '@/domain/bloodPressure';
import type { Measurement } from '@/domain/measurement';
import { latestWithDelta } from '@/storage/measurements';
import { formatShortDate } from '@/util/format';
import { formatForDisplay, type PressureUnit, type UnitSystem } from '@/util/units';

/** Everything the home-screen widget shows, as plain strings, so the widget itself has nothing to work out. */
export interface KeelWidgetProps {
  /** Whose numbers these are, when the phone has more than one person. Empty otherwise. */
  person: string;
  weight: string;
  weightUnit: string;
  weightWhen: string;
  bp: string;
  bpUnit: string;
  bpCategory: string;
  /** Hex colour of the category, or empty with no reading. */
  bpColor: string;
  bpWhen: string;
}

export const EMPTY_WIDGET: KeelWidgetProps = {
  person: '',
  weight: '--',
  weightUnit: '',
  weightWhen: '',
  bp: '--',
  bpUnit: '',
  bpCategory: '',
  bpColor: '',
  bpWhen: '',
};

const BP_DEF = { unit: 'mmHg', digits: 0 };
const KG_DEF = { unit: 'kg', digits: 1 };

/** The latest weight and blood pressure in the user's display units. */
export function widgetSnapshot(
  list: readonly Measurement[],
  units: UnitSystem,
  pressure: PressureUnit,
  personName = '',
): KeelWidgetProps {
  const out: KeelWidgetProps = { ...EMPTY_WIDGET, person: personName };

  const w = latestWithDelta(list, { type: 'weight' });
  if (w) {
    const f = formatForDisplay(KG_DEF, w.point.v, units);
    out.weight = f.text;
    out.weightUnit = f.unit;
    out.weightWhen = formatShortDate(w.point.t);
  }

  const bp = bpReadings(list)[0];
  if (bp) {
    const category = classifyBp(bp.systolic, bp.diastolic);
    const sys = formatForDisplay(BP_DEF, bp.systolic, units, pressure);
    out.bp = `${sys.text}/${formatForDisplay(BP_DEF, bp.diastolic, units, pressure).text}`;
    out.bpUnit = sys.unit;
    out.bpCategory = BP_CATEGORY_LABEL[category];
    out.bpColor = BP_CATEGORY_COLOR[category];
    out.bpWhen = formatShortDate(bp.takenAt);
  }
  return out;
}
