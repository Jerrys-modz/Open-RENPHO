/**
 * One entry point for "weigh in", whichever supported scale you have:
 *  - broadcast-only (FCC ID 2APXUES-CS20M): weight arrives in advertisements, nothing to connect to;
 *  - connectable (FFF0 service): connect and run the QN handshake;
 *  - Beurer BF720: standard Weight Scale / Body Composition profiles after a user-slot handshake.
 * A single scan watches for both.
 */
import type { Device } from 'react-native-ble-plx';
import { getBeurerAnyUser } from '@/storage/useSettings';
import { clearBeurerPairing, loadBeurerPairing, saveBeurerPairing } from '@/storage/beurerPairing';
import { AabbSession } from '../aabb/session';
import { BeurerConnection } from '../beurer/transport';
import { base64ToBytes } from '../base64';
import { getBleManager } from '../manager';
import { SERVICE_FFF0 } from '../qn/protocol';
import { QnScaleConnection, type WeighInHandlers } from '../qn/transport';

export type { WeighInHandlers };

export class ScaleConnection {
  private manager = getBleManager();
  private qn = new QnScaleConnection();
  private beurer = new BeurerConnection({
    load: loadBeurerPairing,
    save: saveBeurerPairing,
    clear: clearBeurerPairing,
    acceptAnyUser: getBeurerAnyUser,
  });
  private active = false;
  private connecting = false;

  start(h: WeighInHandlers): void {
    this.active = true;
    h.onStatus('Waiting for Bluetooth…');
    const stateSub = this.manager.onStateChange((state) => {
      if (state === 'PoweredOff' || state === 'Unauthorized') {
        h.onError(`Bluetooth is ${state === 'Unauthorized' ? 'not permitted' : 'off'}.`);
        return;
      }
      if (state !== 'PoweredOn') return;
      stateSub.remove();
      this.scan(h);
    }, true);
  }

  private scan(h: WeighInHandlers): void {
    if (!this.active) return;
    h.onStatus('Scanning… step on the scale');
    const aabb = new AabbSession({
      onLiveWeight: h.onLiveWeight,
      onWeighIn: (w) => {
        h.onStatus('Done');
        h.onWeighIn(w);
      },
    });
    // Duplicates must be allowed: the broadcast scale reports by repeating its advertisement.
    this.manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) return h.onError(error.message);
      if (!device || !this.active) return;

      if (device.manufacturerData && aabb.handleManufacturerData(base64ToBytes(device.manufacturerData))) return;

      if (this.connecting) return;
      if (this.advertisesQnService(device)) {
        this.connecting = true;
        this.manager.stopDeviceScan();
        void this.qn.connectDevice(device, h);
      } else if (isBeurerScale(device)) {
        this.connecting = true;
        this.manager.stopDeviceScan();
        void this.beurer.connectDevice(device, h);
      }
    });
  }

  private advertisesQnService(device: Device): boolean {
    return (device.serviceUUIDs ?? []).some((u) => u.toLowerCase() === SERVICE_FFF0);
  }

  async stop(): Promise<void> {
    this.active = false;
    this.manager.stopDeviceScan();
    await this.qn.stop();
    await this.beurer.stop();
  }

  destroy(): void {
    void this.stop();
  }
}

/** The BF720 advertises as "BF720" with the Weight Scale service; the name keeps other 0x181D scales out. */
export function isBeurerScale(device: Pick<Device, 'name' | 'localName'>): boolean {
  return /^(bf\s?720|beurer)/i.test(device.localName ?? device.name ?? '');
}
