const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
const check = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const Attendance = mongoose.connection.db.collection('attendances');
    const records = await Attendance.find({ rollNumber: /^\d{2}/ }).limit(5).toArray(); // looking for records that start with 2 numbers (likely roll numbers)
    console.log(JSON.stringify(records, null, 2));
    process.exit(0);
};
check();
