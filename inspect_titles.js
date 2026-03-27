const mongoose = require('mongoose');
require('dotenv').config();
const Course = require('./models/Course');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const courses = await Course.find({});
    for (const course of courses) {
      console.log(`- Title: "${course.title}", Day: ${course.day}, Time: ${course.startTime} - ${course.endTime}`);
    }
    mongoose.connection.close();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
