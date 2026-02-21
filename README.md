# School Management System API

A RESTful API for managing schools, classrooms, and students with role-based access control (RBAC).

## Features

- **Role-Based Access Control (RBAC)**
  - **Superadmin**: Full system access - can manage all schools, classrooms, and students
  - **School Admin**: School-specific access - can only manage their assigned school's resources

- **Entity Management**
  - Schools: CRUD operations (Superadmin only)
  - Classrooms: CRUD operations with capacity management
  - Students: CRUD operations with enrollment and transfer capabilities

- **Security**
  - JWT-based authentication (long token + short token system)
  - API rate limiting (100 requests/minute per IP)
  - Input validation on all endpoints
  - Password hashing with bcrypt

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis
- **Authentication**: JWT (jsonwebtoken)

## Installation

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- Redis (v6 or higher)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd axion
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
MONGO_URI=mongodb://localhost:27017/school_management
REDIS_URI=redis://127.0.0.1:6379
LONG_TOKEN_SECRET=your-secure-long-token-secret
SHORT_TOKEN_SECRET=your-secure-short-token-secret
NACL_SECRET=your-nacl-secret
```

5. Start the server:
```bash
npm start
```

The API will be available at `http://localhost:5111`

## API Documentation

### Base URL
```
http://localhost:5111/api
```

### Authentication

All protected endpoints require a JWT token in the `token` header:
```
token: <your-short-token>
```

---

### Authentication Endpoints

#### Register User
```http
POST /api/user/register
```
**Body:**
```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "securepassword123",
  "role": "superadmin"
}
```
**Response:**
```json
{
  "ok": true,
  "data": {
    "user": { "username": "admin", "email": "admin@example.com", "role": "superadmin" },
    "longToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Login
```http
POST /api/user/login
```
**Body:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword123"
}
```
**Response:**
```json
{
  "ok": true,
  "data": {
    "user": { ... },
    "longToken": "...",
    "shortToken": "..."
  }
}
```

#### Get Profile (Protected)
```http
GET /api/user/getProfile
Headers: token: <short-token>
```

#### Create School Admin (Superadmin only)
```http
POST /api/user/createSchoolAdmin
Headers: token: <short-token>
```
**Body:**
```json
{
  "username": "schooladmin",
  "email": "schooladmin@school.com",
  "password": "password123",
  "schoolId": "<school-id>"
}
```

---

### School Endpoints (Superadmin only for create/update/delete)

#### Create School
```http
POST /api/school/createSchool
Headers: token: <short-token>
```
**Body:**
```json
{
  "name": "Springfield Elementary",
  "address": "123 Education St, Springfield",
  "phone": "+1234567890",
  "email": "info@springfield.edu"
}
```

#### Get School
```http
GET /api/school/getSchool
Headers: token: <short-token>
```
**Body:**
```json
{
  "schoolId": "<school-id>"
}
```

#### Get All Schools
```http
GET /api/school/getAllSchools
Headers: token: <short-token>
```

#### Update School
```http
PUT /api/school/updateSchool
Headers: token: <short-token>
```
**Body:**
```json
{
  "schoolId": "<school-id>",
  "name": "Updated School Name",
  "address": "New Address"
}
```

#### Delete School
```http
DELETE /api/school/deleteSchool
Headers: token: <short-token>
```
**Body:**
```json
{
  "schoolId": "<school-id>"
}
```

---

### Classroom Endpoints

#### Create Classroom
```http
POST /api/classroom/createClassroom
Headers: token: <short-token>
```
**Body:**
```json
{
  "name": "Class 1A",
  "capacity": 30,
  "resources": ["Projector", "Whiteboard", "Computer"],
  "schoolId": "<school-id>"
}
```
*Note: School admins don't need to provide schoolId - it uses their assigned school*

#### Get Classroom
```http
GET /api/classroom/getClassroom
Headers: token: <short-token>
```
**Body:**
```json
{
  "classroomId": "<classroom-id>"
}
```

