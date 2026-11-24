# Troubleshooting

## Bluetooth

**"Bluetooth is not permitted" or "off".** Turn Bluetooth on, and allow Keel under *Settings → Privacy & Security → Bluetooth* (or *Settings → Keel*).

**The scale is never found.** Scales only advertise while someone stands on them, so start the weigh-in first, then step on. Close the manufacturer's own app and any other app that may be connected: most of these devices accept one connection at a time. Move the phone close to the scale. Check which version of the ES-CS20M you have: the `ESCS20MB1` and `ESCS20MB2` revisions are not supported.

**The tape disconnects.** It drops the link after roughly 20 to 45 seconds. Tap **Connect tape** again.

**The cuff is not found.** The KN-550BT is visible for only about ten seconds after you press its Bluetooth button. Tap **Sync from cuff** immediately. Make sure the cuff's battery is not low (it reports an error when it is) and that the iHealth app is not connected to it. Only the current firmware is supported.

## Readings look wrong

**No body fat, or it looks off.** Check that your profile (sex, birth date, height) is filled in. Where the scale does not send body composition, Keel estimates it, so values can differ from the manufacturer's app. They are not medical measurements.

**Beurer readings are missing.** The scale files weigh-ins under the user it recognises. If you also use the Beurer app, link that user on the profile screen, or turn on **accept any user**. See [devices](devices.md).

**Cuff times are wrong.** Keel sets the cuff's clock to the phone's time at every sync, so new readings are right. A reading taken while the cuff's clock was wrong keeps that wrong time; Keel cannot correct it afterwards, but you can delete it in History.

**Units look odd.** Units on the profile screen change the display only. Values you export, or that sync to Health and Sparky, are always kg, cm and mmHg.

## Syncing

**Nothing shows up in Apple Health.** Check the permission under *Health → Sharing → Apps → Keel*, then tap **Sync now**. Only some metrics have a Health type (see [sync](sync.md)).

**SparkyFitness says the key was not accepted.** Make sure the key is current and has the `health_data_write` permission, and that the address starts with `https://`.

**Duplicates in Sparky.** If your Sparky server imports from Apple Health too, turn off one route. See [sync](sync.md).

## Data

**Where is my data?** In Keel's private storage on the phone only. **History → Export CSV** makes a copy you can keep.

**Start over.** Delete readings one by one in History, or delete the app. Anything already sent to Apple Health or Sparky must be removed there.

## Still stuck?

Open an issue and choose *Bug report*. Include the device model, iPhone model and iOS version, and what you saw. For a scale that Keel cannot read, the **Scale capture (debug)** button at the bottom of the profile screen records what the scale broadcasts during a weigh-in and shares a report you can attach.
