const cron = require('node-cron');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Faculty = require('../models/Faculty');
const sendEmail = require('./emailSender');

/**
 * Parses time string like "10:00 AM" or "02:30 PM" into minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return -1;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return -1;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const meridiem = match[3].toUpperCase();
  
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

const sendAbsentList = async () => {
  try {
    // 1. Calculate current time in IST (Asia/Kolkata)
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
    if (currentDay === 'Sunday') return; // Skip Sundays

    const currentHour = parseInt(timeParts.hour);
    const currentMinute = parseInt(timeParts.minute);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // We want courses that started EXACTLY 30 minutes ago
    const targetStartTimeMinutes = currentTimeInMinutes - 30;
    
    // Fetch all courses for today
    const courses = await Course.find({ day: currentDay });
    
    for (const course of courses) {
      const courseStartTimeMinutes = parseTimeToMinutes(course.startTime);
      
      // If the course started exactly 30 minutes ago
      if (courseStartTimeMinutes === targetStartTimeMinutes) {
        console.log(`[Scheduler] 30m mark reached for ${course.title}. Fetching absentees...`);
        
        // 1. Find the Class Advisor for this specific class/year
        const classAdvisor = await Faculty.findOne({
          classAdvisorClass: course.studentClass,
          classAdvisorYear: course.year
        });
        
        if (!classAdvisor || !classAdvisor.email) {
          console.warn(`[Scheduler] No advisor found or missing email for ${course.studentClass} ${course.year} Year`);
          continue;
        }

        // 2. Find all students in this class/year
        const students = await Student.find({
          studentClass: course.studentClass,
          year: course.year
        });
        
        if (students.length === 0) continue;

        // 3. Find who marked attendance TODAY for THIS course
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        
        const attendances = await Attendance.find({
          course: course.title,
          date: { $gte: todayStart, $lte: todayEnd },
          status: 'present'
        });
        
        const presentStudentIds = attendances.map(a => a.studentId.toString());
        
        // 4. Identify absent students
        const absentStudents = students.filter(s => !presentStudentIds.includes(s._id.toString()));
        
        if (absentStudents.length === 0) {
          console.log(`[Scheduler] All students present for ${course.title}. No email sent.`);
          continue;
        }

        // 5. Send Email to Advisor
        const studentListHtml = absentStudents.map(s => 
          `<li><b>${s.name}</b> (${s.rollNumber})</li>`
        ).join('');

        const emailOptions = {
          email: classAdvisor.email,
          subject: `Absent Students List: ${course.title} (${course.studentClass} - ${course.year} Year)`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
              <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">Absent Students Alert</h2>
              <p>Hello <b>${classAdvisor.name}</b>,</p>
              <p>The following students are marked <b>ABSENT</b> for the ongoing class:</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><b>Course:</b> ${course.title}</p>
                <p><b>Class:</b> ${course.studentClass} (${course.year} Year)</p>
                <p><b>Schedule:</b> ${course.startTime} - ${course.endTime}</p>
              </div>
              <h3>List of Absentees:</h3>
              <ul>
                ${studentListHtml}
              </ul>
              <p style="font-size: 0.8em; color: #6b7280; margin-top: 30px;">
                This is an automated notification from the Smart Attendance System.
              </p>
            </div>
          `
        };

        await sendEmail(emailOptions);
        // 🔥 Print console log as requested
        console.log(`✅ The absent list email is sent to the class advisor email (${classAdvisor.email}) for course: ${course.title}`);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error in sendAbsentList:', error);
  }
};

// Schedule to run every minute
cron.schedule('* * * * *', () => {
  sendAbsentList();
});

console.log('[Scheduler] Attendance email scheduler initialized (Asia/Kolkata IST).');
