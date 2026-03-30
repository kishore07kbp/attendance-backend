const express = require('express');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');
const markAttendance = require("../services/attendanceService");
const { updateScannedDevice, getScannedDevices } = require("../utils/deviceStore");

const router = express.Router();

/*
--------------------------------------------------
Temporary memory store for scanned BLE devices
--------------------------------------------------
*/
// Moved to utils/deviceStore.js

// ESP32 sends scanned BLE device to /api/devices/scan
router.post('/scan', async (req, res) => {
  console.log("📥 Received POST from ESP32:", req.body);

  try {
    const { roll, permId, rssi } = req.body;

    // 🔥 Mark attendance and get student info
    const student = await markAttendance({ roll, permId, rssi });

    const deviceData = {
      name: student ? student.rollNumber : (roll || "Unknown"),
      permanentId: permId,
      rssi,
      lastSeen: new Date()
    };

    updateScannedDevice(deviceData);

    const io = req.app.get("io");
    if (io) {
      console.log("📡 Emitting BLE detected (HTTP):", deviceData.name);
      io.emit("ble-device-detected", deviceData);
    }

    res.json({ success: true, roll: student ? student.rollNumber : (roll || "Unknown") });

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
  const freshDevices = getScannedDevices();

  res.json({
    success: true,
    devices: freshDevices,
    count: freshDevices.length
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

    const device = getScannedDevices().find(
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