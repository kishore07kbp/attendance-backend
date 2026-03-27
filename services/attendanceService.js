const Device = require("../models/Device"); // ✅ YOUR FILE NAME

module.exports = async function markAttendance(data) {
  try {
    const { roll, permId, rssi } = data;

    console.log("📥 Processing Attendance:", data);

    if (!roll || !permId) {
      console.log("❌ Invalid Data");
      return;
    }

    await Device.create({
      roll,
      permId,
      rssi,
      timestamp: new Date()
    });

    console.log(`✅ Attendance Saved → ${roll}`);

  } catch (err) {
    console.error("❌ Service Error:", err.message);
  }
};