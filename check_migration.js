const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
const check = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const Attendance = mongoose.connection.db.collection('attendances');
    const first = await Attendance.findOne({});
    console.log(JSON.stringify(first, null, 2));
    process.exit(0);
};
check();