#### Get Classrooms
```http
GET /api/classroom/getClassrooms
Headers: token: <short-token>
```
**Body (optional):**
```json
{
  "schoolId": "<school-id>"
}
```

#### Update Classroom
```http
PUT /api/classroom/updateClassroom
Headers: token: <short-token>
```
**Body:**
```json
{
  "classroomId": "<classroom-id>",
  "name": "Updated Class Name",
  "capacity": 35
}
```

#### Delete Classroom
```http
DELETE /api/classroom/deleteClassroom
Headers: token: <short-token>
```
**Body:**
```json
{
  "classroomId": "<classroom-id>"
}
```

---

### Student Endpoints

#### Create Student
```http
POST /api/student/createStudent
Headers: token: <short-token>
```
**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@student.com",
  "dateOfBirth": "2010-05-15",
  "schoolId": "<school-id>",
  "classroomId": "<classroom-id>"
}
```

#### Get Student
```http
GET /api/student/getStudent
Headers: token: <short-token>
```
**Body:**
```json
{
  "studentId": "<student-id>"
}
```

#### Get Students
```http
GET /api/student/getStudents
Headers: token: <short-token>
```
**Body (optional):**
```json
{
  "schoolId": "<school-id>",
  "classroomId": "<classroom-id>"
}
```

#### Update Student
```http
PUT /api/student/updateStudent
Headers: token: <short-token>
```
**Body:**
```json
{
  "studentId": "<student-id>",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

#### Delete Student
```http
DELETE /api/student/deleteStudent
Headers: token: <short-token>
```
**Body:**
```json
{
  "studentId": "<student-id>"
}
```

#### Enroll Student in Classroom
```http
POST /api/student/enrollStudent
Headers: token: <short-token>
```
**Body:**
```json
{
  "studentId": "<student-id>",
  "classroomId": "<classroom-id>"
}
```

#### Transfer Student (Superadmin only)
```http
POST /api/student/transferStudent
Headers: token: <short-token>
```
**Body:**
```json
{
  "studentId": "<student-id>",
  "targetSchoolId": "<school-id>",
  "targetClassroomId": "<classroom-id>"
}
```

---

## Response Format

### Success Response
```json
{
  "ok": true,
  "data": { ... },
  "errors": [],
  "message": ""
}
```

### Error Response
```json
{
  "ok": false,
  "data": {},
  "errors": "Error message or validation errors",
  "message": ""
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `429` - Too Many Requests (Rate Limited)
- `500` - Server Error

---

## Database Schema

### User
```javascript
{
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  role: 'superadmin' | 'school_admin',
  schoolId: ObjectId (ref: School, for school_admin only),
  isActive: Boolean
}
```

### School
```javascript
{
  name: String (unique),
  address: String,
  phone: String,
  email: String (unique),
  isActive: Boolean
}
```

### Classroom
```javascript
{
  name: String,
  schoolId: ObjectId (ref: School),
  capacity: Number (default: 30),
  resources: [String],
  isActive: Boolean
}
```

### Student
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  dateOfBirth: Date,
  schoolId: ObjectId (ref: School),
  classroomId: ObjectId (ref: Classroom),
  enrollmentDate: Date,
  isActive: Boolean
}
```

---

## Rate Limiting

The API implements rate limiting with the following defaults:
- **Window**: 60 seconds
- **Max Requests**: 100 per window per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

---

## Security Considerations

1. **JWT Tokens**: Use strong, unique secrets for `LONG_TOKEN_SECRET` and `SHORT_TOKEN_SECRET`
2. **Password Storage**: All passwords are hashed using bcrypt with salt rounds
3. **Input Validation**: All inputs are validated before processing
4. **Role-Based Access**: Strict RBAC prevents unauthorized access to resources
5. **Rate Limiting**: Protects against brute force and DoS attacks

---

## License

ISC
