module.exports = {
    createSchool: [
        {
            model: 'name',
            required: true,
        },
        {
            model: 'address',
            required: true,
        },
        {
            model: 'phone',
            required: false,
        },
        {
            model: 'email',
            required: true,
        },
    ],
    updateSchool: [
        {
            model: 'name',
            required: false,
        },
        {
            model: 'address',
            required: false,
        },
        {
            model: 'phone',
            required: false,
        },
        {
            model: 'email',
            required: false,
        },
    ],
};
