const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true
  },
  year: {
    type: String,
    enum: ['I', 'II', 'III', 'IV'],
    required: [true, 'Year is required']
  },
  studentClass: {
    type: String,
    enum: ['CCE', 'IT', 'CSBS', 'MECH', 'EEE', 'AIML', 'CSE-A', 'CSE-B', 'CSE-C', 'CSE-CYS', 'ECE-A', 'ECE-B', 'ECE-C', 'AIDS-A', 'AIDS-B', 'AIDS-C', 'AIDS-D'],
    required: [true, 'Class is required']
  },
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: [true, 'Day is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  facultyName: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', courseSchema);
