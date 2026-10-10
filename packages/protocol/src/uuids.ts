const UUID_PREFIX = '59e5';
const UUID_SUFFIX = '-3be2-4d9c-9607-646ddb5d9770';

function fidgetUuid(shortId: string): string {
  return `${UUID_PREFIX}${shortId}${UUID_SUFFIX}`;
}

export const FIDGET_SERVICE_UUID = fidgetUuid('0001');

export const FidgetCharacteristicUuid = {
  input: fidgetUuid('0002'),
  command: fidgetUuid('0003'),
  message: fidgetUuid('0004'),
  info: fidgetUuid('0005'),
} as const;
export type FidgetCharacteristic = keyof typeof FidgetCharacteristicUuid;
