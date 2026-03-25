const mongoose = require('mongoose');
require('dotenv').config();

console.log("Testing MongoDB connection to:", process.env.MONGODB_URI.split('@')[1]); // Log part of it for safety

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
