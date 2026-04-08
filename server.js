const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require("mqtt");
const markAttendance = require("./services/attendanceService");
const { updateScannedDevice } = require("./utils/deviceStore");
const { initStudentCache } = require('./utils/studentCache');

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
  .then(async () => {
    console.log("✅ MongoDB Connected");
    // 🚀 Start student cache for fast lookups
    await initStudentCache();
  })
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
    const { permId, rssi } = data;

    console.log("📡 MQTT Data received (Passive Scan):", { permId, rssi });

    // 🚀 Only IDENTIFY the student for the live UI, do NOT mark attendance
    const { getStudentByPermId } = require("./utils/studentCache");
    const student = getStudentByPermId(permId);

    const deviceData = {
      name: student ? student.rollNumber : "Unknown Device",
      permanentId: permId,
      rssi,
      lastSeen: new Date()
    };

    // Update shared device store for scanning UI
    updateScannedDevice(deviceData);

    // Emit live socket event for scanning modal
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
    const { permId, rssi } = req.body;

    if (!permId) {
      return res.status(400).json({ message: "Permanent ID required" });
    }

    console.log("📡 ESP32 HTTP Scan Received:", { permId, rssi });

    // 🚀 Only IDENTIFY the student for the live UI, do NOT mark attendance
    const { getStudentByPermId } = require("./utils/studentCache");
    const student = getStudentByPermId(permId);

    const deviceData = {
      name: student ? student.rollNumber : "Unknown Device",
      permanentId: permId,
      rssi: rssi || 0,
      lastSeen: new Date()
    };

    // Update shared device store and emit to frontend
    updateScannedDevice(deviceData);
    io.emit("ble-device-detected", deviceData);

    res.status(200).json({
      success: true,
      message: "Device detected and broadcasted",
      student: student ? { name: student.name, rollNumber: student.rollNumber } : null
    });

  } catch (error) {
    console.error("❌ ESP32 Route Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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

/*
---------------------------------------
RENDER KEEP-ALIVE (PREVENT SLEEP)
---------------------------------------
*/
const axios = require("axios");

// Ping the server every 10 minutes to prevent Render from sleeping
setInterval(async () => {
  try {
    // RENDER_EXTERNAL_URL is automatically set by Render
    const url = process.env.RENDER_EXTERNAL_URL || "https://your-app.onrender.com";
    const res = await axios.get(url);
    console.log("Pinged server ✅", res.status);
  } catch (err) {
    console.log("Error pinging ❌", err.message);
  }
}, 10 * 60 * 1000); // 10 minutes

// ✅ Server start (Render compatible)
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});