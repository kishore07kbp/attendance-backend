const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");

// 🔥 In-memory lock to prevent race conditions from high-frequency MQTT scans
const processingScans = new Set();

/**
 * Shared service for marking attendance from scans (MQTT/HTTP).
 * Centralizes duplicate checks and course identification.
 * Uses consistent IST (Asia/Kolkata) timezone.
 */
module.exports = async function markAttendance(data) {
  const { roll, permId, rssi } = data;
  if (!roll) return;

  const rollUpper = roll.toUpperCase();
  const now = new Date();

  // 1. Identify current time/day in IST (Asia/Kolkata)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'long'
  });

  const parts = formatter.formatToParts(now);
  const timeParts = {};
  parts.forEach(p => timeParts[p.type] = p.value);

  const currentDay = timeParts.weekday;
  const currentTimeMinutes = parseInt(timeParts.hour) * 60 + parseInt(timeParts.minute);

  try {
    // 2. Find the student
    const student = await Student.findOne({ rollNumber: rollUpper });
    if (!student) {
      console.log(`❌ Student not found for Roll: ${rollUpper}`);
      return;
    }

    // 3. Find if there's an ongoing course
    const todayCourses = await Course.find({
      year: student.year,
      studentClass: student.studentClass,
      day: currentDay
    });

    const parseTimeToMinutes = (timeStr) => {
      if (!timeStr) return -1;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return -1;
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const meridiem = match[3] ? match[3].toUpperCase() : null;
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const activeCourse = todayCourses.find(c => {
      const start = parseTimeToMinutes(c.startTime);
      const end = parseTimeToMinutes(c.endTime);
      return currentTimeMinutes >= start && currentTimeMinutes <= end;
    });

    if (!activeCourse) return; // No active course, ignore scan

    // 4. 🔥 Race Condition Prevention (In-Memory Guard)
    const lockKey = `${rollUpper}-${activeCourse.title}`;
    if (processingScans.has(lockKey)) return; // Already being processed
    processingScans.add(lockKey);

    // 5. Database Duplicate Check (IST-aware)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(now.getTime() + istOffset);
    nowIst.setUTCHours(0, 0, 0, 0);
    const istStartOfTodayAsUtc = new Date(nowIst.getTime() - istOffset);

    const alreadyMarked = await Attendance.findOne({
      studentId: student._id,
      course: activeCourse.title,
      date: { $gte: istStartOfTodayAsUtc }
    });

    if (alreadyMarked) {
      // Keep it in memory for 1 minute to stop subsequent MQTT logs, but let DB be the source of truth
      setTimeout(() => processingScans.delete(lockKey), 60000);
      return;
    }

    // 6. Create Attendance record
    await Attendance.create({
      studentId: student._id,
      userId: student.userId,
      date: now,
      time: now.toLocaleTimeString(),
      status: 'present',
      faceVerified: false,
      bleVerified: true,
      course: activeCourse.title,
      rollNumber: student.rollNumber,
      studentClass: student.studentClass,
      year: student.year,
      markedBy: 'system',
      remarks: `MQTT Scan (RSSI: ${rssi})`
    });

    console.log(`✅ Attendance Marked: ${student.rollNumber} -> ${activeCourse.title}`);

    // Cleanup lock after record is saved
    setTimeout(() => processingScans.delete(lockKey), 60000);

  } catch (err) {
    processingScans.delete(`${rollUpper}-${activeCourse?.title || 'Unknown'}`);
    console.error("❌ Service Error during markAttendance:", err.message);
  }
};