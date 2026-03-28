const mongoose = require('mongoose');
require('dotenv').config();
const Attendance = require('./models/Attendance');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    // Delete all attendance for 23CC031 from today (Mar 27/28 transition)
    const result = await Attendance.deleteMany({
      rollNumber: '23CC031'
    });
    console.log(`✅ Successfully cleaned up ${result.deletedCount} duplicate records.`);
    mongoose.connection.close();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
