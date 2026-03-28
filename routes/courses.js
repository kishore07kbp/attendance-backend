const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/auth');

// POST /api/courses
// For Faculty to create a course
router.post('/', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const { title, year, studentClass, day, startTime, endTime } = req.body;

    if (!title || !year || !studentClass || !day || !startTime || !endTime) {
      return res.status(400).json({ message: 'Please provide all course fields' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty profile not found' });

    const course = await Course.create({
      title: title.trim(),
      year,
      studentClass,
      day,
      startTime,
      endTime,
      facultyId: faculty._id,
      facultyName: faculty.name
    });

    res.status(201).json({ success: true, course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/courses/faculty
// Get courses created by this faculty
router.get('/faculty', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) return res.status(404).json({ message: 'Faculty profile not found' });

    const courses = await Course.find({ facultyId: faculty._id }).sort({ createdAt: -1 });
    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/courses/student
// Get courses for this student's year and class
router.get('/student', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const courses = await Course.find({
      year: student.year,
      studentClass: student.studentClass
    }).sort({ title: 1 });

    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/courses/:id
// Delete a specific course
router.delete('/:id', protect, authorize('faculty', 'admin'), async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty && req.user.role !== 'admin') {
      return res.status(404).json({ message: 'Faculty profile not found' });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Verify this faculty member actually created the course, or is admin
    if (course.facultyId.toString() !== faculty._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this course' });
    }

    // Cleanup: Delete all attendance records associated with this course instance (Case-Insensitive Match)
    const deletedAttendance = await Attendance.deleteMany({
      course: { $regex: new RegExp(`^${course.title}$`, "i") },
      studentClass: course.studentClass,
      year: course.year
    });

    console.log(`✅ Course Deleted: ${course.title} | Wiped ${deletedAttendance.deletedCount} attendance records from DB.`);

    await Course.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Course deleted and all linked database records were permanently removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
