const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const { protect } = require('../middleware/auth');

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
    const {
      name,
      email,
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
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      department: userRole !== 'student' ? department : undefined,
      studentClass: userRole === 'student' ? studentClass : undefined
    });

    // If student, create student profile
    if (userRole === 'student') {
      await Student.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        rollNumber,
        studentClass,
        year
      });
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
          // Temporarily delete the user we just created to maintain database integrity
          await User.findByIdAndDelete(user._id);
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
    const { email, password } = req.body;

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

