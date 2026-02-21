const request = require('supertest');
const { setup, teardown, getApp, createSuperadmin } = require('./setup');

let app;

beforeAll(async () => {
    app = await setup();
});

afterAll(async () => {
    await teardown();
});

describe('User Registration', () => {
    test('should register a new user successfully', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.username).toBe('testuser');
        expect(res.body.data.user.password).toBeUndefined();
        expect(res.body.data.longToken).toBeDefined();
        expect(res.body.data.shortToken).toBeDefined();
    });

    test('should not register with missing required fields', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send({ username: 'nopass' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should not register with duplicate email', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send({ username: 'another', email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('User with this username or email already exists');
    });

    test('should not register with duplicate username', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send({ username: 'testuser', email: 'different@example.com', password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});

describe('User Login', () => {
    test('should login with valid credentials', async () => {
        const res = await request(app)
            .post('/api/user/login')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.longToken).toBeDefined();
        expect(res.body.data.shortToken).toBeDefined();
    });

    test('should not login with wrong password', async () => {
        const res = await request(app)
            .post('/api/user/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Invalid credentials');
    });

    test('should not login with non-existent email', async () => {
        const res = await request(app)
            .post('/api/user/login')
            .send({ email: 'notfound@example.com', password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should not login with missing fields', async () => {
        const res = await request(app)
            .post('/api/user/login')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});

describe('User Profile', () => {
    let shortToken;

    beforeAll(async () => {
        const loginRes = await request(app)
            .post('/api/user/login')
            .send({ email: 'test@example.com', password: 'password123' });
        shortToken = loginRes.body.data.shortToken;
    });

    test('should get profile with valid token', async () => {
        const res = await request(app)
            .get('/api/user/getProfile')
            .set('token', shortToken);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.username).toBe('testuser');
        expect(res.body.data.user.password).toBeUndefined();
    });

    test('should not get profile without token', async () => {
        const res = await request(app)
            .get('/api/user/getProfile');

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    test('should not get profile with invalid token', async () => {
        const res = await request(app)
            .get('/api/user/getProfile')
            .set('token', 'invalid-token');

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });
});

describe('Create School Admin', () => {
    let superadminToken;
    let schoolId;

    beforeAll(async () => {
        const regRes = await request(app)
            .post('/api/user/register')
            .send({ username: 'superadmin', email: 'super@admin.com', password: 'password123', role: 'superadmin' });
        superadminToken = regRes.body.data.shortToken;

        const schoolRes = await request(app)
            .post('/api/school/createSchool')
            .set('token', superadminToken)
            .send({ name: 'Admin Test School', address: '456 School Ave', email: 'adminschool@test.com' });
        schoolId = schoolRes.body.data.school._id;
    });

    test('should create school admin as superadmin', async () => {
        const res = await request(app)
            .post('/api/user/createSchoolAdmin')
            .set('token', superadminToken)
            .send({ username: 'newadmin', email: 'newadmin@school.com', password: 'password123', schoolId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.user.role).toBe('school_admin');
        expect(res.body.data.user.schoolId).toBe(schoolId);
    });

    test('should not create school admin without schoolId', async () => {
        const res = await request(app)
            .post('/api/user/createSchoolAdmin')
            .set('token', superadminToken)
            .send({ username: 'noid', email: 'noid@school.com', password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    test('should not create school admin as school_admin role', async () => {
        const loginRes = await request(app)
            .post('/api/user/login')
            .send({ email: 'newadmin@school.com', password: 'password123' });
        const adminToken = loginRes.body.data.shortToken;

        const res = await request(app)
            .post('/api/user/createSchoolAdmin')
            .set('token', adminToken)
            .send({ username: 'another', email: 'another@school.com', password: 'password123', schoolId });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.errors).toContain('Only superadmins can create school administrators');
    });
});
