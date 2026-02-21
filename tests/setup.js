const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

let mongoServer;
let app;
let managers;

async function setup() {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);

    const config = require('../config/index.config');

    const cortex = { sub: () => {}, publish: () => {} };
    const cache = {};

    const ManagersLoader = require('../loaders/ManagersLoader');
    const managersLoader = new ManagersLoader({ config, cache, cortex });
    managers = managersLoader.load();

    app = express();
    app.use(cors({ origin: '*' }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.all('/api/:moduleName/:fnName', managers.userApi.mw);
    app.use((err, req, res, next) => {
        res.status(500).json({ ok: false, errors: 'Internal server error' });
    });

    return app;
}

async function teardown() {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
}

function getApp() {
    return app;
}

async function createSuperadmin() {
    const request = require('supertest');
    const res = await request(app)
        .post('/api/user/register')
        .send({ username: 'superadmin', email: 'super@test.com', password: 'password123', role: 'superadmin' });
    return { user: res.body.data.user, token: res.body.data.shortToken, longToken: res.body.data.longToken };
}

async function createSchoolAndAdmin(superadminToken) {
    const request = require('supertest');

    const schoolRes = await request(app)
        .post('/api/school/createSchool')
        .set('token', superadminToken)
        .send({ name: 'Test School', address: '123 Test St', email: 'school@test.com', phone: '1234567890' });

    const school = schoolRes.body.data.school;

    const adminRes = await request(app)
        .post('/api/user/createSchoolAdmin')
        .set('token', superadminToken)
        .send({ username: 'schooladmin', email: 'admin@school.com', password: 'password123', schoolId: school._id });

    const loginRes = await request(app)
        .post('/api/user/login')
        .send({ email: 'admin@school.com', password: 'password123' });

    return {
        school,
        admin: loginRes.body.data.user,
        adminToken: loginRes.body.data.shortToken,
    };
}

module.exports = { setup, teardown, getApp, createSuperadmin, createSchoolAndAdmin };
