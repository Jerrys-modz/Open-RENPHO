import { base64ToBytes } from '../base64';
import { getBleManager } from '../manager';
import { COMPANY_ID, splitManufacturerData } from './protocol';
import { FrameRecorder } from './recorder';

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/**
 * Debug scanner: records every broadcast packet from one broadcast-only scale into a FrameRecorder,
 * so the capture screen can show and export them. Locks onto the first scale it sees.
 */
export class CaptureScanner {
  recorder = new FrameRecorder();
  mac: string | null = null;
  otherScaleFrames = 0;
  startedAt = 0;
  private active = false;
  private manager = getBleManager();

  get running(): boolean {
    return this.active;
  }

  reset(): void {
    this.recorder = new FrameRecorder();
    this.mac = null;
    this.otherScaleFrames = 0;
    this.startedAt = 0;
  }

  start(onStatus: (s: string) => void, onError: (m: string) => void): void {
    this.reset();
    this.active = true;
    onStatus('Waiting for Bluetooth…');
    const stateSub = this.manager.onStateChange((state) => {
      if (state === 'PoweredOff' || state === 'Unauthorized') {
        onError(`Bluetooth is ${state === 'Unauthorized' ? 'not permitted' : 'off'}.`);
        return;
      }
      if (state !== 'PoweredOn') return;
      stateSub.remove();
      if (!this.active) return;
      this.startedAt = Date.now();
      onStatus('Recording… do your weigh-in now');
      this.manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (error) return onError(error.message);
        if (!this.active || !device?.manufacturerData) return;
        const split = splitManufacturerData(base64ToBytes(device.manufacturerData));
        if (!split || split.companyId !== COMPANY_ID) return;
        const p = split.payload;
        if (p.length < 8 || p[0] !== 0xaa || p[1] !== 0xbb) return;
        const mac = Array.from(p.subarray(2, 8), hex2).join(':');
        this.mac ??= mac;
        if (mac !== this.mac) {
          this.otherScaleFrames++;
          return;
        }
        this.recorder.add(p, Date.now() - this.startedAt);
      });
    }, true);
  }

  stop(): void {
    this.active = false;
    this.manager.stopDeviceScan();
  }
}
