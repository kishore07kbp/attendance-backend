const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");
const { getStudentByPermId, getStudentByRoll } = require("../utils/studentCache");

// 🔥 In-memory lock to prevent race conditions from high-frequency MQTT scans
const processingScans = new Set();

/**
 * Shared service for marking attendance from scans (MQTT/HTTP).
 * Centralizes duplicate checks and course identification.
 */
module.exports = async function markAttendance(data) {
  const { roll, permId, rssi } = data;

  // 🚀 Robust Trimming (ESP32 sometimes sends \r\n or spaces)
  const cleanPermId = permId ? permId.toString().trim() : null;
  const cleanRoll = roll ? roll.toString().trim().toUpperCase() : null;

  console.log(`📡 [DEBUG] markAttendance lookup: roll=${cleanRoll}, permId=${cleanPermId}`);

  // 🚀 Resolve student via RAM Cache (Super Fast)
  let student = cleanRoll ? getStudentByRoll(cleanRoll) : getStudentByPermId(cleanPermId);

  if (student) {
    console.log(`✅ [DEBUG] Student found in Cache: ${student.rollNumber}`);
  }

  // Fallback: If not in cache, check DB
  if (!student) {
    console.log(`🔍 [DEBUG] Student not in cache, checking MongoDB...`);
    if (cleanRoll) {
      student = await Student.findOne({ rollNumber: cleanRoll });
    } else if (cleanPermId) {
      student = await Student.findOne({ permanentId: cleanPermId });
    }

    if (student) {
      console.log(`✅ [DEBUG] Student found in DB: ${student.rollNumber}`);
    }
  }

  if (!student) {
    console.log(`❌ [DEBUG] Student not found for ${cleanRoll ? 'Roll: ' + cleanRoll : 'PermID: ' + cleanPermId}`);
    return null;
  }

  const rollUpper = student.rollNumber;
  const now = new Date();

  // 1. Identify current time/day in IST (Asia/Kolkata)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'long'
  });

  const parts = formatter.formatToParts(now);
  const timeParts = {};
  parts.forEach(p => timeParts[p.type] = p.value);

  const currentDay = timeParts.weekday;
  const currentTimeMinutes = parseInt(timeParts.hour) * 60 + parseInt(timeParts.minute);
  const hourNum = parseInt(timeParts.hour);
  const displayHour = hourNum % 12 || 12;
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const finalTimeString = `${displayHour}:${timeParts.minute.padStart(2, '0')}:${timeParts.second.padStart(2, '0')} ${ampm}`;

  try {
    // 3. Find if there's an ongoing course (Still requires DB lookup, but minimized to current day/class)
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

    if (!activeCourse) {
      return student;
    }

    // 4. 🔥 Race Condition Prevention (In-Memory Guard)
    const lockKey = `${rollUpper}-${activeCourse.title}`;
    if (processingScans.has(lockKey)) return student;
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
      setTimeout(() => processingScans.delete(lockKey), 60000);
      return student;
    }

    // 6. Create Attendance record
    await Attendance.create({
      studentId: student._id,
      userId: student.userId,
      date: now,
      time: finalTimeString,
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
    setTimeout(() => processingScans.delete(lockKey), 60000);

    return student;

  } catch (err) {
    console.error("❌ Service Error during markAttendance:", err.message);
    return null;
  }
};