module.exports = class Student {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.responseDispatcher = managers.responseDispatcher;
        this.httpExposed = [
            'post=createStudent',
            'get=getStudent',
            'get=getStudents',
            'put=updateStudent',
            'delete=deleteStudent',
            'post=enrollStudent',
            'post=transferStudent'
        ];
    }

    async createStudent({ __token, firstName, lastName, email, dateOfBirth, schoolId, classroomId }) {
        const { role, schoolId: adminSchoolId } = __token;

        let targetSchoolId = schoolId;

        if (role === 'school_admin') {
            targetSchoolId = adminSchoolId;
        } else if (role !== 'superadmin') {
            return { errors: 'Unauthorized to create students' };
        }

        if (!targetSchoolId) {
            return { errors: 'School ID is required' };
        }

        const data = { firstName, lastName, email, dateOfBirth };
        let result = await this.validators.student.createStudent(data);
        if (result) return { errors: result };

        const school = await this.mongomodels.school.findById(targetSchoolId);
        if (!school) {
            return { errors: 'School not found' };
        }

        if (classroomId) {
            const classroom = await this.mongomodels.classroom.findById(classroomId);
            if (!classroom) {
                return { errors: 'Classroom not found' };
            }
            if (classroom.schoolId.toString() !== targetSchoolId) {
                return { errors: 'Classroom does not belong to the specified school' };
            }
            
            const enrolledCount = await this.mongomodels.student.countDocuments({ classroomId });
            if (enrolledCount >= classroom.capacity) {
                return { errors: 'Classroom is at full capacity' };
            }
        }

        const existingStudent = await this.mongomodels.student.findOne({ email });
        if (existingStudent) {
            return { errors: 'Student with this email already exists' };
        }

        const student = new this.mongomodels.student({
            firstName,
            lastName,
            email,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            schoolId: targetSchoolId,
            classroomId: classroomId || null
        });

        await student.save();

        return { student };
    }

    async getStudent({ __token, studentId }) {
        const { role, schoolId: adminSchoolId } = __token;

        if (!studentId) {
            return { errors: 'Student ID is required' };
        }

        const student = await this.mongomodels.student.findById(studentId)
            .populate('schoolId', 'name')
            .populate('classroomId', 'name');

        if (!student) {
            return { errors: 'Student not found' };
        }

        if (role === 'school_admin' && student.schoolId._id.toString() !== adminSchoolId) {
            return { errors: 'Access denied to this student' };
        }

        return { student };
    }

    async getStudents({ __token, schoolId, classroomId }) {
        const { role, schoolId: adminSchoolId } = __token;

        let query = {};

        if (role === 'superadmin') {
            if (schoolId) query.schoolId = schoolId;
            if (classroomId) query.classroomId = classroomId;
        } else {
            query.schoolId = adminSchoolId;
            if (classroomId) query.classroomId = classroomId;
        }

        const students = await this.mongomodels.student.find(query)
            .populate('schoolId', 'name')
            .populate('classroomId', 'name');

        return { students };
    }

    async updateStudent({ __token, studentId, firstName, lastName, email, dateOfBirth }) {
        const { role, schoolId: adminSchoolId } = __token;

        if (!studentId) {
            return { errors: 'Student ID is required' };
        }

        const data = { firstName, lastName, email, dateOfBirth };
        let result = await this.validators.student.updateStudent(data);
        if (result) return { errors: result };

        const student = await this.mongomodels.student.findById(studentId);

        if (!student) {
            return { errors: 'Student not found' };
        }

        if (role === 'school_admin' && student.schoolId.toString() !== adminSchoolId) {
            return { errors: 'Access denied to update this student' };
        }

        if (email && email !== student.email) {
            const existingStudent = await this.mongomodels.student.findOne({ email });
            if (existingStudent) {
                return { errors: 'Another student with this email already exists' };
            }
        }

        if (firstName) student.firstName = firstName;
        if (lastName) student.lastName = lastName;
        if (email) student.email = email;
        if (dateOfBirth) student.dateOfBirth = new Date(dateOfBirth);

        await student.save();

        return { student };
    }

    async deleteStudent({ __token, studentId }) {
        const { role, schoolId: adminSchoolId } = __token;

        if (!studentId) {
            return { errors: 'Student ID is required' };
        }

        const student = await this.mongomodels.student.findById(studentId);

        if (!student) {
            return { errors: 'Student not found' };
        }

        if (role === 'school_admin' && student.schoolId.toString() !== adminSchoolId) {
            return { errors: 'Access denied to delete this student' };
        }

        await this.mongomodels.student.findByIdAndDelete(studentId);

        return { message: 'Student deleted successfully' };
    }

    async enrollStudent({ __token, studentId, classroomId }) {
        const { role, schoolId: adminSchoolId } = __token;

        if (!studentId || !classroomId) {
            return { errors: 'Student ID and Classroom ID are required' };
        }

        const student = await this.mongomodels.student.findById(studentId);
        if (!student) {
            return { errors: 'Student not found' };
        }

        if (role === 'school_admin' && student.schoolId.toString() !== adminSchoolId) {
            return { errors: 'Access denied to enroll this student' };
        }

        const classroom = await this.mongomodels.classroom.findById(classroomId);
        if (!classroom) {
            return { errors: 'Classroom not found' };
        }

        if (classroom.schoolId.toString() !== student.schoolId.toString()) {
            return { errors: 'Classroom does not belong to the student\'s school' };
        }

        const enrolledCount = await this.mongomodels.student.countDocuments({ classroomId });
        if (enrolledCount >= classroom.capacity) {
            return { errors: 'Classroom is at full capacity' };
        }

        student.classroomId = classroomId;
        await student.save();

        const updatedStudent = await this.mongomodels.student.findById(studentId)
            .populate('schoolId', 'name')
            .populate('classroomId', 'name');

        return { 
            message: 'Student enrolled successfully',
            student: updatedStudent 
        };
    }

    async transferStudent({ __token, studentId, targetSchoolId, targetClassroomId }) {
        const { role } = __token;

        if (role !== 'superadmin') {
            return { errors: 'Only superadmins can transfer students between schools' };
        }

        if (!studentId || !targetSchoolId) {
            return { errors: 'Student ID and Target School ID are required' };
        }

        const student = await this.mongomodels.student.findById(studentId);
        if (!student) {
            return { errors: 'Student not found' };
        }

        const targetSchool = await this.mongomodels.school.findById(targetSchoolId);
        if (!targetSchool) {
            return { errors: 'Target school not found' };
        }

        if (targetClassroomId) {
            const classroom = await this.mongomodels.classroom.findById(targetClassroomId);
            if (!classroom) {
                return { errors: 'Target classroom not found' };
            }
            if (classroom.schoolId.toString() !== targetSchoolId) {
                return { errors: 'Target classroom does not belong to the target school' };
            }
            
            const enrolledCount = await this.mongomodels.student.countDocuments({ 
                classroomId: targetClassroomId 
            });
            if (enrolledCount >= classroom.capacity) {
                return { errors: 'Target classroom is at full capacity' };
            }
        }

        student.schoolId = targetSchoolId;
        student.classroomId = targetClassroomId || null;
        await student.save();

        const updatedStudent = await this.mongomodels.student.findById(studentId)
            .populate('schoolId', 'name')
            .populate('classroomId', 'name');

        return {
            message: 'Student transferred successfully',
            student: updatedStudent
        };
    }
}
