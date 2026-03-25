const express = require('express');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

/*
--------------------------------------------------
Temporary memory store for scanned BLE devices
--------------------------------------------------
*/
let scannedDevices = [];

// ESP32 sends scanned BLE device to /api/devices/scan
router.post('/scan', async (req, res) => {
  console.log("📥 Received POST from ESP32:", req.body);

  try {
    const { roll, permId, rssi } = req.body;
    const deviceData = {
      name: roll || "Unknown",
      permanentId: permId,
      rssi,
      lastSeen: new Date()
    };

    const index = scannedDevices.findIndex(d => d.permanentId === permId);
    if (index !== -1) {
      scannedDevices[index] = deviceData;
    } else {
      scannedDevices.push(deviceData);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("ble-device-detected", deviceData);
    }

    res.json({ success: true, roll: roll });

  } catch (error) {
    res.status(500).json({ message: "BLE scan error", error: error.message });
  }
});

/*
--------------------------------------------------
Frontend fetch scanned BLE devices
--------------------------------------------------
*/
router.get('/ble-devices', protect, (req, res) => {
  const now = Date.now();
  const TTL = 5 * 1000; // 5 seconds
  
  // Clean up on the fly before returning
  scannedDevices = scannedDevices.filter(d => {
    const lastSeenTime = new Date(d.lastSeen).getTime();
    return (now - lastSeenTime) < TTL;
  });

  res.json({
    success: true,
    devices: scannedDevices,
    count: scannedDevices.length
  });

});

/*
--------------------------------------------------
Verify BLE device for attendance
--------------------------------------------------
*/
router.post('/verify', async (req, res) => {

  try {

    const { permanentId } = req.body;

    if (!permanentId) {
      return res.status(400).json({
        message: 'Permanent ID required'
      });
    }

    const device = scannedDevices.find(
      d => d.permanentId === permanentId
    );

    if (!device) {

      return res.json({
        success: true,
        verified: false,
        message: "Student device not detected in classroom"
      });

    }

    const now = new Date();
    const timeDiff = now - device.lastSeen;

    // allow 5 minutes window
    if (timeDiff > 5 * 60 * 1000) {

      return res.json({
        success: true,
        verified: false,
        message: "Device seen earlier but not recently"
      });

    }

    res.json({
      success: true,
      verified: true,
      device
    });

  } catch (error) {

    res.status(500).json({
      message: 'Server error',
      error: error.message
    });

  }

});

module.exports = router;