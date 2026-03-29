const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require("mqtt");
const markAttendance = require("./services/attendanceService");
const { updateScannedDevice } = require("./utils/deviceStore");

dotenv.config();

// Initialize the attendance email scheduler
require('./utils/attendanceScheduler');

const app = express();
const server = http.createServer(app);

// ✅ Proper FRONTEND URL from ENV
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ✅ Socket.io setup (FIXED)
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ✅ Socket connection
io.on('connection', (socket) => {
  console.log("🟢 New client connected:", socket.id);

  socket.on('disconnect', () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

// ✅ CORS middleware (FIXED)
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ MongoDB Connection (SAFE)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1); // stop server if DB fails
  });

/*
---------------------------------------
MQTT SETUP (DEPLOY READY)
---------------------------------------
*/
console.log("🚀 MQTT Initializing...");

const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

mqttClient.on("connect", () => {
  console.log("✅ MQTT Connected (Server)");

  mqttClient.subscribe("attendance/data", (err) => {
    if (err) {
      console.log("❌ MQTT Subscribe Error:", err.message);
    } else {
      console.log("📡 Subscribed to attendance/data");
    }
  });
});

mqttClient.on("error", (err) => {
  console.log("❌ MQTT Error:", err.message);
});

mqttClient.on("reconnect", () => {
  console.log("🔄 MQTT Reconnecting...");
});

mqttClient.on("offline", () => {
  console.log("⚠️ MQTT Offline");
});

/*
---------------------------------------
MQTT MESSAGE HANDLER
---------------------------------------
*/
mqttClient.on("message", async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    console.log("📡 MQTT Data:", data);

    // 1. Mark attendance in DB
    await markAttendance(data);

    // 2. Update shared device store for scanning UI
    const { roll, permId, rssi } = data;
    const deviceData = {
      name: roll || "Unknown",
      permanentId: permId,
      rssi,
      lastSeen: new Date()
    };

    updateScannedDevice(deviceData);

    // 3. Emit live socket event for scanning modal
    console.log("📡 Emitting BLE detected (MQTT):", deviceData.name);
    io.emit("ble-device-detected", deviceData);

  } catch (err) {
    console.error("❌ MQTT Error:", err.message);
  }
});

// ✅ Health check route (useful for Render)
app.get("/", (req, res) => {
  res.send("Smart Attendance Backend Running 🚀");
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/courses', require('./routes/courses'));
app.use("/api/ble", require("./routes/bleStream"));
app.use('/api/mobile', require('./routes/mobile'));

/*
---------------------------------------
ESP32 HTTP Route (NEW)
---------------------------------------
*/
app.post("/api/esp32-scan", async (req, res) => {
  try {
    console.log("📡 ESP32 Data Received:", req.body);

    // 🔥 Extract data
    const { roll, permId, rssi } = req.body;

    // 🔥 OPTIONAL: Validate data
    if (!roll || !permId) {
      return res.status(400).json({ message: "Invalid data" });
    }

    /*
    ---------------------------------------
    CALL YOUR EXISTING LOGIC
    ---------------------------------------
    */

    await markAttendance({ roll, permId, rssi });

    console.log(`✅ Attendance Marked → ${roll}`);

    res.status(200).json({
      success: true,
      message: "Data received successfully"
    });

  } catch (error) {
    console.error("❌ ESP32 Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ✅ Make socket available in routes
app.set('io', io);

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: err.message
  });
});

// ✅ Server start (Render compatible)
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});