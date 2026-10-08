/**
 * react-native-ble-plx glue for the RENPHO tape (advertises as "ES-Tape").
 * Protocol parsing lives in protocol.ts.
 *
 * The tape advertises no service UUID, so we match on its name. It drops the
 * connection after ~20-45 s of idle, so we reconnect while `start()`ed.
 */
import type { Device, Subscription } from 'react-native-ble-plx';
import { base64ToBytes } from '../base64';
import { getBleManager } from '../manager';
import {
  TAPE_LOCAL_NAME,
  TAPE_NOTIFY_CHAR,
  TAPE_SERVICE,
  lengthCm,
  parseTapeFrame,
  type TapeFrame,
} from './protocol';

export type TapeReading = Extract<TapeFrame, { kind: 'reading' }>;

export interface TapeHandlers {
  onStatus: (status: string) => void;
  /** Every recognised or unrecognised notification, as text, for debugging. */
  onRaw?: (text: string) => void;
  /** Length in cm for every reading frame (live and save). */
  onLength: (cm: number, reading: TapeReading) => void;
  /** The checkmark button was pressed (an "S" frame). */
  onSave: (cm: number, reading: TapeReading) => void;
  onError: (message: string) => void;
}

export class TapeConnection {
  private manager = getBleManager();
  private device: Device | null = null;
  private subscription: Subscription | null = null;
  private disconnectSub: Subscription | null = null;
  private active = false;
  private connecting = false;
  private wasSaving = false;
  private handlers: TapeHandlers | null = null;

  start(h: TapeHandlers): void {
    this.handlers = h;
    this.active = true;
    h.onStatus('Waiting for Bluetooth…');
    const stateSub = this.manager.onStateChange((state) => {
      if (state === 'PoweredOff' || state === 'Unauthorized') {
        h.onError(`Bluetooth is ${state === 'Unauthorized' ? 'not permitted' : 'off'}.`);
        return;
      }
      if (state !== 'PoweredOn') return;
      stateSub.remove();
      this.scan();
    }, true);
  }

  private scan(): void {
    const h = this.handlers;
    if (!h || !this.active) return;
    h.onStatus('Scanning… wake the tape by pulling it out');
    this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) return h.onError(error.message);
      if (!device || !this.active || this.connecting) return;
      if ((device.localName ?? device.name) !== TAPE_LOCAL_NAME) return;
      this.connecting = true;
      this.manager.stopDeviceScan();
      void this.connect(device);
    });
  }

  private async connect(found: Device): Promise<void> {
    const h = this.handlers;
    if (!h) {
      this.connecting = false;
      return;
    }
    try {
      h.onStatus('Connecting…');
      const device = await found.connect();
      this.device = device;
      await device.discoverAllServicesAndCharacteristics();

      this.disconnectSub = device.onDisconnected(() => {
        this.cleanupConnection();
        if (this.active) {
          h.onStatus('Tape went to sleep. Wake it to reconnect…');
          this.scan();
        }
      });

      this.wasSaving = false;
      this.subscription = device.monitorCharacteristicForService(
        TAPE_SERVICE,
        TAPE_NOTIFY_CHAR,
        (error, characteristic) => {
          if (error) {
            if (this.active) h.onError(error.message);
            return;
          }
          if (characteristic?.value) this.onNotification(base64ToBytes(characteristic.value));
        },
      );
      h.onStatus('Connected. Measure with the tape; press ✓ to save.');
    } catch (e) {
      h.onError(e instanceof Error ? e.message : String(e));
    } finally {
      this.connecting = false;
    }
  }

  private onNotification(bytes: Uint8Array): void {
    const h = this.handlers;
    if (!h) return;
    h.onRaw?.(Array.from(bytes, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, '0')}`)).join(''));
    const frame = parseTapeFrame(bytes);
    if (!frame || frame.kind !== 'reading') return;
    const cm = lengthCm(frame);
    h.onLength(cm, frame);
    // "S" frames last ~0.4 s and may repeat; fire once per press.
    if (frame.trigger === 'save') {
      if (!this.wasSaving) h.onSave(cm, frame);
      this.wasSaving = true;
    } else {
      this.wasSaving = false;
    }
  }

  private cleanupConnection(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.disconnectSub?.remove();
    this.disconnectSub = null;
    this.device = null;
  }

  async stop(): Promise<void> {
    this.active = false;
    this.manager.stopDeviceScan();
    const device = this.device;
    this.cleanupConnection();
    try {
      await device?.cancelConnection();
    } catch {
      // already disconnected
    }
  }
}
