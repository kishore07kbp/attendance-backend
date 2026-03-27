const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");

module.exports = async function markAttendance(data) {
  try {
    const { roll, permId, rssi } = data;

    if (!roll) {
      console.log("⚠️ Received incomplete MQTT data (missing roll):", data);
      return;
    }

    // 1. Find the student by roll number ONLY (Remove permId validation as requested)
    const student = await Student.findOne({ 
      rollNumber: roll.toUpperCase()
    });

    if (!student) {
      console.log(`❌ Student not found for Roll: ${roll}`);
      return;
    }

    console.log(`📥 Processing Attendance (No Validation) for: ${student.name} (${student.rollNumber})`);

    // 2. Identify the ongoing course (if any)
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    const course = await Course.findOne({
      year: student.year,
      studentClass: student.studentClass,
      day: currentDay,
      startTime: { $lte: currentTime },
      endTime: { $gte: currentTime }
    });

    // ⛔ Default course "General / Lab" removed as requested
    const courseName = course ? course.title : "";

    // ⛔ Duplicate check removed as requested (Marking regardless of frequency)

    // 3. Save the attendance record
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

    console.log(`✅ Attendance Marked via MQTT (Validation Disabled): ${student.rollNumber}${courseName ? ' -> ' + courseName : ''}`);

  } catch (err) {
    console.error("❌ Service Error during markAttendance:", err.message);
  }
};