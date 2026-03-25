const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get list of classrooms (for attendance verification dropdown)
router.get('/', protect, async (req, res) => {
  try {
    const classrooms = ['Main Hall', 'Lab 101', 'Room 201', 'Room 202', 'Lecture Hall A'];
    res.json({ success: true, classrooms });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
