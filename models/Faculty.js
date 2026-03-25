const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    lowercase: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['faculty', 'admin'],
    default: 'faculty'
  },
  facultyId: {
    type: String,
    required: [true, 'Faculty ID is required'],
    trim: true,
    unique: true
  },
  department: {
    type: String,
    enum: ['CCE', 'IT', 'CSBS', 'MECH', 'EEE', 'AIML', 'CSE', 'ECE', 'AIDS'],
    required: [true, 'Department is required'],
    trim: true
  },
  designation: {
    type: String,
    enum: ['Assistant Professor', 'Associate Professor', 'Professor', 'Lab Assistant', 'HOD'],
    required: [true, 'Designation is required'],
    trim: true
  },
  classAdvisorClass: {
    type: String,
    enum: [
      'None', 'CCE', 'IT', 'CSBS', 'MECH', 'EEE', 'AIML',
      'CSE-A', 'CSE-B', 'CSE-C', 'CSE-CYS',
      'ECE-A', 'ECE-B', 'ECE-C',
      'AIDS-A', 'AIDS-B', 'AIDS-C', 'AIDS-D'
    ],
    default: 'None'
  },
  classAdvisorYear: {
    type: String,
    enum: ['None', 'I', 'II', 'III', 'IV'],
    default: 'None'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Faculty', facultySchema, 'faculty');

