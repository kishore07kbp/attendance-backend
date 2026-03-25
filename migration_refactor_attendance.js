const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const refactorAttendance = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }));
    const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));

    console.log('Renaming classroom to course and deviceId to rollNumber...');
    await Attendance.updateMany(
      {},
      { 
        $rename: { 
          classroom: 'course', 
          deviceId: 'rollNumber' 
        } 
      }
    );

    console.log('Fetching all attendance records to update class and year...');
    const allAttendance = await Attendance.find({});
    console.log(`Found ${allAttendance.length} records to process.`);

    let updatedCount = 0;
    for (const att of allAttendance) {
      if (att.studentId) {
        const student = await Student.findById(att.studentId);
        if (student) {
          await Attendance.updateOne(
            { _id: att._id },
            { 
              $set: { 
                studentClass: student.studentClass, 
                year: student.year 
              } 
            }
          );
          updatedCount++;
        }
      }
    }

    console.log(`Successfully refactored ${updatedCount} attendance records with class/year.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
};

refactorAttendance();
