const express = require("express");
const router = express.Router();

router.post("/ble-device", (req, res) => {

  const device = req.body;

  console.log("BLE Device Received:", device);

  const io = req.app.get("io");

  io.emit("ble-device-detected", device);

  res.json({ success: true });

});

module.exports = router;