const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");

/**
 * Shared service for marking attendance from scans (MQTT/HTTP).
 * Centralizes duplicate checks and course identification.
 */
module.exports = async function markAttendance(data) {
  try {
    const { roll, permId, rssi } = data;

    if (!roll) {
      console.log("⚠️ Received incomplete MQTT data (missing roll):", data);
      return;
    }

    // 1. Find the student
    const student = await Student.findOne({ 
      rollNumber: roll.toUpperCase()
    });

    if (!student) {
      console.log(`❌ Student not found for Roll: ${roll}`);
      return;
    }

    // 2. Identify current time/day in IST (Asia/Kolkata)
    const now = new Date();
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
    const currentHour = parseInt(timeParts.hour);
    const currentMinute = parseInt(timeParts.minute);
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // 3. Find if there's an ongoing course (RE-ADDED VALIDATION)
    // We only mark attendance if there's a valid scheduled course.
    const course = await Course.findOne({
      year: student.year,
      studentClass: student.studentClass,
      day: currentDay,
      // Note: courses in DB use "HH:mm AM/PM" or "HH:mm" (24h)
      // For now we compare by finding the title via the scheduler logic if needed
      // But simpler: just find the course for this student's year/class on this day/time
    });

    // We fetch ALL courses for this class today and check time window manually to be safe with formats
    const todayCourses = await Course.find({
      year: student.year,
      studentClass: student.studentClass,
      day: currentDay
    });

    // Manual time parsing to be robust across formats (e.g. 09:00 AM vs 09:00)
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

    if (!activeCourse) {
      console.log(`ℹ️ Scan ignored: No active course for ${student.rollNumber} right now (${currentDay} ${timeParts.hour}:${timeParts.minute} IST)`);
      return;
    }

    // 4. Check for duplicates (RE-ADDED DUPLICATE PREVENTION)
    const startOfTodayIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    startOfTodayIST.setHours(0, 0, 0, 0);

    const alreadyMarked = await Attendance.findOne({
      studentId: student._id,
      course: activeCourse.title,
      // We look for records created since start of today (local time)
      date: { $gte: startOfTodayIST }
    });

    if (alreadyMarked) {
      // Log only occasionally or in debug to avoid console spam
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
      course: activeCourse.title,
      rollNumber: student.rollNumber,
      studentClass: student.studentClass,
      year: student.year,
      markedBy: 'system',
      remarks: `MQTT Scan (RSSI: ${rssi})`
    });

    console.log(`✅ Attendance Marked: ${student.rollNumber} -> ${activeCourse.title}`);

  } catch (err) {
    console.error("❌ Service Error during markAttendance:", err.message);
  }
};