module.exports = class User { 

    constructor({utils, cache, config, cortex, managers, validators, mongomodels }={}){
        this.config              = config;
        this.cortex              = cortex;
        this.validators          = validators; 
        this.mongomodels         = mongomodels;
        this.tokenManager        = managers.token;
        this.usersCollection     = "users";
        this.httpExposed         = [
            'post=register',
            'post=login',
            'get=getProfile',
            'post=createSchoolAdmin'
        ];
    }

    async register({ username, email, password, role }) {
        const data = { username, email, password };

        let result = await this.validators.user.createUser(data);
        if (result) return { errors: result };

        const existingUser = await this.mongomodels.user.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return { errors: 'User with this username or email already exists' };
        }

        if (role && role !== 'superadmin' && role !== 'school_admin') {
            return { errors: 'Invalid role. Must be superadmin or school_admin' };
        }

        const user = new this.mongomodels.user({
            username,
            email,
            password,
            role: role || 'school_admin'
        });

        await user.save();

        const longToken = this.tokenManager.genLongToken({
            userId: user._id.toString(),
            userKey: user.username
        });

        return {
            user: user.toSafeObject(),
            longToken
        };
    }

    async login({ email, password }) {
        if (!email || !password) {
            return { errors: 'Email and password are required' };
        }

        const user = await this.mongomodels.user.findOne({ email });

        if (!user) {
            return { errors: 'Invalid credentials' };
        }

        if (!user.isActive) {
            return { errors: 'Account is deactivated' };
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return { errors: 'Invalid credentials' };
        }

        const longToken = this.tokenManager.genLongToken({
            userId: user._id.toString(),
            userKey: user.username
        });

        const shortToken = this.tokenManager.genShortToken({
            userId: user._id.toString(),
            userKey: user.username,
            role: user.role,
            schoolId: user.schoolId ? user.schoolId.toString() : null,
            sessionId: require('nanoid').nanoid(),
            deviceId: 'web'
        });

        return {
            user: user.toSafeObject(),
            longToken,
            shortToken
        };
    }

    async getProfile({ __token }) {
        const { userId } = __token;

        const user = await this.mongomodels.user.findById(userId)
            .populate('schoolId', 'name');

        if (!user) {
            return { errors: 'User not found' };
        }

        return { user: user.toSafeObject() };
    }

    async createSchoolAdmin({ __token, username, email, password, schoolId }) {
        const { role } = __token;

        if (role !== 'superadmin') {
            return { errors: 'Only superadmins can create school administrators' };
        }

        const data = { username, email, password };
        let result = await this.validators.user.createUser(data);
        if (result) return { errors: result };

        if (!schoolId) {
            return { errors: 'School ID is required for school admin' };
        }

        const school = await this.mongomodels.school.findById(schoolId);
        if (!school) {
            return { errors: 'School not found' };
        }

        const existingUser = await this.mongomodels.user.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return { errors: 'User with this username or email already exists' };
        }

        const user = new this.mongomodels.user({
            username,
            email,
            password,
            role: 'school_admin',
            schoolId
        });

        await user.save();

        return {
            user: user.toSafeObject(),
            message: 'School admin created successfully'
        };
    }

}
