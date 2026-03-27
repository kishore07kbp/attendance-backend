const mongoose = require('mongoose');
require('dotenv').config();
const Attendance = require('./models/Attendance');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const attendances = await Attendance.find({ rollNumber: '23CC031' }).sort({ date: -1 }).limit(10);
    console.log(`Found ${attendances.length} recent attendances for 23CC031.`);
    for (const att of attendances) {
      console.log(`- Course: "${att.course}", Date: ${att.date.toISOString()}, String: ${att.date.toString()}`);
    }
    mongoose.connection.close();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
