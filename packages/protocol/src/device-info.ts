import { createByteReader, createByteWriter } from './bytes';

/** The `info` characteristic, wire-faithful. See PROTOCOL.md "info". */
export interface DeviceInfo {
  readonly protocolVersion: number;
  readonly firmwareMajor: number;
  readonly firmwareMinor: number;
  readonly firmwarePatch: number;
  readonly deviceId: number;
  readonly capabilities: number;
  readonly newestRecordId: number;
  readonly storedRecordCount: number;
}

export function decodeDeviceInfo(bytes: Uint8Array): DeviceInfo {
  const r = createByteReader(bytes, 'device info');
  const info: DeviceInfo = {
    protocolVersion: r.u8(),
    firmwareMajor: r.u8(),
    firmwareMinor: r.u8(),
    firmwarePatch: r.u8(),
    deviceId: r.u32(),
    capabilities: r.u16(),
    newestRecordId: r.u32(),
    storedRecordCount: r.u16(),
  };
  r.expectEnd();
  return info;
}

export function encodeDeviceInfo(info: DeviceInfo): Uint8Array {
  return createByteWriter()
    .u8(info.protocolVersion, 'protocolVersion')
    .u8(info.firmwareMajor, 'firmwareMajor')
    .u8(info.firmwareMinor, 'firmwareMinor')
    .u8(info.firmwarePatch, 'firmwarePatch')
    .u32(info.deviceId, 'deviceId')
    .u16(info.capabilities, 'capabilities')
    .u32(info.newestRecordId, 'newestRecordId')
    .u16(info.storedRecordCount, 'storedRecordCount')
    .finish();
}
