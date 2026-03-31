const express = require('express');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const { protect } = require('../middleware/auth');
const faceRecognition = require('../utils/faceRecognition');
const { updateStudentInCache } = require('../utils/studentCache');

const router = express.Router();

// Helper to calculate daily points in IST
const getDailyPoints = async (student, date, attendanceCount) => {
  // 1. Convert any incoming date to IST timestamp
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(new Date(date).getTime() + istOffset);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[istDate.getUTCDay()];

  // Get scheduled courses for this student's year/class on this day
  const scheduledCount = await Course.countDocuments({
    year: student.year,
    studentClass: student.studentClass,
    day: dayName
  });

  if (attendanceCount === 0) return 0;

  // If no courses are scheduled in the system for this day, we default to 1.0 points if any attendance was marked
  // (This handles cases where the timetable might be incomplete)
  if (scheduledCount === 0) return 1.0;

  // 1.0 if all classes attended, 0.5 if at least one but not all
  if (attendanceCount >= scheduledCount) return 1.0;
  return 0.5;
};

/////////////////////////////////////////////////////////
// GET STUDENT PROFILE
/////////////////////////////////////////////////////////

router.get('/profile', protect, async (req, res) => {

  try {

    const student = await Student.findOne({ userId: req.user._id })
      .populate('userId', 'name email');

    if (!student) {
      return res.status(404).json({
        message: "Student profile not found"
      });
    }

    // Find class advisor for this student
    const advisor = await Faculty.findOne({
      classAdvisorClass: student.studentClass,
      classAdvisorYear: student.year
    });

    res.json({
      success: true,
      student: {
        ...student.toObject(),
        classAdvisorName: advisor ? advisor.name : 'Not Assigned'
      }
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

/////////////////////////////////////////////////////////
// UPDATE STUDENT PROFILE
/////////////////////////////////////////////////////////

router.put('/profile', protect, async (req, res) => {

  try {

    const { name, email, rollNumber } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    const student = await Student.findOne({ userId: req.user._id });

    if (!student) {
      return res.status(404).json({
        message: "Student profile not found"
      });
    }

    if (rollNumber) {
      student.rollNumber = rollNumber.toUpperCase();
    }
    if (name) {
      student.name = name;
    }
    if (email) {
      student.email = email;
    }

    await student.save();

    // 🚀 Update RAM Cache
    updateStudentInCache(student);

    res.json({
      success: true,
      message: "Profile updated successfully"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

/////////////////////////////////////////////////////////
// REGISTER FACE
/////////////////////////////////////////////////////////

router.post('/register-face', protect, async (req, res) => {

  try {

    const { faceDescriptor } = req.body;

    if (!faceDescriptor) {
      return res.status(400).json({
        message: "Face descriptor required"
      });
    }

    const student = await Student.findOne({ userId: req.user._id });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    if (student.faceDescriptor && student.faceDescriptor.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Face already registered. Overwrite not allowed."
      });
    }

    // Check if this face is already registered with another student
    const allStudentsWithFaces = await Student.find({
      faceDescriptor: { $exists: true, $ne: null, $not: { $size: 0 } },
      _id: { $ne: student._id }
    }).select('faceDescriptor rollNumber');

    for (const otherStudent of allStudentsWithFaces) {
      const distance = faceRecognition.calculateDistance(faceDescriptor, otherStudent.faceDescriptor);

      // Log for server-side debugging
      console.log(`Matching: Current request against ${otherStudent.rollNumber} | Euclidean Distance: ${distance.toFixed(4)}`);

      // Euclidean distance standard threshold is 0.6 (where < 0.6 is a match)
      // We'll use 0.45 for very high strictness during registration
      if (distance < 0.45) {
        return res.status(400).json({
          success: false,
          message: `The face is already matched with another account (Roll: ${otherStudent.rollNumber}) | Matching Distance: ${distance.toFixed(4)}`
        });
      }
    }

    student.faceDescriptor = faceDescriptor;

    await student.save();

    res.json({
      success: true,
      message: "Face registered successfully"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

/////////////////////////////////////////////////////////
// REGISTER PERMANENT ID (FROM ESP32 SCAN)
/////////////////////////////////////////////////////////

router.post('/register-permanent-id', protect, async (req, res) => {

  try {

    const { permanentId, deviceName } = req.body;

    if (!permanentId) {
      return res.status(400).json({
        message: "Permanent ID required"
      });
    }

    // Check if this Permanent ID is already registered to another student
    const existingStudent = await Student.findOne({
      permanentId: permanentId,
      userId: { $ne: req.user._id }
    });

    if (existingStudent) {
      return res.status(400).json({
        message: "This device is already registered to another student"
      });
    }

    const student = await Student.findOne({ userId: req.user._id });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    // Link the device
    student.permanentId = permanentId;

    await student.save();

    // 🚀 Update RAM Cache
    updateStudentInCache(student);

    res.json({
      success: true,
      message: "Permanent ID registered successfully"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

/////////////////////////////////////////////////////////
// MARK ATTENDANCE
/////////////////////////////////////////////////////////

router.post('/mark-attendance', protect, async (req, res) => {

  try {

    const { faceDescriptor, course, bleDeviceId } = req.body;

    const student = await Student.findOne({ userId: req.user._id });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    /////////////////////////////////////////////////////////
    // 🛡️ REJECT COURSE MISMATCH (AUTO-CALCULATE ACTIVE COURSE)
    /////////////////////////////////////////////////////////

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
    const currentTimeMinutes = parseInt(timeParts.hour) * 60 + parseInt(timeParts.minute);

    // Finding scheduled courses for this student's Year/Class on this specific Day
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

    // ⛔ REJECT: If no course is scheduled right now
    if (!activeCourse) {
      return res.status(403).json({
        success: false,
        message: `Attendance rejected. No course is scheduled for your class (${student.studentClass}) at this time (${timeParts.hour}:${timeParts.minute} IST).`
      });
    }

    // ⛔ REJECT: If the student manually tried to mark a DIFFERENT course name
    if (activeCourse.title !== course) {
      return res.status(403).json({
        success: false,
        message: `Course Mismatch! The ongoing class is '${activeCourse.title}'. You cannot mark attendance for '${course}'.`
      });
    }

    /////////////////////////////////////////////////////////
    // FACE VERIFICATION
    /////////////////////////////////////////////////////////

    let faceVerified = false;

    if (student.faceDescriptor && student.faceDescriptor.length > 0) {
      const match = faceRecognition.compareFaces(
        faceDescriptor,
        student.faceDescriptor,
        0.85 // Balanced but strict threshold
      );

      console.log("Face matching result:", match);
      faceVerified = match.isMatch;
    }

    /////////////////////////////////////////////////////////
    // BLE VERIFICATION
    /////////////////////////////////////////////////////////

    const bleVerified = (student.permanentId === bleDeviceId);

    if (!faceVerified) {
      return res.status(403).json({
        success: false,
        message: "Face does not match the registered student. Attendance not allowed."
      });
    }

    /////////////////////////////////////////////////////////
    // CHECK IF ALREADY MARKED (IST-AWARE)
    /////////////////////////////////////////////////////////

    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    istNow.setUTCHours(0, 0, 0, 0); // Start of day in IST
    const istStartOfTodayAsUtc = new Date(istNow.getTime() - istOffset);

    const existingAttendance = await Attendance.findOne({
      studentId: student._id,
      date: { $gte: istStartOfTodayAsUtc },
      course: course
    });

    if (existingAttendance) {
      // Logic for upgrade: If it was marked by system (BLE only) and now we have face verification
      if (existingAttendance.markedBy === 'system' && !existingAttendance.faceVerified && faceVerified) {
        existingAttendance.faceVerified = true;
        existingAttendance.bleVerified = true; // confirm BLE link matches student too
        existingAttendance.remarks = `Upgraded to Face Verified (${existingAttendance.remarks})`;
        await existingAttendance.save();

        return res.json({
          success: true,
          message: "Face scan verified and added to initial BLE ping",
          attendance: existingAttendance
        });
      }

      return res.status(400).json({
        message: "Attendance already marked today"
      });
    }

    /////////////////////////////////////////////////////////
    // MARK ATTENDANCE
    /////////////////////////////////////////////////////////

    const istOptions = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const istTimeStr = now.toLocaleTimeString('en-US', istOptions);

    const attendance = await Attendance.create({

      studentId: student._id,
      userId: req.user._id,

      date: now,
      time: istTimeStr,

      status: bleVerified ? "present" : "absent",

      faceVerified,
      bleVerified,

      course: course || "Unknown",
      rollNumber: student.rollNumber,
      studentClass: student.studentClass,
      year: student.year

    });

    res.json({
      success: true,
      attendance
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

/////////////////////////////////////////////////////////
// GET ATTENDANCE STATS
/////////////////////////////////////////////////////////

router.get('/attendance-stats', protect, async (req, res) => {

  try {

    const student = await Student.findOne({ userId: req.user._id });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    // Historical Stats
    const allAttendance = await Attendance.find({
      studentId: student._id,
      status: 'present'
    });

    const istOffset = 5.5 * 60 * 60 * 1000;
    const groupedByDate = {};
    allAttendance.forEach(att => {
      if (!att.date) return;
      try {
        const istDate = new Date(new Date(att.date).getTime() + istOffset);
        const dateKey = istDate.toISOString().split('T')[0];
        groupedByDate[dateKey] = (groupedByDate[dateKey] || 0) + 1;
      } catch (e) {
        console.warn("Invalid date in attendance record for stats:", att.date);
      }
    });

    let totalPoints = 0;
    const dates = Object.keys(groupedByDate);

    for (const date of dates) {
      try {
        const points = await getDailyPoints(student, date, groupedByDate[date]);
        totalPoints += points;
      } catch (e) {
        console.error("Error calculating points for stats on", date, e);
      }
    }

    // Today's Stats in IST
    const now = new Date();
    const istNow = new Date(now.getTime() + istOffset);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][istNow.getUTCDay()];

    istNow.setUTCHours(0, 0, 0, 0); // Midnight IST
    const istStartOfTodayAsUtc = new Date(istNow.getTime() - istOffset);

    const [todayAttendance, scheduledToday] = await Promise.all([
      Attendance.find({
        studentId: student._id,
        date: { $gte: istStartOfTodayAsUtc },
        status: 'present'
      }),
      Course.countDocuments({
        year: student.year,
        studentClass: student.studentClass,
        day: dayName
      })
    ]);

    const historicalTotalDays = dates.length;
    const attendancePercentage = historicalTotalDays > 0 ? ((totalPoints / historicalTotalDays) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      stats: {
        totalDays: historicalTotalDays,
        todayClasses: todayAttendance.length,
        scheduledToday: scheduledToday || 0,
        presentDays: totalPoints,
        absentDays: historicalTotalDays - totalPoints,
        attendancePercentage
      }
    });

  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({
      message: error.message
    });

  }

});

/////////////////////////////////////////////////////////
// ATTENDANCE HISTORY
/////////////////////////////////////////////////////////

router.get('/attendance-history', protect, async (req, res) => {

  try {

    const student = await Student.findOne({ userId: req.user._id });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const attendance = await Attendance.find({
      studentId: student._id
    }).sort({ date: -1 });

    const istOffset = 5.5 * 60 * 60 * 1000;
    const grouped = {};
    attendance.forEach(att => {
      if (!att.date) return;
      try {
        const istDate = new Date(new Date(att.date).getTime() + istOffset);
        const dateKey = istDate.toISOString().split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = { count: 0, date: dateKey };
        if (att.status === 'present') grouped[dateKey].count++;
      } catch (e) {
        console.warn("Invalid date in attendance record:", att.date);
      }
    });

    const dailySummary = [];
    for (const dateKey in grouped) {
      try {
        const points = await getDailyPoints(student, dateKey, grouped[dateKey].count);
        dailySummary.push({
          date: dateKey,
          points: points
        });
      } catch (e) {
        console.error("Error calculating daily points for", dateKey, e);
      }
    }

    res.json({
      success: true,
      attendance,
      dailySummary: dailySummary.sort((a, b) => new Date(a.date) - new Date(b.date))
    });

  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({
      message: error.message
    });

  }

});

module.exports = router;