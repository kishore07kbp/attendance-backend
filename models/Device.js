const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  bleDeviceId: {
    type: String,
    required: [true, 'BLE device ID is required'],
    unique: true,
    trim: true
  },
  deviceName: {
    type: String,
    required: [true, 'Device name is required'],
    trim: true
  },
  classroom: {
    type: String,
    required: [true, 'Classroom is required'],
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  signalStrength: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Device', deviceSchema);

