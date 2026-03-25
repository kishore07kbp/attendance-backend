const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  time: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: 'present'
  },
  faceVerified: {
    type: Boolean,
    default: false
  },
  bleVerified: {
    type: Boolean,
    default: false
  },
  course: {
    type: String,
    trim: true
  },
  rollNumber: {
    type: String,
    trim: true
  },
  studentClass: {
    type: String,
    trim: true
  },
  year: {
    type: String,
    enum: ['I', 'II', 'III', 'IV'],
    trim: true
  },
  markedBy: {
    type: String,
    enum: ['system', 'manual'],
    default: 'system'
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
attendanceSchema.index({ studentId: 1, date: 1 });
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

