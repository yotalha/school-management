module.exports = {
    createStudent: [
        {
            model: 'firstName',
            required: true,
        },
        {
            model: 'lastName',
            required: true,
        },
        {
            model: 'email',
            required: true,
        },
        {
            model: 'dateOfBirth',
            required: false,
        },
    ],
    updateStudent: [
        {
            model: 'firstName',
            required: false,
        },
        {
            model: 'lastName',
            required: false,
        },
        {
            model: 'email',
            required: false,
        },
        {
            model: 'dateOfBirth',
            required: false,
        },
    ],
};
