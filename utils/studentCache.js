const Student = require('../models/Student');

/**
 * 🚀 In-memory cache for ultra-fast student lookups.
 * Key: permanentId (PermID from ESP32/Flutter)
 * Value: full student object
 */
let permIdCache = new Map();

/**
 * Key: rollNumber
 * Value: full student object
 */
let rollNumberCache = new Map();

/**
 * Load all students from MongoDB into memory.
 * Call this when the server starts.
 */
const initStudentCache = async () => {
    try {
        console.log("📥 Loading students into cache...");
        const students = await Student.find({});
        
        permIdCache.clear();
        rollNumberCache.clear();

        students.forEach(student => {
            if (student.permanentId && !student.permanentId.startsWith('PENDING_')) {
                permIdCache.set(student.permanentId, student);
            }
            if (student.rollNumber) {
                rollNumberCache.set(student.rollNumber.toUpperCase(), student);
            }
        });

        console.log(`✅ Student cache ready: ${permIdCache.size} devices mapped, ${rollNumberCache.size} roll numbers registered.`);
    } catch (err) {
        console.error("❌ Failed to initialize student cache:", err.message);
    }
};

/**
 * Get student by PermID (Ultra Fast)
 */
const getStudentByPermId = (permId) => {
    if (!permId) return null;
    const cleanId = permId.trim();
    return permIdCache.get(cleanId) || null;
};

/**
 * Get student by Roll Number (Ultra Fast)
 */
const getStudentByRoll = (roll) => {
    if (!roll) return null;
    const cleanRoll = roll.trim().toUpperCase();
    return rollNumberCache.get(cleanRoll) || null;
};

/**
 * Update a specific student in the cache when they register or update profile
 */
const updateStudentInCache = (student) => {
    if (!student) return;
    
    // We update even if it starts with PENDING_ if the student actually has it, 
    // but typically we'd only want "real" IDs in the permIdCache.
    if (student.permanentId && !student.permanentId.startsWith('PENDING_')) {
        permIdCache.set(student.permanentId, student);
    }
    if (student.rollNumber) {
        rollNumberCache.set(student.rollNumber.toUpperCase(), student);
    }
};

/**
 * Remove a student from the cache (e.g. when deleted)
 */
const removeFromCache = (student) => {
    if (!student) return;
    
    if (student.permanentId) {
        permIdCache.delete(student.permanentId);
    }
    if (student.rollNumber) {
        rollNumberCache.delete(student.rollNumber.toUpperCase());
    }
};

module.exports = {
    initStudentCache,
    getStudentByPermId,
    getStudentByRoll,
    updateStudentInCache,
    removeFromCache
};
