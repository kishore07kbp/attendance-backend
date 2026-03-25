const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const dropDevices = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const collections = await mongoose.connection.db.listCollections().toArray();
    const devicesExists = collections.some(col => col.name === 'devices');

    if (devicesExists) {
      console.log('Dropping devices collection...');
      await mongoose.connection.db.dropCollection('devices');
      console.log('Collection dropped successfully.');
    } else {
      console.log('Devices collection does not exist.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error dropping collection:', error);
    process.exit(1);
  }
};

dropDevices();
