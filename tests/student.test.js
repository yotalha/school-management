const request = require('supertest');
const { setup, teardown } = require('./setup');

let app;
let superadminToken;
let schoolAdminToken;
let schoolId;
let school2Id;
let classroomId;
let classroom2Id;
let studentId;

beforeAll(async () => {
    app = await setup();

    // Register superadmin
    const regRes = await request(app)
        .post('/api/user/register')
        .send({ username: 'superadmin', email: 'super@test.com', password: 'password123', role: 'superadmin' });
    superadminToken = regRes.body.data.shortToken;

    // Create school 1
    const schoolRes = await request(app)
        .post('/api/school/createSchool')
        .set('token', superadminToken)
        .send({ name: 'School One', address: '123 First St', email: 'school1@test.com' });
    schoolId = schoolRes.body.data.school._id;

    // Create school 2 (for transfer tests)
    const school2Res = await request(app)
        .post('/api/school/createSchool')
        .set('token', superadminToken)
        .send({ name: 'School Two', address: '456 Second St', email: 'school2@test.com' });
    school2Id = school2Res.body.data.school._id;

    // Create classrooms
    const classRes = await request(app)
        .post('/api/classroom/createClassroom')
        .set('token', superadminToken)
        .send({ name: 'Room A', capacity: 2, schoolId });
    classroomId = classRes.body.data.classroom._id;

    const class2Res = await request(app)
        .post('/api/classroom/createClassroom')
        .set('token', superadminToken)
        .send({ name: 'Room B', capacity: 30, schoolId: school2Id });
    classroom2Id = class2Res.body.data.classroom._id;

    // Create school admin
    await request(app)
        .post('/api/user/createSchoolAdmin')
        .set('token', superadminToken)
        .send({ username: 'schooladmin', email: 'admin@school.com', password: 'password123', schoolId });

    const loginRes = await request(app)
        .post('/api/user/login')
        .send({ email: 'admin@school.com', password: 'password123' });
    schoolAdminToken = loginRes.body.data.shortToken;
});

afterAll(async () => {
    await teardown();
});

