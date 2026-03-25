// BLE Detection utility
// Note: BLE scanning requires platform-specific libraries
// For Windows/Linux: @abandonware/noble (optional dependency)
// For production, you might want to use a separate service or hardware gateway

let noble = null;
try {
  noble = require('@abandonware/noble');
} catch (error) {
  console.warn('BLE library (@abandonware/noble) not available. BLE scanning will be disabled.');
  console.warn('For Windows: Install Visual Studio Build Tools with C++ workload');
  console.warn('For development: BLE verification will be simulated');
}

class BLEDetector {
  constructor() {
    this.isScanning = false;
    this.detectedDevices = new Map();
    this.scanTimeout = null;
  }

  /**
   * Initialize BLE adapter
   */
  async initialize() {
    if (!noble) {
      throw new Error('BLE library not available. Install @abandonware/noble or use simulation mode.');
    }

    return new Promise((resolve, reject) => {
      if (noble.state === 'poweredOn') {
        resolve();
        return;
      }

      noble.on('stateChange', (state) => {
        if (state === 'poweredOn') {
          resolve();
        } else {
          reject(new Error(`BLE adapter not ready. State: ${state}`));
        }
      });
    });
  }

  /**
   * Start scanning for BLE devices
   * @param {Number} duration - Scan duration in milliseconds (default: 10000)
   * @returns {Promise<Array>} - Array of detected device IDs
   */
  async scanForDevices(duration = 10000) {
    if (!noble) {
      // Simulation mode for development
      console.warn('BLE library not available. Returning simulated devices.');
      return [
        { id: 'sim-device-1', name: 'Simulated Device 1', rssi: -75, address: 'AA:BB:CC:DD:EE:FF' },
        { id: 'sim-device-2', name: 'Simulated Device 2', rssi: -85, address: '11:22:33:44:55:66' }
      ];
    }

    return new Promise((resolve, reject) => {
      if (this.isScanning) {
        return reject(new Error('Scan already in progress'));
      }

      this.detectedDevices.clear();
      this.isScanning = true;

      const discoveredDevices = [];

      noble.on('discover', (peripheral) => {
        const deviceId = peripheral.id || peripheral.address;
        const rssi = peripheral.rssi;
        
        discoveredDevices.push({
          id: deviceId,
          name: peripheral.advertisement.localName || 'Unknown',
          rssi: rssi,
          address: peripheral.address
        });

        this.detectedDevices.set(deviceId, {
          id: deviceId,
          name: peripheral.advertisement.localName || 'Unknown',
          rssi: rssi,
          address: peripheral.address,
          timestamp: Date.now()
        });
      });

      noble.startScanning([], true);

      this.scanTimeout = setTimeout(() => {
        this.stopScanning();
        resolve(Array.from(this.detectedDevices.values()));
      }, duration);
    });
  }

  /**
   * Stop scanning
   */
  stopScanning() {
    if (this.isScanning && noble) {
      noble.stopScanning();
      this.isScanning = false;
      
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
        this.scanTimeout = null;
      }
    }
  }

  /**
   * Check if a specific device is nearby
   * @param {String} deviceId - BLE device ID to check
   * @param {Number} scanDuration - How long to scan (default: 5000ms)
   * @param {Number} minRssi - Minimum RSSI threshold (default: -90)
   * @returns {Promise<Object>} - Device detection result
   */
  async isDeviceNearby(deviceId, scanDuration = 5000, minRssi = -90) {
    try {
      // Simulation mode: If BLE library not available, simulate device detection
      if (!noble) {
        console.warn('BLE library not available. Simulating device detection.');
        // In simulation mode, accept any device ID (for development/testing)
        return {
          found: true,
          deviceId,
          isNearby: true,
          rssi: -75,
          name: 'Simulated Device',
          address: 'SIM:ULATED',
          message: 'Device detected (simulation mode)',
          simulated: true
        };
      }

      const devices = await this.scanForDevices(scanDuration);
      const device = devices.find(d => d.id === deviceId);

      if (!device) {
        return {
          found: false,
          deviceId,
          message: 'Device not detected'
        };
      }

      const isNearby = device.rssi >= minRssi;

      return {
        found: true,
        deviceId,
        isNearby,
        rssi: device.rssi,
        name: device.name,
        address: device.address,
        message: isNearby ? 'Device detected nearby' : 'Device detected but signal too weak'
      };
    } catch (error) {
      return {
        found: false,
        deviceId,
        error: error.message,
        message: 'Error scanning for device'
      };
    }
  }

  /**
   * Get all currently detected devices
   * @returns {Array} - Array of detected devices
   */
  getDetectedDevices() {
    return Array.from(this.detectedDevices.values());
  }
}

// Singleton instance
let bleDetector = null;

function getBLEDetector() {
  if (!bleDetector) {
    bleDetector = new BLEDetector();
  }
  return bleDetector;
}

module.exports = {
  BLEDetector,
  getBLEDetector
};

