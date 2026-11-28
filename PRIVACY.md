# Privacy policy

*Effective 24 November 2026.*

Keel is built so that your health data stays with you. In short: **there is no Keel account, no Keel server, no analytics and no advertising. The developer receives no data from the app.**

## What Keel stores

Everything below is kept on your phone, in the app's private storage:

- your measurements (weight, body composition, tape measurements, blood pressure, pulse) and, for blood pressure, the arm, position and note you record,
- your profile (sex, birth date, height, athlete mode), your goals and display settings, and if you add more people, their names and each person's own data,
- sync bookkeeping (which readings were already sent, so none are sent twice),
- the Beurer scale user slot and PIN, if you use that scale,
- your SparkyFitness server address, if you connect one. The API key is stored in the iOS keychain.

Deleting the app deletes this data (keychain entries may remain until iOS clears them; disconnecting Sparky in the app removes the key first).

## Bluetooth

Keel uses Bluetooth to find and read your scale, tape measure and blood-pressure cuff. While scanning, the app can see advertisements from other nearby Bluetooth devices, but it only acts on the supported devices. It does not store or send anything about the others. Bluetooth is never used to contact the device makers.

## Apple Health

If you turn it on, Keel **writes** the first person's measurements to Apple Health (weight, body fat, lean mass, BMI, waist, blood pressure and heart rate). A blood-pressure entry also carries the arm and position you recorded, as metadata. It does **not read** anything from Apple Health. You choose what Keel may write in the permission sheet and can change it any time in the Health app under *Sharing → Apps → Keel*. Once data is in Apple Health, Apple's policies and your Health settings apply to it.

## SparkyFitness (optional)

If you connect a SparkyFitness server, Keel sends your readings (values, dates and times, and for blood pressure the arm, position and note you recorded) and your API key to **the server address you entered**, which you or someone you trust runs. That server's operator can see the data. Keel contacts no other server. Disconnecting stops all sending.

## Exporting

*History → Export CSV* creates a file of all your measurements, and *Share report for your doctor* on the blood-pressure screen creates a PDF of your readings. Both are made on your phone and open the iOS share sheet. Where they go is up to you.

## Children

Keel is not directed at children and does not knowingly collect any data from anyone.

## Medical disclaimer

Keel is not a medical device and gives no medical advice. Body-composition values are partly estimated, and blood-pressure categories follow published guidelines for information only. Talk to a doctor about your health.

## Changes and contact

If this policy changes, the new version will be in this file with a new date. Questions: open an issue at the project's GitHub repository.
