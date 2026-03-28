const mongoose = require('mongoose');
require('dotenv').config();
const Course = require('./models/Course');
const Student = require('./models/Student');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const student = await Student.findOne({ rollNumber: '23CC031' });
    console.log(`Student 23CC031: Class: ${student.studentClass}, Year: ${student.year}`);
    
    const saturDayCourses = await Course.find({ day: 'Saturday' });
    console.log(`Found ${saturDayCourses.length} courses for Saturday.`);
    for (const course of saturDayCourses) {
      console.log(`- Course: "${course.title}", Class: ${course.studentClass}, Year: ${course.year}`);
    }
    mongoose.connection.close();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
