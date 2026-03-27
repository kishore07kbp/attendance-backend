const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");

module.exports = async function markAttendance(data) {
  try {
    const { roll, permId, rssi } = data;

    if (!roll || !permId) {
      console.log("⚠️ Received incomplete MQTT data:", data);
      return;
    }

    // 1. Find the student by roll number and verify permanent ID
    const student = await Student.findOne({ 
      rollNumber: roll.toUpperCase(),
      permanentId: permId 
    });

    if (!student) {
      console.log(`❌ Student not found or ID mismatch for Roll: ${roll}`);
      return;
    }

    // 2. Get current day and time to find the course
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    // HH:mm for startTime/endTime comparison (e.g., "14:30")
    const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    // 3. Find if there's an ongoing course for this student's class
    const course = await Course.findOne({
      year: student.year,
      studentClass: student.studentClass,
      day: currentDay,
      startTime: { $lte: currentTime },
      endTime: { $gte: currentTime }
    });

    const courseName = course ? course.title : "General / Lab";

    // 4. Check if already marked for this course TODAY
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const alreadyMarked = await Attendance.findOne({
      studentId: student._id,
      date: { $gte: startOfToday },
      course: courseName
    });

    if (alreadyMarked) {
      console.log(`ℹ️ Attendance already marked for ${student.rollNumber} - ${courseName}`);
      return;
    }

    // 5. Create Attendance record
    await Attendance.create({
      studentId: student._id,
      userId: student.userId,
      date: now,
      time: now.toLocaleTimeString(),
      status: 'present',
      faceVerified: false,
      bleVerified: true,
      course: courseName,
      rollNumber: student.rollNumber,
      studentClass: student.studentClass,
      year: student.year,
      markedBy: 'system',
      remarks: `MQTT Scan (RSSI: ${rssi})`
    });

    console.log(`✅ Attendance Marked via MQTT: ${student.rollNumber} -> ${courseName}`);

  } catch (err) {
    console.error("❌ Service Error:", err.message);
  }
};