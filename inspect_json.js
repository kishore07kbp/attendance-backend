const mongoose = require('mongoose');
require('dotenv').config();
const Course = require('./models/Course');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const courses = await Course.find({});
    for (const course of courses) {
      console.log(JSON.stringify({ title: course.title, day: course.day, class: course.studentClass, year: course.year }));
    }
    mongoose.connection.close();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
