/**
 * react-native-ble-plx glue for Beurer BF720 scales. Protocol logic lives in session.ts; this file
 * connects, subscribes, and writes. Not verified on hardware yet (see docs/protocol/beurer-bf720.md).
 */
import type { Device, Subscription } from 'react-native-ble-plx';
import { base64ToBytes, bytesToBase64 } from '../base64';
import { getBleManager } from '../manager';
import type { WeighInHandlers } from '../qn/transport';
import {
  CHAR_BODY_COMPOSITION_MEASUREMENT,
  CHAR_CURRENT_TIME,
  CHAR_DATE_OF_BIRTH,
  CHAR_GENDER,
  CHAR_HEIGHT,
  CHAR_USER_CONTROL_POINT,
  CHAR_WEIGHT_MEASUREMENT,
  SERVICE_BODY_COMPOSITION,
  SERVICE_CURRENT_TIME,
  SERVICE_USER_DATA,
  SERVICE_WEIGHT_SCALE,
  buildCurrentTime,
  buildDateOfBirth,
  buildGender,
  buildHeight,
} from './protocol';
import { BeurerSession, type BeurerPairing } from './session';

export interface BeurerStore {
  load: () => BeurerPairing | null;
  save: (p: BeurerPairing) => void;
  clear: () => void;
  acceptAnyUser: () => boolean;
}

/** Subscriptions are written asynchronously; give them a moment before the scale is introduced to us. */
const SUBSCRIBE_SETTLE_MS = 600;

export class BeurerConnection {
  private manager = getBleManager();
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];
  private session: BeurerSession | null = null;
  private stopped = false;

  constructor(private readonly store: BeurerStore) {}

  async connectDevice(found: Device, h: WeighInHandlers): Promise<void> {
    try {
      h.onStatus(`Connecting to ${found.name ?? 'your scale'}…`);
      const device = await found.connect();
      this.device = device;
      await device.discoverAllServicesAndCharacteristics();

      const writeB64 = async (service: string, char: string, bytes: Uint8Array): Promise<void> => {
        await device.writeCharacteristicWithResponseForService(service, char, bytesToBase64(bytes));
      };
      // Clock and profile writes are best effort: a failure must not block weighing.
      const tryWrite = async (service: string, char: string, bytes: Uint8Array | null) => {
        if (!bytes) return;
        try {
          await writeB64(service, char, bytes);
        } catch (e) {
          console.warn('[beurer] optional write failed', char, e);
        }
      };

      const session = new BeurerSession({
        pairing: this.store.load(),
        writeControlPoint: (b) => writeB64(SERVICE_USER_DATA, CHAR_USER_CONTROL_POINT, b),
        onPaired: (p) => this.store.save(p),
        onPairingRejected: () => this.store.clear(),
        acceptAnyUser: this.store.acceptAnyUser,
        onDebug: h.onDebug,
        onConsented: (p) => {
          void (async () => {
            const u = h.userProfile;
            await tryWrite(SERVICE_CURRENT_TIME, CHAR_CURRENT_TIME, buildCurrentTime(new Date()));
            if (u) {
              await tryWrite(SERVICE_USER_DATA, CHAR_HEIGHT, buildHeight(u.heightCm));
              await tryWrite(SERVICE_USER_DATA, CHAR_DATE_OF_BIRTH, buildDateOfBirth(u.birthDate));
              await tryWrite(SERVICE_USER_DATA, CHAR_GENDER, buildGender(u.sex));
            }
            if (!this.stopped) h.onStatus(`Ready (user ${p.userIndex}). Step on the scale`);
          })();
        },
        onWeighIn: h.onWeighIn,
        onStatus: h.onStatus,
        onError: (m) => {
          if (!this.stopped) h.onError(m);
        },
      });
      this.session = session;

      const watch = (service: string, char: string, on: (b: Uint8Array) => void) =>
        device.monitorCharacteristicForService(service, char, (error, c) => {
          if (error) {
            if (!this.stopped) h.onError(error.message);
            return;
          }
          if (c?.value) on(base64ToBytes(c.value));
        });

      // Indications must be on before consent or the stored reading is delivered to nobody.
      this.subscriptions = [
        watch(SERVICE_USER_DATA, CHAR_USER_CONTROL_POINT, (b) => session.handleControlPoint(b)),
        watch(SERVICE_WEIGHT_SCALE, CHAR_WEIGHT_MEASUREMENT, (b) => session.handleWeight(b)),
        watch(SERVICE_BODY_COMPOSITION, CHAR_BODY_COMPOSITION_MEASUREMENT, (b) => session.handleBodyComposition(b)),
      ];
      await new Promise((r) => setTimeout(r, SUBSCRIBE_SETTLE_MS));
      if (this.stopped) return;
      session.begin();
    } catch (e) {
      if (!this.stopped) h.onError(e instanceof Error ? e.message : String(e));
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.session?.destroy();
    this.session = null;
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
    try {
      await this.device?.cancelConnection();
    } catch {
      // already disconnected
    }
    this.device = null;
  }
}
