const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

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