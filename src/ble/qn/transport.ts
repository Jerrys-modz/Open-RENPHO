/**
 * react-native-ble-plx glue for QN scales. Everything protocol-related lives
 * in session.ts; this file only scans, connects and shuttles bytes.
 */
import type { Device, Subscription } from 'react-native-ble-plx';
import type { UserProfile } from '@/domain/profile';
import { base64ToBytes, bytesToBase64 } from '../base64';
import { getBleManager } from '../manager';
import { COMMAND_CHAR, NOTIFY_CHAR, SERVICE_FFF0 } from './protocol';
import { QnSession, type QnSessionOptions, type WeighIn } from './session';

export interface WeighInHandlers {
  onStatus: (status: string) => void;
  onLiveWeight: (kg: number) => void;
  onWeighIn: (w: WeighIn) => void;
  onError: (message: string) => void;
  profile?: QnSessionOptions['profile'];
  /** The user's own profile, for scales that store it (Beurer). */
  userProfile?: UserProfile | null;
  /** Protocol chatter for an on-screen debug log (Beurer). */
  onDebug?: (line: string) => void;
}

export class QnScaleConnection {
  private manager = getBleManager();
  private device: Device | null = null;
  private subscription: Subscription | null = null;
  private stopped = false;

  /** Scan for a QN scale, connect, and run one weigh-in. Step on the scale to wake it. */
  start(h: WeighInHandlers): void {
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
      this.scan(h);
    }, true);
  }

  private scan(h: WeighInHandlers): void {
    h.onStatus('Scanning… step on the scale');
    this.manager.startDeviceScan([SERVICE_FFF0], null, (error, device) => {
      if (error) return h.onError(error.message);
      if (!device || this.stopped) return;
      this.manager.stopDeviceScan();
      void this.connectDevice(device, h);
    });
  }

  /** Connects to a scale that was already found by a scan, and runs one weigh-in. */
  async connectDevice(found: Device, h: WeighInHandlers): Promise<void> {
    try {
      h.onStatus(`Connecting to ${found.name ?? found.id}…`);
      const device = await found.connect();
      this.device = device;
      await device.discoverAllServicesAndCharacteristics();

      const write = async (bytes: Uint8Array) => {
        const b64 = bytesToBase64(bytes);
        try {
          await device.writeCharacteristicWithResponseForService(SERVICE_FFF0, COMMAND_CHAR, b64);
        } catch {
          await device.writeCharacteristicWithoutResponseForService(SERVICE_FFF0, COMMAND_CHAR, b64);
        }
      };

      const session = new QnSession({
        write,
        profile: h.profile,
        onLiveWeight: h.onLiveWeight,
        onWeighIn: (w) => {
          h.onStatus('Done');
          h.onWeighIn(w);
        },
        onWarning: (m) => console.warn('[qn]', m),
      });

      this.subscription = device.monitorCharacteristicForService(
        SERVICE_FFF0,
        NOTIFY_CHAR,
        (error, characteristic) => {
          if (error) {
            if (!this.stopped) h.onError(error.message);
            return;
          }
          if (characteristic?.value) session.handleNotification(base64ToBytes(characteristic.value));
        },
      );
      h.onStatus('Connected. Stay on the scale…');
    } catch (e) {
      h.onError(e instanceof Error ? e.message : String(e));
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

  destroy(): void {
    void this.stop();
  }
}
