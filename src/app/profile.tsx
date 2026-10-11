import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, useColorScheme, View } from 'react-native';
import { readDemoMode } from '@/demo';
import { fromIsoDate, toIsoDate, validateProfile, type Sex } from '@/domain/profile';
import { parseSlotLink } from '@/ble/beurer/protocol';
import { clearBeurerPairing, loadBeurerPairing, saveBeurerPairing } from '@/storage/beurerPairing';
import { saveProfile, useProfile } from '@/storage/useProfile';
import { setBeurerAnyUser, setUnits, useBeurerAnyUser, useUnits } from '@/storage/useSettings';
import { Button, Card, SectionTitle } from '@/ui/components';
import { useColors } from '@/ui/theme';
import { ThemedText } from '@/ui/ThemedText';
import { formatLongDate } from '@/util/format';
import { heightToInput, parseHeightToCm, type UnitSystem } from '@/util/units';

const DEFAULT_PICK = new Date(1990, 0, 1, 12);
const OLDEST = new Date(1915, 0, 1);

export default function ProfileScreen() {
  const c = useColors();
  const existing = useProfile();
  const units = useUnits();
  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'male');
  const scheme = useColorScheme();
  const [birth, setBirth] = useState<Date | null>(existing ? fromIsoDate(existing.birthDate) : null);
  // The screenshots workflow opens the picker so its rendering is checked too.
  const [pickerOpen, setPickerOpen] = useState(() => readDemoMode() === 'profile');
  const [height, setHeight] = useState(existing ? heightToInput(existing.heightCm, units) : '');
  const [athlete, setAthlete] = useState(existing?.athlete ?? false);
  const [errors, setErrors] = useState<string[]>([]);
  const anyUser = useBeurerAnyUser();
  const [pairing, setPairing] = useState(() => loadBeurerPairing());
  const [linkSlot, setLinkSlot] = useState('');
  const [linkPin, setLinkPin] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const beurerSlot = pairing?.userIndex ?? null;

  const save = () => {
    const r = validateProfile({ sex, birthDate: birth ? toIsoDate(birth) : '', heightCm: parseHeightToCm(height, units), athlete });
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors([]);
    saveProfile(r.profile);
    router.back();
  };

  // Switching units keeps the same height, shown in the new unit.
  const changeUnits = (next: UnitSystem) => {
    if (next === units) return;
    const cm = parseHeightToCm(height, units);
    if (Number.isFinite(cm) && height.trim() !== '') setHeight(heightToInput(cm, next));
    setUnits(next);
  };

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText subtle style={styles.intro}>
        Your scale reports your weight. Body fat and everything derived from it (BMI, water, muscle, bone, BMR) is
        calculated from your sex, age and height. This stays on your phone.
      </ThemedText>

      <SectionTitle>Units</SectionTitle>
      <View style={styles.segment}>
        {(['imperial', 'metric'] as const).map((u) => (
          <Pressable
            key={u}
            onPress={() => changeUnits(u)}
            style={[styles.segmentItem, { borderColor: c.border, backgroundColor: u === units ? c.accent : c.card }]}
          >
            <ThemedText style={{ color: u === units ? c.accentText : c.text, fontWeight: '600' }}>
              {u === 'imperial' ? 'lb, in' : 'kg, cm'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Sex</SectionTitle>
      <View style={styles.segment}>
        {(['male', 'female'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSex(s)}
            style={[styles.segmentItem, { borderColor: c.border, backgroundColor: s === sex ? c.accent : c.card }]}
          >
            <ThemedText style={{ color: s === sex ? c.accentText : c.text, fontWeight: '600' }}>
              {s === 'male' ? 'Male' : 'Female'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Birth date</SectionTitle>
      <Pressable
        onPress={() => {
          setBirth((b) => b ?? DEFAULT_PICK);
          setPickerOpen((o) => !o);
        }}
        accessibilityRole="button"
        style={[styles.input, styles.dateRow, { borderColor: c.border, backgroundColor: c.background }]}
      >
        <ThemedText style={{ fontSize: 17, color: birth ? c.text : c.subtext }}>
          {birth ? formatLongDate(birth) : 'Choose your birth date'}
        </ThemedText>
        <ThemedText style={{ color: c.accent }}>{pickerOpen ? 'Done' : 'Edit'}</ThemedText>
      </Pressable>
      {pickerOpen && (
        <DateTimePicker
          value={birth ?? DEFAULT_PICK}
          mode="date"
          display="spinner"
          style={styles.picker}
          maximumDate={new Date()}
          minimumDate={OLDEST}
          themeVariant={scheme === 'dark' ? 'dark' : 'light'}
          onChange={(_, date) => {
            if (date) setBirth(date);
          }}
        />
      )}

      <SectionTitle>{units === 'imperial' ? 'Height (inches, or 5\'10)' : 'Height (cm)'}</SectionTitle>
      <TextInput
        style={input}
        value={height}
        onChangeText={setHeight}
        placeholder={units === 'imperial' ? "e.g. 70 or 5'10" : 'e.g. 178'}
        placeholderTextColor={c.subtext}
        keyboardType="numbers-and-punctuation"
      />

      <Card style={styles.athlete}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.athleteTitle}>Athlete mode</ThemedText>
          <ThemedText subtle style={styles.athleteText}>
            Uses a different body fat curve. Turn on if you train hard and have a lean build.
          </ThemedText>
        </View>
        <Switch value={athlete} onValueChange={setAthlete} />
      </Card>

      {errors.map((e) => (
        <ThemedText key={e} style={{ color: c.danger }}>
          {e}
        </ThemedText>
      ))}

      <Button title="Save profile" onPress={save} style={styles.button} />
      <SectionTitle>Beurer scale user</SectionTitle>
      {pairing && (
        <Card style={styles.athlete}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.athleteTitle}>
              {pairing.linked ? `Linked to user ${pairing.userIndex}` : `Registered as user ${pairing.userIndex}`}
            </ThemedText>
            <ThemedText subtle style={styles.athleteText}>
              {pairing.linked
                ? 'Weigh-ins and stored history for this user are read from the scale.'
                : 'This phone holds this slot on your scale. Resetting forgets it here but does not free the slot.'}
            </ThemedText>
          </View>
          <Button
            title={pairing.linked ? 'Unlink' : 'Reset'}
            variant="secondary"
            onPress={() => {
              clearBeurerPairing();
              setPairing(null);
            }}
            style={styles.resetButton}
          />
        </Card>
      )}
      <ThemedText subtle style={styles.athleteText}>
        Already use the Beurer app? Enter the user number and PIN from the app to read that user&apos;s weigh-ins and the
        history stored on the scale, instead of registering a new user.
      </ThemedText>
      <View style={styles.linkRow}>
        <TextInput
          style={[...input, styles.linkInput]}
          value={linkSlot}
          onChangeText={setLinkSlot}
          placeholder="User (1-8)"
          placeholderTextColor={c.subtext}
          keyboardType="number-pad"
          maxLength={1}
        />
        <TextInput
          style={[...input, styles.linkInput]}
          value={linkPin}
          onChangeText={setLinkPin}
          placeholder="PIN"
          placeholderTextColor={c.subtext}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />
        <Button
          title="Link"
          variant="secondary"
          onPress={() => {
            const r = parseSlotLink(linkSlot, linkPin);
            if (!r.ok) return setLinkError(r.error);
            const p = { userIndex: r.userIndex, consentCode: r.consentCode, linked: true };
            saveBeurerPairing(p);
            setPairing(p);
            setLinkSlot('');
            setLinkPin('');
            setLinkError(null);
          }}
          style={styles.resetButton}
        />
      </View>
      {linkError && <ThemedText style={{ color: c.danger }}>{linkError}</ThemedText>}
      {beurerSlot !== null && (
        <Card style={styles.athlete}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.athleteTitle}>Accept any scale user</ThemedText>
            <ThemedText subtle style={styles.athleteText}>
              Take weigh-ins the Beurer scale files under another user, such as the one from the Beurer app. Leave off if others use the scale.
            </ThemedText>
          </View>
          <Switch value={anyUser} onValueChange={setBeurerAnyUser} />
        </Card>
      )}
      <Button title="Scale capture (debug)" variant="secondary" onPress={() => router.push('/capture')} style={styles.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  segment: { flexDirection: 'row', gap: 10 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, fontSize: 17 },
  // The iOS spinner has a fixed width and sits at the left edge unless centred.
  picker: { alignSelf: 'center' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  athlete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  athleteTitle: { fontSize: 17, fontWeight: '600' },
  athleteText: { fontSize: 13 },
  button: { flex: 0, marginTop: 8 },
  resetButton: { flex: 0, paddingHorizontal: 16 },
  linkRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  linkInput: { flex: 1 },
});
