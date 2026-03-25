const express = require('express');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Faculty = require('../models/Faculty');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All faculty routes require authentication and faculty/admin role
router.use(protect);
router.use(authorize('faculty', 'admin'));

// Get faculty profile
router.get('/profile', async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).populate(
      'userId',
      'name email role'
    );

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty profile not found' });
    }

    res.json({ success: true, faculty });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update faculty profile
router.put('/profile', async (req, res) => {
  try {
    const { name, email, department, designation, facultyId, classAdvisorClass, classAdvisorYear } = req.body;

    // Update User model
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    await user.save();

    // Update Faculty model
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty profile not found' });

    if (department) faculty.department = department;
    if (designation) faculty.designation = designation;
    if (name) faculty.name = name;
    if (email) faculty.email = email;
    if (facultyId) faculty.facultyId = facultyId;
    
    // Check if another faculty is already advisor for this new class/year assignment
    if (classAdvisorClass && classAdvisorClass !== 'None' && classAdvisorYear && classAdvisorYear !== 'None') {
      const existingAdvisor = await Faculty.findOne({
        classAdvisorClass,
        classAdvisorYear,
        _id: { $ne: faculty._id } // exclude current faculty
      });

      if (existingAdvisor) {
        return res.status(400).json({ 
          message: `The ${classAdvisorClass} - ${classAdvisorYear} Year already has an assigned advisor (${existingAdvisor.name}).`
        });
      }
    }

    if (classAdvisorClass) faculty.classAdvisorClass = classAdvisorClass;
    if (classAdvisorYear) faculty.classAdvisorYear = classAdvisorYear;
    await faculty.save();

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or Faculty ID already in use by another account' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all students
router.get('/students', async (req, res) => {
  try {
    const { search = '' } = req.query;

    let query = {};
    if (search) {
      query = {
        $or: [
          { rollNumber: { $regex: search, $options: 'i' } },
          { studentClass: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (faculty && faculty.role !== 'admin') {
      const dept = faculty.department;
      query.studentClass = { $regex: new RegExp(`^${dept}(-[A-Z]+)?$`) };
    }

    const students = await Student.find(query)
      .populate('userId', 'name email')
      .sort({ studentClass: 1, rollNumber: 1 });

    const studentsByYear = {
      'I': [],
      'II': [],
      'III': [],
      'IV': []
    };

    students.forEach(student => {
      if (studentsByYear[student.year]) {
        studentsByYear[student.year].push(student);
      } else {
        studentsByYear[student.year] = [student];
      }
    });

    res.json({
      success: true,
      students,
      studentsByYear
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single student
router.get('/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('userId', 'name email');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new student
router.post('/students', async (req, res) => {
  try {
    const { name, email, password, rollNumber, department, year } = req.body;

    // Create user
    const user = await User.create({
      name,
      email,
      password: password || 'password123', // Default password, should be changed
      role: 'student'
    });

    // Create student profile
    const student = await Student.create({
      userId: user._id,
      rollNumber,
      department,
      year
    });

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      student: await Student.findById(student._id).populate('userId', 'name email')
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update student
router.put('/students/:id', async (req, res) => {
  try {
    const { rollNumber, department, year } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (rollNumber) student.rollNumber = rollNumber;
    if (department) student.department = department;
    if (year) student.year = year;

    await student.save();

    res.json({
      success: true,
      message: 'Student updated successfully',
      student: await Student.findById(student._id).populate('userId', 'name email')
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete student
router.delete('/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Delete user
    await User.findByIdAndDelete(student.userId);
    // Delete student
    await Student.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get daily attendance
router.get('/attendance/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const { year, studentClass } = req.query;

    let query = {
      date: { $gte: targetDate, $lt: nextDay }
    };

    // Determine student filter based on faculty department
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (faculty && req.user.role !== 'admin') {
      const dept = faculty.department;

      let studentFilter = {
        studentClass: { $regex: new RegExp(`^${dept}(-[A-Z]+)?$`) }
      };

      if (year && year !== 'All') studentFilter.year = year;
      if (studentClass && studentClass !== 'All') studentFilter.studentClass = studentClass;

      const studentsInDept = await Student.find(studentFilter).select('_id');

      const studentIds = studentsInDept.map(s => s._id);
      query.studentId = { $in: studentIds };
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: 'studentId',
        populate: { path: 'userId', select: 'name email' }
      })
      .sort({ time: -1 });

    res.json({
      success: true,
      attendance,
      date: targetDate.toISOString().split('T')[0],
      count: attendance.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance by date range
router.get('/attendance/range', async (req, res) => {
  try {
    const { startDate, endDate, studentId } = req.query;

    let query = {};

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (studentId) {
      query.studentId = studentId;
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: 'studentId',
        populate: { path: 'userId', select: 'name email' }
      })
      .sort({ date: -1, time: -1 });

    res.json({
      success: true,
      attendance,
      count: attendance.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Manual attendance override
router.post('/attendance/manual', async (req, res) => {
  try {
    const { studentId, date, time, status, remarks, course } = req.body;

    if (!studentId || !date) {
      return res.status(400).json({ message: 'Student ID and date are required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists
    const existing = await Attendance.findOne({
      studentId,
      date: { $gte: attendanceDate, $lt: new Date(attendanceDate.getTime() + 86400000) }
    });

    if (existing) {
      // Update existing
      existing.status = status || 'present';
      existing.time = time || new Date().toLocaleTimeString('en-US', { hour12: false });
      existing.remarks = remarks;
      existing.markedBy = 'manual';
      if (course) existing.course = course;
      await existing.save();

      return res.json({
        success: true,
        message: 'Attendance updated successfully',
        attendance: existing
      });
    }

    // Create new
    const attendance = await Attendance.create({
      studentId,
      userId: student.userId,
      date: attendanceDate,
      time: time || new Date().toLocaleTimeString('en-US', { hour12: false }),
      status: status || 'present',
      markedBy: 'manual',
      remarks: remarks,
      course: course || 'Unknown',
      rollNumber: student.rollNumber,
      studentClass: student.studentClass,
      year: student.year,
      faceVerified: false,
      bleVerified: false
    });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      attendance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance statistics
router.get('/attendance/stats', async (req, res) => {
  try {
    const { startDate, endDate, year, studentClass, course } = req.query;

    let dateQuery = {};
    if (startDate || endDate) {
      dateQuery.date = {};
      if (startDate) dateQuery.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.date.$lte = end;
      }
    } else if (course && course !== 'All') {
      // Default to TODAY if course selected without dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      dateQuery.date = { $gte: today, $lte: endOfToday };
    }

    // Determine student filter based on faculty department
    let studentQuery = {};
    
    // Apply year and class filters if provided
    if (year && year !== 'All') studentQuery.year = year;
    if (studentClass && studentClass !== 'All') studentQuery.studentClass = studentClass;

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (faculty && req.user.role !== 'admin') {
      const dept = faculty.department;
      if (!studentQuery.studentClass) {
        studentQuery.studentClass = { $regex: new RegExp(`^${dept}(-[A-Z]+)?$`) };
      }
    }

    // Statistics based on the filtered students
    const studentsInDept = await Student.find(studentQuery).populate('userId', 'name email');
    const studentIds = studentsInDept.map(s => s._id);
    
    // Update dateQuery to only include these students
    dateQuery.studentId = { $in: studentIds };

    // Course filter (maps to course in Attendance schema)
    if (course && course !== 'All') {
      dateQuery.course = course;
    }

    const presentCount = await Attendance.countDocuments({ ...dateQuery, status: 'present' });
    const lateCount = await Attendance.countDocuments({ ...dateQuery, status: 'late' });
    const totalPresent = presentCount + lateCount;

    const totalStudents = studentsInDept.length;
    const absentCount = Math.max(0, totalStudents - totalPresent);

    const studentsWithFace = studentsInDept.filter(s => s.faceDescriptor && s.faceDescriptor.length > 0).length;

    // Student list for selected course (Filtered by the selected date range)
    let studentList = [];
    if (course && course !== 'All') {
      // Use the same date range as used for the stats
      let finalDateFilter = dateQuery.date;
      
      // Fallback if somehow dateQuery.date isn't set (shouldn't happen with new frontend)
      if (!finalDateFilter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextDay = new Date(today);
        nextDay.setHours(23, 59, 59, 999);
        finalDateFilter = { $gte: today, $lte: nextDay };
      }

      const courseAttendance = await Attendance.find({
        course: course,
        date: finalDateFilter,
        studentId: { $in: studentIds }
      });

      studentList = studentsInDept.map(student => {
        const att = courseAttendance.find(a => a.studentId.toString() === student._id.toString());
        return {
          _id: student._id,
          name: student.userId?.name || 'Unknown',
          rollNumber: student.rollNumber,
          status: att ? att.status : 'absent',
          time: att ? att.time : null
        };
      }).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
    }

    // Breakdown processing
    const breakdown = {
      'I': {},
      'II': {},
      'III': {},
      'IV': {}
    };

    studentsInDept.forEach(student => {
      const { year, studentClass } = student;
      if (breakdown[year]) {
        if (!breakdown[year][studentClass]) {
          breakdown[year][studentClass] = 0;
        }
        breakdown[year][studentClass]++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalStudents,
        presentCount,
        absentCount,
        lateCount,
        attendanceRate: totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(2) : 0,
        studentsWithFace,
        faceRegistrationRate: totalStudents > 0 ? ((studentsWithFace / totalStudents) * 100).toFixed(2) : 0,
        breakdown,
        studentList
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export attendance report (CSV format)
router.get('/attendance/export', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: 'studentId',
        populate: { path: 'userId', select: 'name email' }
      })
      .sort({ date: -1, time: -1 });

    // Generate CSV
    const csvHeader = 'Date,Time,Student Name,Roll Number,Status,Course,Face Verified,BLE Verified,Marked By\n';
    const csvRows = attendance.map(record => {
      const student = record.studentId;
      const user = student?.userId;
      return [
        new Date(record.date).toLocaleDateString(),
        record.time,
        user?.name || 'N/A',
        student?.rollNumber || 'N/A',
        record.status,
        record.course || 'N/A',
        record.faceVerified ? 'Yes' : 'No',
        record.bleVerified ? 'Yes' : 'No',
        record.markedBy
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

