# Getting a build onto your iPhone (TestFlight)

Everything runs in Expo's cloud (EAS), so no Mac or Xcode is needed. Internal TestFlight
testing needs no Beta App Review; builds show up a few minutes after they finish processing.
Testers must be on your App Store Connect team. Release builds bundle the JS, so no Metro
server is needed. Based on the OpenRing setup.

**Bluetooth does not work in the simulator or in Expo Go, so test the scale and tape from a
real build.**

## One-time setup

1. **Pick the bundle ID.** `ios.bundleIdentifier` in `app.json` (currently
   `com.jerrysmodz.openrenpho`, a placeholder) must be unique to you. Change it before the
   first build; EAS registers it as an App ID on your developer team.
2. **Log in to EAS and link the project** (needs Node on any computer, even a phone-less
   Linux/Windows one):
   ```bash
   npm install && npm i -g eas-cli
   eas login
   eas init            # adds extra.eas.projectId to app.json; commit that change
   ```
3. **Let EAS create your signing credentials** (once, interactively; sign in with your Apple ID
   when prompted). EAS makes the distribution certificate and App Store provisioning profile:
   ```bash
   eas credentials --platform ios
   ```
   Or run `eas build --platform ios --profile testflight` once and accept the prompts.
4. **Create the app record** in App Store Connect → Apps → + → New App: platform iOS, a name
   that isn't taken, your bundle ID (it appears in the dropdown once step 3 has registered
   it), any SKU (e.g. `open-renpho`), user access Full. Copy the numeric *Apple ID* from
   App Information (the "ASC app id") and add it to `eas.json` under
   `submit.testflight.ios` as `"ascAppId": "<id>"`. Without it, non-interactive submits fail.
5. **For building from GitHub Actions:** create an access token at expo.dev → Account settings →
   Access tokens, and add it to this repo as the secret `EXPO_TOKEN`
   (Settings → Secrets and variables → Actions).

## Each release

From a terminal:
```bash
npm run build:testflight    # cloud build, build number auto-incremented
npm run submit:testflight   # uploads the latest build to App Store Connect
# or both in one go:
eas build --platform ios --profile testflight --auto-submit
```
Or from GitHub: Actions → *EAS build (manual)* → Run workflow → profile `testflight`,
tick *submit*. It runs typecheck, lint and tests first so a broken build doesn't use a cloud
build.

Wait for processing (App Store Connect → TestFlight → iOS Builds). If it shows "Missing
Compliance", the app already declares `ITSAppUsesNonExemptEncryption: false`, so it should
pass automatically.

## Add testers

App Store Connect → TestFlight → Internal Testing → + → create a group (e.g. "Me") → tick
*Enable automatic distribution* → add yourself. Install the TestFlight app on your iPhone,
sign in with the same Apple ID, and install Open RENPHO.

## Faster iteration: a development build

A development build (`npm run build:device`, profile `development`) installs through a QR
code/link instead of TestFlight and connects to `npx expo start --dev-client`, so JS changes
show up without a new build. The first install needs your device registered with
`eas device:create`.

## Notes

- Builds expire after 90 days; upload a new one.
- Internal testing needs no privacy policy URL or beta description. External testers and
  public release do.
- The app asks for Bluetooth permission on first use; the text is set in `app.json`.
- HealthKit is not in the app yet. When it is added, the App ID needs the HealthKit capability
  and the provisioning profile must be regenerated (EAS does this when it can sign in to
  Apple; run `eas credentials` interactively if a non-interactive build can't).

## Apple Health

The app uses HealthKit (write only). The config plugin adds the `com.apple.developer.healthkit`
entitlement, and EAS Build enables the HealthKit capability on the App ID when it signs the build, so no
manual Apple Developer step is normally needed. **HealthKit needs a native rebuild**: an existing
TestFlight or development build will not have it, so run a new EAS build before testing Sync. If the build
fails with a provisioning error about HealthKit, enable HealthKit on the App ID in the Apple Developer
portal and rebuild.
