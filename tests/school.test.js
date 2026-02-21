const request = require('supertest');
const { setup, teardown, getApp } = require('./setup');

let app;
let superadminToken;
let schoolAdminToken;
let schoolId;

beforeAll(async () => {
    app = await setup();

    // Register superadmin
    const regRes = await request(app)
        .post('/api/user/register')
        .send({ username: 'superadmin', email: 'super@test.com', password: 'password123', role: 'superadmin' });
    superadminToken = regRes.body.data.shortToken;
});

afterAll(async () => {
    await teardown();
});

describe('Create School', () => {
    test('should create school as superadmin', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('token', superadminToken)
            .send({ name: 'Springfield Elementary', address: '123 Main St', email: 'spring@school.com', phone: '5551234567' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.school.name).toBe('Springfield Elementary');
        expect(res.body.data.school.email).toBe('spring@school.com');
        schoolId = res.body.data.school._id;
    });

    test('should not create school with duplicate name', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('token', superadminToken)
            .send({ name: 'Springfield Elementary', address: '456 Other St', email: 'other@school.com' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should not create school with missing required fields', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('token', superadminToken)
            .send({ name: 'Incomplete School' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should not create school as school_admin', async () => {
        // Create school admin first
        await request(app)
            .post('/api/user/createSchoolAdmin')
            .set('token', superadminToken)
            .send({ username: 'schooladmin', email: 'admin@spring.com', password: 'password123', schoolId });

        const loginRes = await request(app)
            .post('/api/user/login')
            .send({ email: 'admin@spring.com', password: 'password123' });
        schoolAdminToken = loginRes.body.data.shortToken;

        const res = await request(app)
            .post('/api/school/createSchool')
            .set('token', schoolAdminToken)
            .send({ name: 'Unauthorized School', address: '789 Blocked Ave', email: 'blocked@school.com' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Only superadmins can create schools');
    });
});

describe('Get School', () => {
    test('should get school by id as superadmin', async () => {
        const res = await request(app)
            .get('/api/school/getSchool')
            .set('token', superadminToken)
            .query({ schoolId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.school.name).toBe('Springfield Elementary');
    });

    test('should get own school as school_admin', async () => {
        const res = await request(app)
            .get('/api/school/getSchool')
            .set('token', schoolAdminToken)
            .query({ schoolId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('should not get different school as school_admin', async () => {
        const schoolRes = await request(app)
            .post('/api/school/createSchool')
            .set('token', superadminToken)
            .send({ name: 'Other School', address: '999 Other St', email: 'other2@school.com' });
        const otherSchoolId = schoolRes.body.data.school._id;

        const res = await request(app)
            .get('/api/school/getSchool')
            .set('token', schoolAdminToken)
            .query({ schoolId: otherSchoolId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Access denied to this school');
    });

    test('should return error for non-existent school', async () => {
        const res = await request(app)
            .get('/api/school/getSchool')
            .set('token', superadminToken)
            .query({ schoolId: '507f1f77bcf86cd799439011' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});

describe('Get All Schools', () => {
    test('superadmin should see all schools', async () => {
        const res = await request(app)
            .get('/api/school/getAllSchools')
            .set('token', superadminToken);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.schools.length).toBeGreaterThanOrEqual(2);
    });

    test('school_admin should see only their school', async () => {
        const res = await request(app)
            .get('/api/school/getAllSchools')
            .set('token', schoolAdminToken);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.schools.length).toBe(1);
        expect(res.body.data.schools[0]._id).toBe(schoolId);
    });
});

describe('Update School', () => {
    test('should update school as superadmin', async () => {
        const res = await request(app)
            .put('/api/school/updateSchool')
            .set('token', superadminToken)
            .send({ schoolId, address: '999 Updated Blvd' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.school.address).toBe('999 Updated Blvd');
        expect(res.body.data.school.name).toBe('Springfield Elementary');
    });

    test('should not update school as school_admin', async () => {
        const res = await request(app)
            .put('/api/school/updateSchool')
            .set('token', schoolAdminToken)
            .send({ schoolId, name: 'Hacked Name' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Only superadmins can update schools');
    });
});

describe('Delete School', () => {
    test('should not delete school as school_admin', async () => {
        const res = await request(app)
            .delete('/api/school/deleteSchool')
            .set('token', schoolAdminToken)
            .send({ schoolId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should delete empty school as superadmin', async () => {
        const newSchool = await request(app)
            .post('/api/school/createSchool')
            .set('token', superadminToken)
            .send({ name: 'To Delete School', address: '1 Delete Rd', email: 'delete@school.com' });
        const deleteId = newSchool.body.data.school._id;

        const res = await request(app)
            .delete('/api/school/deleteSchool')
            .set('token', superadminToken)
            .send({ schoolId: deleteId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        // Verify it's soft-deleted (not returned in queries)
        const getRes = await request(app)
            .get('/api/school/getSchool')
            .set('token', superadminToken)
            .query({ schoolId: deleteId });

        expect(getRes.body.ok).toBe(false);
    });
});
