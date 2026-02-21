const request = require('supertest');
const { setup, teardown } = require('./setup');

let app;
let superadminToken;
let schoolAdminToken;
let schoolId;
let classroomId;

beforeAll(async () => {
    app = await setup();

    // Register superadmin
    const regRes = await request(app)
        .post('/api/user/register')
        .send({ username: 'superadmin', email: 'super@test.com', password: 'password123', role: 'superadmin' });
    superadminToken = regRes.body.data.shortToken;

    // Create school
    const schoolRes = await request(app)
        .post('/api/school/createSchool')
        .set('token', superadminToken)
        .send({ name: 'Test School', address: '123 Test St', email: 'school@test.com' });
    schoolId = schoolRes.body.data.school._id;

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

describe('Create Classroom', () => {
    test('should create classroom as superadmin with schoolId', async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('token', superadminToken)
            .send({ name: 'Room 101', capacity: 30, schoolId, resources: ['Projector', 'Whiteboard'] });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classroom.name).toBe('Room 101');
        expect(res.body.data.classroom.capacity).toBe(30);
        expect(res.body.data.classroom.resources).toContain('Projector');
        classroomId = res.body.data.classroom._id;
    });

    test('should create classroom as school_admin (auto-scoped to their school)', async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('token', schoolAdminToken)
            .send({ name: 'Room 102', capacity: 25 });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classroom.schoolId).toBe(schoolId);
    });

    test('should not create duplicate classroom in same school', async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('token', superadminToken)
            .send({ name: 'Room 101', schoolId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Classroom with this name already exists in this school');
    });

    test('should not create classroom with missing name', async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('token', superadminToken)
            .send({ schoolId, capacity: 30 });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should not create classroom for non-existent school', async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('token', superadminToken)
            .send({ name: 'Ghost Room', schoolId: '507f1f77bcf86cd799439011' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('School not found');
    });
});

describe('Get Classroom', () => {
    test('should get classroom by id', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassroom')
            .set('token', superadminToken)
            .query({ classroomId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classroom.name).toBe('Room 101');
    });

    test('should get classroom as school_admin of same school', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassroom')
            .set('token', schoolAdminToken)
            .query({ classroomId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('should not get classroom without classroomId', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassroom')
            .set('token', superadminToken);

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});

describe('Get Classrooms', () => {
    test('superadmin should get all classrooms', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassrooms')
            .set('token', superadminToken);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classrooms.length).toBeGreaterThanOrEqual(2);
    });

    test('school_admin should get only their school classrooms', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassrooms')
            .set('token', schoolAdminToken);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        res.body.data.classrooms.forEach(c => {
            expect(c.schoolId._id || c.schoolId).toBe(schoolId);
        });
    });

    test('superadmin can filter by schoolId', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassrooms')
            .set('token', superadminToken)
            .query({ schoolId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classrooms.length).toBeGreaterThanOrEqual(1);
    });
});

describe('Update Classroom', () => {
    test('should update classroom as superadmin', async () => {
        const res = await request(app)
            .put('/api/classroom/updateClassroom')
            .set('token', superadminToken)
            .send({ classroomId, capacity: 40 });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classroom.capacity).toBe(40);
    });

    test('should update classroom as school_admin of same school', async () => {
        const res = await request(app)
            .put('/api/classroom/updateClassroom')
            .set('token', schoolAdminToken)
            .send({ classroomId, resources: ['Projector', 'Whiteboard', 'Computer'] });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classroom.resources).toContain('Computer');
    });
});

describe('Delete Classroom', () => {
    test('should delete empty classroom', async () => {
        // Create a classroom to delete
        const createRes = await request(app)
            .post('/api/classroom/createClassroom')
            .set('token', superadminToken)
            .send({ name: 'To Delete', schoolId });
        const deleteId = createRes.body.data.classroom._id;

        const res = await request(app)
            .delete('/api/classroom/deleteClassroom')
            .set('token', superadminToken)
            .send({ classroomId: deleteId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        // Verify soft-deleted
        const getRes = await request(app)
            .get('/api/classroom/getClassroom')
            .set('token', superadminToken)
            .query({ classroomId: deleteId });

        expect(getRes.body.ok).toBe(false);
    });

    test('should not delete classroom with enrolled students', async () => {
        // Create a student in the classroom
        await request(app)
            .post('/api/student/createStudent')
            .set('token', superadminToken)
            .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane@student.com', schoolId, classroomId });

        const res = await request(app)
            .delete('/api/classroom/deleteClassroom')
            .set('token', superadminToken)
            .send({ classroomId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Cannot delete classroom with enrolled students. Transfer them first.');
    });
});
