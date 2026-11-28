# Using your devices

Bluetooth does not work in the iOS simulator, so use a real iPhone. The first time you connect anything, iOS asks for Bluetooth permission: allow it.

Before anything else, open the profile screen (top right) and fill in your sex, birth date and height. Without these Keel can show weight but cannot work out body fat and the body metrics derived from it.

## RENPHO ES-CS20M scale

1. Open **Weigh in** and tap **Start weigh-in**. The status line says it is scanning.
2. Step on the scale. It only advertises while someone is standing on it.
3. Stay on until the reading locks. The result is saved to your history automatically.

Keel handles both versions of this scale by itself: one you connect to (it reports weight and impedance) and a broadcast-only one that sends weight in its advertisements (FCC ID `2APXUES-CS20M`, no impedance). If your scale is an `ESCS20MB1` or `ESCS20MB2`, it is not supported.

**Body composition.** If the scale sends body fat or impedance, Keel uses it. Otherwise body fat and the rest are estimated from your weight and profile. Treat them as estimates; they can differ from RENPHO's own app.

## Beurer BF720 scale

1. Open **Weigh in** and step on the scale, as above. The first time, Keel registers itself as a user on the scale (it has 8 slots) and remembers the slot on your phone.
2. Weigh-ins from that user are saved automatically, and the scale hands over any readings it stored.

**Already use the Beurer app?** On the profile screen, under **Beurer scale user**, enter the user number (1-8) and the PIN from the Beurer app and tap **Link**. Keel then reads that user's weigh-ins and stored history instead of registering a new slot. **Unlink** (or **Reset** for a slot Keel registered) forgets it on the phone only; it does not free the slot on the scale.

**Readings filed under another user.** The scale files a weigh-in under whichever user it recognises. If others use the scale and you want yours only, leave **accept any user** off. If your readings land under a different user (for example the one from the Beurer app), turn it on.

## RENPHO RF-BMF01 tape measure

1. Open **Measure**, tap **Connect tape**, and wake the tape by pulling it out.
2. Choose the body site (waist, hips, chest, neck, bicep, thigh or calf) from the row of icons.
3. Wrap the tape, and press the **checkmark** button on the tape to save the reading to that site.

The tape drops its connection after roughly 20 to 45 seconds. Tap **Connect tape** again for the next measurement.

## iHealth KN-550BT blood-pressure cuff

*New, and not yet field-tested. Only the current firmware is supported.*

1. Take a measurement. The cuff stores it (it holds up to 99).
2. Press the cuff's **Bluetooth** button. It is visible to the phone for only about ten seconds.
3. Open **Blood pressure** and tap **Sync from cuff** right away.

Keel pairs, sets the cuff's clock to the phone's time, and downloads the stored readings. Readings you already have are not saved twice. Each reading stores systolic, diastolic and pulse, plus an irregular-pulse and a movement flag when the cuff set them.

The **clear the cuff after importing** switch is off by default. When on, the cuff's memory is cleared only after every reading has been downloaded and saved in Keel. It cannot be undone.

**Which arm, sitting or standing, and a note.** The cuff does not know, so you tell Keel. On the **Blood pressure** screen, under *How you usually measure*, pick your usual arm (left or right) and position (sitting, standing, lying or reclining). They are applied to the new readings each sync imports. To correct a single reading, open **History**, tap **Edit** on it, and change its arm or position, or type a note (up to 500 characters, for example "after coffee"). A sync never overwrites a reading you already corrected, even though the cuff sends everything it holds again. Leave a field on *Not set* to record nothing.

**Chart and averages.** The Blood pressure screen charts systolic and diastolic together, with the space between them shaded. Choose 7 days, 30 days, 90 days or All; the window ends at your newest reading. Press and drag on the chart to read a single reading. Below it are 7 and 30 day averages and the 30 day averages for readings before noon and from noon on (by the phone's clock).

**A report for your doctor.** *Share report for your doctor* makes a PDF for the chosen period, with the summary (average, before-noon and noon-onward averages, highest and lowest, how many readings fall in each category) and a table of every reading with its arm, position, flags and notes. It is made on the phone and opens the iOS share sheet; nothing is uploaded. The pressures use your display unit (mmHg or kPa).

The overview card shows a category for the latest reading (2017 ACC/AHA adult guidelines) and 7 and 30 day averages ending at your newest reading. This is for information only and is not medical advice.

## Goals

Open the profile screen and tap **Goals**.

- **Target weight.** Enter a weight in your display units. Keel counts progress from your latest weight at the moment you save, so the Overview card shows how much of the way you are and how much is left, for losing or gaining. Saving again starts progress from your then-current weight. Leave the field empty for no goal.
- **Blood-pressure target.** Turn it on and set the systolic and diastolic numbers readings should be below (130 and 80 by default, the usual adult target; ask your doctor what is right for you). The Blood pressure screen then shows how many of the readings in the 30 days up to your newest one were below both numbers. Targets are entered in mmHg.

Goals stay on your phone and are never synced.

## Units

On the profile screen you can choose lb/in or kg/cm, and mmHg or kPa for blood pressure. This changes the display only. Everything is stored in kg, cm and mmHg, and syncs and CSV exports use those units.

## History, deleting and exporting

**History** lists every saved reading, newest first. **Delete** removes it from Keel only; anything already sent to Apple Health or SparkyFitness stays there. **Export CSV** shares one file with every measurement, oldest first, in kg, cm and mmHg. A blood-pressure reading's arm and position appear as their own rows (`bp_arm` with the side in the `site` column, `bp_position` likewise), sharing the reading's time.
