// backend/utils/deviceStore.js
// Shared in-memory store for scanned BLE devices

let scannedDevices = [];

const updateScannedDevice = (deviceData) => {
  const { permanentId } = deviceData;
  const index = scannedDevices.findIndex(d => d.permanentId === permanentId);

  if (index !== -1) {
    scannedDevices[index] = { ...deviceData, lastSeen: new Date() };
  } else {
    scannedDevices.push({ ...deviceData, lastSeen: new Date() });
  }

  // Cleanup: Keep only recently seen devices (e.g. within last 10 seconds)
  const now = Date.now();
  scannedDevices = scannedDevices.filter(d => (now - new Date(d.lastSeen).getTime()) < 10000);
};

const getScannedDevices = () => {
  const now = Date.now();
  // Return only devices seen in the last 10 seconds
  return scannedDevices.filter(d => (now - new Date(d.lastSeen).getTime()) < 10000);
};

module.exports = {
  updateScannedDevice,
  getScannedDevices
};
