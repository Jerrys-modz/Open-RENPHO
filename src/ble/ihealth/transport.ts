/**
 * react-native-ble-plx glue for the iHealth KN-550BT. Protocol logic lives in session.ts; this file
 * scans, connects, subscribes and writes. Not verified on hardware yet (docs/protocol/ihealth-kn550bt.md).
 */
import type { Device, Subscription } from 'react-native-ble-plx';
import { base64ToBytes, bytesToBase64 } from '../base64';
import { getBleManager } from '../manager';
import { EXPECTED_MODEL, MODEL_UUID, NOTIFY_UUID, SERVICE_UUID, WRITE_UUID, type CuffReading } from './protocol';
import { IHealthSession } from './session';

const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const SUBSCRIBE_SETTLE_MS = 600;

export interface CuffHandlers {
  onStatus: (status: string) => void;
  /**
   * Called with everything the cuff held, before anything is deleted. Must store the readings
   * synchronously or throw: a resolved promise is taken to mean they are safe.
   */
  onReadings: (readings: CuffReading[]) => void | Promise<void>;
  onBattery?: (percent: number) => void;
  onDone: (summary: { imported: number; deleted: boolean }) => void;
  onError: (message: string) => void;
  /** Clear the cuff's memory after a complete download has been saved. Off unless the user asks. */
  deleteAfterImport: boolean;
}

// The challenge only has to be unpredictable enough to stop a replayed answer; Hermes may lack crypto.
const randomBytes = (n: number): Uint8Array => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));

export class CuffConnection {
  private manager = getBleManager();
  private device: Device | null = null;
  private subscription: Subscription | null = null;
  private stopped = false;

  /** Scans for the cuff. It advertises for about 10 s after a measurement, or when you press its Bluetooth button. */
  start(h: CuffHandlers): void {
    this.stopped = false;
    h.onStatus('Waiting for Bluetooth…');
    const stateSub = this.manager.onStateChange((state) => {
      if (state !== 'PoweredOn') {
        if (state === 'PoweredOff' || state === 'Unauthorized') {
          h.onError(`Bluetooth is ${state === 'Unauthorized' ? 'not permitted' : 'off'}.`);
        }
        return;
      }
      stateSub.remove();
      h.onStatus('Looking for your cuff… press its Bluetooth button');
      this.manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
        if (error) return h.onError(error.message);
        if (!device || this.stopped) return;
        this.manager.stopDeviceScan();
        void this.run(device, h);
      });
    }, true);
  }

  private async run(found: Device, h: CuffHandlers): Promise<void> {
    try {
      h.onStatus('Connecting…');
      const device = await found.connect();
      this.device = device;
      await device.discoverAllServicesAndCharacteristics();

      // com.jiuan.dev is shared with other iHealth products, so check what we connected to.
      try {
        const model = base64ToBytes((await device.readCharacteristicForService(DEVICE_INFO_SERVICE, MODEL_UUID)).value ?? '');
        const name = String.fromCharCode(...model).replace(/\0+$/, '');
        if (name && name !== EXPECTED_MODEL) throw new Error(`This is a ${name}; only the ${EXPECTED_MODEL} is supported.`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('This is')) throw e;
        console.warn('[ihealth] could not read model', e);
      }

      const session = new IHealthSession({
        write: (b) => device.writeCharacteristicWithoutResponseForService(SERVICE_UUID, WRITE_UUID, bytesToBase64(b)).then(() => undefined),
        random: randomBytes,
      });
      this.subscription = device.monitorCharacteristicForService(SERVICE_UUID, NOTIFY_UUID, (error, c) => {
        if (error) {
          if (!this.stopped) h.onError(error.message);
          return;
        }
        if (c?.value) session.handleNotification(base64ToBytes(c.value));
      });
      await new Promise((r) => setTimeout(r, SUBSCRIBE_SETTLE_MS));
      if (this.stopped) return;

      h.onStatus('Pairing…');
      await session.authenticate();
      await session.setClock();
      try {
        h.onBattery?.(await session.battery());
      } catch (e) {
        console.warn('[ihealth] battery read failed', e);
      }

      h.onStatus('Reading stored measurements…');
      const download = await session.readReadings();
      if (this.stopped) return;
      if (download.readings.length > 0) await h.onReadings(download.readings);

      // Deleting after a partial download would lose readings we never saw.
      let deleted = false;
      if (h.deleteAfterImport && download.complete && download.readings.length > 0) {
        await session.deleteReadings();
        deleted = true;
      } else if (h.deleteAfterImport && !download.complete) {
        console.warn('[ihealth] download incomplete; leaving readings on the cuff');
      }
      h.onDone({ imported: download.readings.length, deleted });
      await this.stop();
    } catch (e) {
      if (!this.stopped) h.onError(e instanceof Error ? e.message : String(e));
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.manager.stopDeviceScan();
    this.subscription?.remove();
    this.subscription = null;
    try {
      await this.device?.cancelConnection();
    } catch {
      // already disconnected
    }
    this.device = null;
  }
}
