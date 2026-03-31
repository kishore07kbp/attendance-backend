const express = require("express");
const router = express.Router();
const markAttendance = require("../services/attendanceService");

router.post("/ble-device", async (req, res) => {

  const { permId, rssi, roll } = req.body;

  // 🚀 Map ID to Student Roll Number ONLY, do NOT mark attendance
  const { getStudentByPermId, getStudentByRoll } = require("../utils/studentCache");
  const student = (permId) ? getStudentByPermId(permId) : (roll ? getStudentByRoll(roll) : null);

  const deviceData = {
    name: student ? student.rollNumber : (roll || "Unknown Device"),
    permanentId: permId,
    rssi: rssi || 0,
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