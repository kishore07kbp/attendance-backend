const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const dirs = [
  'C:\\Users\\sanjay M\\Desktop\\attendance project\\backend',
  'C:\\Users\\sanjay M\\Desktop\\attendance project\\frontend\\src'
];

async function updateDB() {
    console.log('Connecting to DB...');
    await mongoose.connect('mongodb+srv://sanjay2005:Sanjay2005@cluster0.ia4h7.mongodb.net/smart_attendance?retryWrites=true&w=majority&appName=Cluster0');
    const db = mongoose.connection.db;

    try {
        await db.collection('faculties').rename('faculty');
        console.log('Renamed collection faculties to faculty');
    } catch(err) {
        console.log('Error renaming collection (maybe already renamed):', err.message);
    }
    
    await db.collection('users').updateMany({ role: 'faculty' }, { $set: { role: 'faculty' } });
    console.log('Updated user roles');

    await db.collection('courses').updateMany({}, { $rename: { 'facultyId': 'facultyId', 'facultyName': 'facultyName' }});
    console.log('Renamed fields in courses');

    await db.collection('faculty').updateMany({}, { $rename: { 'facultyId': 'facultyId', 'facultyName': 'facultyName' }});
    console.log('Renamed fields in faculty');

    console.log('DB Update complete');
}

function processFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === 'package-lock.json' || file.startsWith('.')) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            processFiles(fullPath);
        } else {
            if (!file.match(/\.(js|jsx|css|json)$/)) continue;
            
            let content = fs.readFileSync(fullPath, 'utf8');
            const originalContent = content;

            // Replacing faculties to faculties first to prevent double replacement issues
            content = content.replace(/Faculties/g, 'Faculties');
            content = content.replace(/faculties/g, 'faculties');
            content = content.replace(/FACULTIES/g, 'FACULTIES');

            content = content.replace(/Faculty/g, 'Faculty');
            content = content.replace(/faculty/g, 'faculty');
            content = content.replace(/FACULTY/g, 'FACULTY');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated content in ${fullPath}`);
            }
            
            const newFile = file.replace(/Faculties/g, 'Faculties').replace(/faculties/g, 'faculties').replace(/Faculty/g, 'Faculty').replace(/faculty/g, 'faculty');
            if (file !== newFile) {
                const newFullPath = path.join(dir, newFile);
                fs.renameSync(fullPath, newFullPath);
                console.log(`Renamed file ${file} to ${newFile}`);
            }
        }
    }
}

async function run() {
    await updateDB();
    for(const dir of dirs) {
        processFiles(dir);
    }
    process.exit(0);
}

run();
