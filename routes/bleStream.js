const express = require("express");
const router = express.Router();
const markAttendance = require("../services/attendanceService");

router.post("/ble-device", async (req, res) => {

  const { roll, permId, rssi } = req.body;

  // 🚀 Map ID to Student Roll Number
  const student = await markAttendance({ roll, permId, rssi });

  const deviceData = {
    name: student ? student.rollNumber : (roll || "Unknown"),
    permanentId: permId,
    rssi,
    lastSeen: new Date()
  };

  const io = req.app.get("io");

  if (io) {
    console.log("📡 Emitting BLE detected (Stream):", deviceData.name);
    io.emit("ble-device-detected", deviceData);
  }

  res.json({ success: true, studentIdentified: !!student });

});

module.exports = router;