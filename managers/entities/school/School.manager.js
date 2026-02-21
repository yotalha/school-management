module.exports = class School {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.responseDispatcher = managers.responseDispatcher;
        this.httpExposed = [
            'post=createSchool',
            'get=getSchool',
            'get=getAllSchools',
            'put=updateSchool',
            'delete=deleteSchool'
        ];
    }

    async createSchool({ __token, name, address, phone, email }) {
        const { role } = __token;
        
        if (role !== 'superadmin') {
            return { errors: 'Only superadmins can create schools' };
        }

        const data = { name, address, phone, email };
        
        let result = await this.validators.school.createSchool(data);
        if (result) return { errors: result };

        const existingSchool = await this.mongomodels.school.findOne({
            $or: [{ name }, { email }],
            isActive: true
        });
        
        if (existingSchool) {
            return { errors: 'School with this name or email already exists' };
        }

        const school = new this.mongomodels.school({
            name,
            address,
            phone,
            email
        });

        await school.save();

        return {
            school
        };
    }

    async getSchool({ __token, schoolId }) {
        const { role, schoolId: userSchoolId } = __token;

        if (!schoolId) {
            return { errors: 'School ID is required' };
        }

        if (role === 'school_admin' && userSchoolId !== schoolId) {
            return { errors: 'Access denied to this school' };
        }

        const school = await this.mongomodels.school.findOne({ _id: schoolId, isActive: true });

        if (!school) {
            return { errors: 'School not found' };
        }

        return { school };
    }

    async getAllSchools({ __token }) {
        const { role, schoolId } = __token;

        let schools;

        if (role === 'superadmin') {
            schools = await this.mongomodels.school.find({ isActive: true });
        } else {
            schools = await this.mongomodels.school.find({ _id: schoolId, isActive: true });
        }

        return { schools };
    }

    async updateSchool({ __token, schoolId, name, address, phone, email }) {
        const { role } = __token;

        if (role !== 'superadmin') {
            return { errors: 'Only superadmins can update schools' };
        }

        if (!schoolId) {
            return { errors: 'School ID is required' };
        }

        const data = { name, address, phone, email };
        let result = await this.validators.school.updateSchool(data);
        if (result) return { errors: result };

        const school = await this.mongomodels.school.findOne({ _id: schoolId, isActive: true });

        if (!school) {
            return { errors: 'School not found' };
        }

        if (name !== undefined) school.name = name;
        if (address !== undefined) school.address = address;
        if (phone !== undefined) school.phone = phone;
        if (email !== undefined) school.email = email;

        await school.save();

        return { school };
    }

    async deleteSchool({ __token, schoolId }) {
        const { role } = __token;

        if (role !== 'superadmin') {
            return { errors: 'Only superadmins can delete schools' };
        }

        if (!schoolId) {
            return { errors: 'School ID is required' };
        }

        const school = await this.mongomodels.school.findOne({ _id: schoolId, isActive: true });

        if (!school) {
            return { errors: 'School not found' };
        }

        const classroomCount = await this.mongomodels.classroom.countDocuments({ schoolId, isActive: true });
        const studentCount = await this.mongomodels.student.countDocuments({ schoolId, isActive: true });

        if (classroomCount > 0 || studentCount > 0) {
            return {
                errors: 'Cannot delete school with existing classrooms or students. Remove them first.'
            };
        }

        school.isActive = false;
        await school.save();

        return { message: 'School deleted successfully' };
    }
}