describe('Create Student', () => {
    test('should create student as superadmin', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('token', superadminToken)
            .send({ firstName: 'John', lastName: 'Doe', email: 'john@student.com', schoolId, dateOfBirth: '2010-05-15' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student.firstName).toBe('John');
        expect(res.body.data.student.lastName).toBe('Doe');
        expect(res.body.data.student.schoolId).toBe(schoolId);
        studentId = res.body.data.student._id;
    });

    test('should create student as school_admin (auto-scoped)', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('token', schoolAdminToken)
            .send({ firstName: 'Jane', lastName: 'Smith', email: 'jane@student.com' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student.schoolId).toBe(schoolId);
    });

    test('should not create student with missing required fields', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('token', superadminToken)
            .send({ firstName: 'Missing', schoolId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should not create student with duplicate email', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('token', superadminToken)
            .send({ firstName: 'Dup', lastName: 'Student', email: 'john@student.com', schoolId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Student with this email already exists');
    });

    test('should not create student for non-existent school', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('token', superadminToken)
            .send({ firstName: 'No', lastName: 'School', email: 'noschool@student.com', schoolId: '507f1f77bcf86cd799439011' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('School not found');
    });
});

describe('Get Student', () => {
    test('should get student by id', async () => {
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('token', superadminToken)
            .query({ studentId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student.firstName).toBe('John');
    });

    test('should get student as school_admin of same school', async () => {
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('token', schoolAdminToken)
            .query({ studentId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('should return error for non-existent student', async () => {
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('token', superadminToken)
            .query({ studentId: '507f1f77bcf86cd799439011' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});

describe('Get Students', () => {
    test('superadmin should get all students', async () => {
        const res = await request(app)
            .get('/api/student/getStudents')
            .set('token', superadminToken);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.students.length).toBeGreaterThanOrEqual(2);
    });

    test('school_admin should get only their school students', async () => {
        const res = await request(app)
            .get('/api/student/getStudents')
            .set('token', schoolAdminToken);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        res.body.data.students.forEach(s => {
            const sid = s.schoolId._id || s.schoolId;
            expect(sid).toBe(schoolId);
        });
    });

    test('superadmin can filter by schoolId', async () => {
        const res = await request(app)
            .get('/api/student/getStudents')
            .set('token', superadminToken)
            .query({ schoolId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.students.length).toBeGreaterThanOrEqual(1);
    });
});

describe('Update Student', () => {
    test('should update student', async () => {
        const res = await request(app)
            .put('/api/student/updateStudent')
            .set('token', superadminToken)
            .send({ studentId, firstName: 'Johnny' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student.firstName).toBe('Johnny');
        expect(res.body.data.student.lastName).toBe('Doe');
    });

    test('school_admin should update student in their school', async () => {
        const res = await request(app)
            .put('/api/student/updateStudent')
            .set('token', schoolAdminToken)
            .send({ studentId, lastName: 'Updated' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student.lastName).toBe('Updated');
    });
});

describe('Enroll Student', () => {
    test('should enroll student in classroom', async () => {
        const res = await request(app)
            .post('/api/student/enrollStudent')
            .set('token', superadminToken)
            .send({ studentId, classroomId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.message).toContain('enrolled successfully');
    });

    test('should not enroll in classroom at full capacity', async () => {
        // Classroom capacity is 2, one student already enrolled
        // Enroll second student
        const students = await request(app)
            .get('/api/student/getStudents')
            .set('token', superadminToken)
            .query({ schoolId });
        const secondStudent = students.body.data.students.find(s => s.email === 'jane@student.com');

        await request(app)
            .post('/api/student/enrollStudent')
            .set('token', superadminToken)
            .send({ studentId: secondStudent._id, classroomId });

        // Create a third student and try to enroll
        const thirdRes = await request(app)
            .post('/api/student/createStudent')
            .set('token', superadminToken)
            .send({ firstName: 'Third', lastName: 'Student', email: 'third@student.com', schoolId });
        const thirdId = thirdRes.body.data.student._id;

        const res = await request(app)
            .post('/api/student/enrollStudent')
            .set('token', superadminToken)
            .send({ studentId: thirdId, classroomId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Classroom is at full capacity');
    });

    test('should not enroll in classroom from different school', async () => {
        const res = await request(app)
            .post('/api/student/enrollStudent')
            .set('token', superadminToken)
            .send({ studentId, classroomId: classroom2Id });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain("Classroom does not belong to the student's school");
    });
});

describe('Transfer Student', () => {
    test('should transfer student as superadmin', async () => {
        const res = await request(app)
            .post('/api/student/transferStudent')
            .set('token', superadminToken)
            .send({ studentId, targetSchoolId: school2Id, targetClassroomId: classroom2Id });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.message).toContain('transferred successfully');

        const studentSchoolId = res.body.data.student.schoolId._id || res.body.data.student.schoolId;
        expect(studentSchoolId).toBe(school2Id);
    });

    test('should not transfer student as school_admin', async () => {
        const res = await request(app)
            .post('/api/student/transferStudent')
            .set('token', schoolAdminToken)
            .send({ studentId, targetSchoolId: schoolId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Only superadmins can transfer students between schools');
    });

    test('should not transfer to non-existent school', async () => {
        const res = await request(app)
            .post('/api/student/transferStudent')
            .set('token', superadminToken)
            .send({ studentId, targetSchoolId: '507f1f77bcf86cd799439011' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Target school not found');
    });
});

describe('Delete Student', () => {
    test('should delete student (soft delete)', async () => {
        // Create a student to delete
        const createRes = await request(app)
            .post('/api/student/createStudent')
            .set('token', superadminToken)
            .send({ firstName: 'Delete', lastName: 'Me', email: 'deleteme@student.com', schoolId });
        const deleteId = createRes.body.data.student._id;

        const res = await request(app)
            .delete('/api/student/deleteStudent')
            .set('token', superadminToken)
            .send({ studentId: deleteId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        // Verify soft-deleted
        const getRes = await request(app)
            .get('/api/student/getStudent')
            .set('token', superadminToken)
            .query({ studentId: deleteId });

        expect(getRes.body.ok).toBe(false);
    });

    test('should not delete non-existent student', async () => {
        const res = await request(app)
            .delete('/api/student/deleteStudent')
            .set('token', superadminToken)
            .send({ studentId: '507f1f77bcf86cd799439011' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});
