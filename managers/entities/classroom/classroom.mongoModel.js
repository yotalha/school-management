const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        index: true
    },
    capacity: {
        type: Number,
        default: 30,
        min: 1,
        max: 500
    },
    resources: [{
        type: String,
        trim: true
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

classroomSchema.index({ name: 1, schoolId: 1 }, { unique: true });

module.exports = mongoose.model('Classroom', classroomSchema);
