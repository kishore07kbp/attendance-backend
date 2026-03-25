# BunkTracer Backend API Documentation

## Base URL
`http://localhost:5000/api`

## Authentication
All protected routes require a JWT token in the header:
```
Authorization: Bearer <token>
```

---

## 🚦 Endpoints

### 🔐 Auth Routes (`/api/auth`)

#### Register
- **POST** `/api/auth/register`
- Body: `{ name, email, password, role, registrationNumber?, studentClass?, year? }`
- Returns: `{ success, token, user }`

#### Login
- **POST** `/api/auth/login`
- Body: `{ email, password }`
- Returns: `{ success, token, user }`

---

### 🎓 Student Routes (`/api/students`)

#### Get Profile
- **GET** `/api/students/profile`
- Returns: `{ success, student: { permanentId, studentClass, year, classAdvisorName, ... } }`

#### Register Face
- **POST** `/api/students/register-face`
- Body: `{ faceDescriptor: [Number] }`

#### Mark Attendance
- **POST** `/api/students/mark-attendance`
- Body: `{ faceDescriptor: [Number], rollNumber: String, course: String }`
- Returns: `{ success, message, attendance, faceVerified, bleVerified }`

#### Attendance History
- **GET** `/api/students/attendance-history`
- Returns: `{ success, attendance: [] }`

---

### 🏫 Course Routes (`/api/courses`)

#### Get Student Courses
- **GET** `/api/courses/student`
- Returns: Courses assigned to the student's Class and Year.

#### Get All Courses (Faculty/Admin)
- **GET** `/api/courses`
- Returns: List of all managed courses.

---

### 👨‍🏫 Staff/Faculty Routes (`/api/staff`)

#### Manage Students
- **GET** `/api/staff/students` - Get all students (paginated).
- **POST** `/api/staff/students` - Create student record.
- **PUT** `/api/staff/students/:id` - Update details (studentClass, year).
- **DELETE** `/api/staff/students/:id` - Remove student.

#### Attendance Management
- **GET** `/api/staff/attendance/daily` - View today's logs for a specific Course.
- **POST** `/api/staff/attendance/manual` - Manual override (requires `studentId`, `course`).

---

### 📡 Device & Scanning Routes (`/api/devices`)

#### Real-time Scan
- **POST** `/api/devices/scan`
- Body: `{ roll, permId, rssi }`
- Note: This endpoint is primarily used by ESP32 sensors to report detected hardware IDs.

#### Active Scans
- **GET** `/api/devices/active-scans`
- Returns: Current in-memory list of recently detected BLE devices.

---

## 🛠️ Data Models (Highlights)

### Student
- `permanentId`: Unique hardware identifier linked via mobile app.
- `studentClass`: e.g., "A", "B", "C".
- `year`: e.g., "I", "II", "III", "IV".

### Attendance
- `course`: Name of the subject/course.
- `rollNumber`: Student's unique registration ID.
- `status`: 'present', 'absent', 'late'.

---

## ❌ Error Handling
Errors follow the standard JSON structure:
```json
{
  "message": "Human readable error",
  "error": "Technical details (if in dev mode)"
}
```
