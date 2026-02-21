module.exports = class Classroom {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.responseDispatcher = managers.responseDispatcher;
        this.httpExposed = [
            'post=createClassroom',
            'get=getClassroom',
            'get=getClassrooms',
            'put=updateClassroom',
            'delete=deleteClassroom'
        ];
    }

    async createClassroom({ __token, name, capacity, resources, schoolId }) {
        const { role, schoolId: adminSchoolId } = __token;

        let targetSchoolId = schoolId;

        if (role === 'school_admin') {
            targetSchoolId = adminSchoolId;
        } else if (role !== 'superadmin') {
            return { errors: 'Unauthorized to create classrooms' };
        }

        if (!targetSchoolId) {
            return { errors: 'School ID is required' };
        }

        const data = { name, capacity, resources };
        let result = await this.validators.classroom.createClassroom(data);
        if (result) return { errors: result };

        const school = await this.mongomodels.school.findOne({ _id: targetSchoolId, isActive: true });
        if (!school) {
            return { errors: 'School not found' };
        }

        const existingClassroom = await this.mongomodels.classroom.findOne({
            name,
            schoolId: targetSchoolId,
            isActive: true
        });

        if (existingClassroom) {
            return { errors: 'Classroom with this name already exists in this school' };
        }

        const classroom = new this.mongomodels.classroom({
            name,
            capacity: capacity || 30,
            resources: resources || [],
            schoolId: targetSchoolId
        });

        await classroom.save();

        return { classroom };
    }

    async getClassroom({ __token, classroomId }) {
        const { role, schoolId: adminSchoolId } = __token;

        if (!classroomId) {
            return { errors: 'Classroom ID is required' };
        }

        const classroom = await this.mongomodels.classroom.findOne({ _id: classroomId, isActive: true })
            .populate('schoolId', 'name');

        if (!classroom) {
            return { errors: 'Classroom not found' };
        }

        if (role === 'school_admin' && classroom.schoolId._id.toString() !== adminSchoolId) {
            return { errors: 'Access denied to this classroom' };
        }

        return { classroom };
    }

    async getClassrooms({ __token, schoolId }) {
        const { role, schoolId: adminSchoolId } = __token;

        let query = { isActive: true };

        if (role === 'superadmin') {
            if (schoolId) {
                query.schoolId = schoolId;
            }
        } else {
            query.schoolId = adminSchoolId;
        }

        const classrooms = await this.mongomodels.classroom.find(query)
            .populate('schoolId', 'name');

        return { classrooms };
    }

    async updateClassroom({ __token, classroomId, name, capacity, resources }) {
        const { role, schoolId: adminSchoolId } = __token;

        if (!classroomId) {
            return { errors: 'Classroom ID is required' };
        }

        const data = { name, capacity, resources };
        let result = await this.validators.classroom.updateClassroom(data);
        if (result) return { errors: result };

        const classroom = await this.mongomodels.classroom.findOne({ _id: classroomId, isActive: true });

        if (!classroom) {
            return { errors: 'Classroom not found' };
        }

        if (role === 'school_admin' && classroom.schoolId.toString() !== adminSchoolId) {
            return { errors: 'Access denied to update this classroom' };
        }

        if (name !== undefined) classroom.name = name;
        if (capacity !== undefined) classroom.capacity = capacity;
        if (resources !== undefined) classroom.resources = resources;

        await classroom.save();

        return { classroom };
    }

    async deleteClassroom({ __token, classroomId }) {
        const { role, schoolId: adminSchoolId } = __token;

        if (!classroomId) {
            return { errors: 'Classroom ID is required' };
        }

        const classroom = await this.mongomodels.classroom.findOne({ _id: classroomId, isActive: true });

        if (!classroom) {
            return { errors: 'Classroom not found' };
        }

        if (role === 'school_admin' && classroom.schoolId.toString() !== adminSchoolId) {
            return { errors: 'Access denied to delete this classroom' };
        }

        const studentCount = await this.mongomodels.student.countDocuments({ classroomId, isActive: true });

        if (studentCount > 0) {
            return { errors: 'Cannot delete classroom with enrolled students. Transfer them first.' };
        }

        classroom.isActive = false;
        await classroom.save();

        return { message: 'Classroom deleted successfully' };
    }
}
