export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleKovaDevices: MatrixManagedDeviceInfo[];
  currentKovaDevices: MatrixManagedDeviceInfo[];
};

const KOVA_DEVICE_NAME_PREFIX = "Kova ";

export function isKovaManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(KOVA_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const kovaDevices = devices.filter((device) => isKovaManagedMatrixDevice(device.displayName));
  return {
    currentDeviceId,
    staleKovaDevices: kovaDevices.filter((device) => !device.current),
    currentKovaDevices: kovaDevices.filter((device) => device.current),
  };
}
