const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const { protect } = require('../middleware/auth');
const { updateStudentInCache } = require('../utils/studentCache');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Register
router.post('/register', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase();
    const {
      name,
      password,
      role,
      rollNumber,
      department,
      studentClass,
      year,
      facultyId,
      designation,
      classAdvisorClass,
      classAdvisorYear
    } = req.body;

    // Validate required generic fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all core required fields' });
    }

    const userRole = role || 'student';
    if (userRole === 'student' && (!rollNumber || !year || !studentClass)) {
      return res.status(400).json({ message: 'Roll number, Class, and Year are required for students' });
    }
    if ((userRole === 'faculty' || userRole === 'admin') && (!facultyId || !department || !designation)) {
      return res.status(400).json({ message: 'Faculty ID, Department, and Designation are required for faculty' });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    
    // If user exists, but has no student profile (for a student user), allow re-registration to complete the profile
    if (user) {
      if (user.role === 'student') {
        const studentExists = await Student.findOne({ userId: user._id });
        if (studentExists) {
          return res.status(400).json({ message: 'User already exists' });
        }
        console.log(`User exists but missing student profile for ${email}. Completing profile...`);
      } else if (user.role === 'faculty' || user.role === 'admin') {
        const facultyExists = await Faculty.findOne({ userId: user._id });
        if (facultyExists) {
          return res.status(400).json({ message: 'User already exists' });
        }
        console.log(`User exists but missing faculty profile for ${email}. Completing profile...`);
      } else {
        return res.status(400).json({ message: 'User already exists' });
      }
    }

    let isNewUser = false;
    if (!user) {
      // Create user only if doesn't exist
      user = await User.create({
        name,
        email,
        password,
        role: userRole,
        department: userRole !== 'student' ? department : undefined,
        studentClass: userRole === 'student' ? studentClass : undefined
      });
      isNewUser = true;
    }

    try {
      // If student, create student profile
      if (userRole === 'student') {
        const student = await Student.create({
          userId: user._id,
          name: user.name,
          email: user.email,
          rollNumber,
          studentClass,
          year
        });

        // 🚀 Update RAM Cache
        updateStudentInCache(student);
      }

      // If faculty/admin, create faculty profile
      if (userRole === 'faculty' || userRole === 'admin') {
        // Check if another faculty is already advisor for this class/year
        if (classAdvisorClass && classAdvisorClass !== 'None' && classAdvisorYear && classAdvisorYear !== 'None') {
          const existingAdvisor = await Faculty.findOne({
            classAdvisorClass,
            classAdvisorYear
          });
          
          if (existingAdvisor) {
            // Delete the user we just created only if it was new
            if (isNewUser) await User.findByIdAndDelete(user._id);
            return res.status(400).json({ 
              message: `A Class Advisor is already assigned to ${classAdvisorClass} - ${classAdvisorYear} Year (${existingAdvisor.name}).` 
            });
          }
        }

        await Faculty.create({
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          facultyId: facultyId.trim(),
          department,
          designation,
          classAdvisorClass: classAdvisorClass || 'None',
          classAdvisorYear: classAdvisorYear || 'None'
        });
      }
    } catch (profileError) {
      // Cleanup if user was new
      if (isNewUser) await User.findByIdAndDelete(user._id);
      throw profileError;
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let studentData = null;
    if (user.role === 'student') {
      studentData = await Student.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      student: studentData
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
