const rateLimitStore = new Map();

module.exports = ({ meta, config, managers }) => {
    const windowMs = 60 * 1000;
    const maxRequests = 100;

    return ({ req, res, next }) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const key = `ratelimit:${ip}`;
        const now = Date.now();

        let record = rateLimitStore.get(key);

        if (!record || (now - record.windowStart) > windowMs) {
            record = {
                count: 1,
                windowStart: now
            };
            rateLimitStore.set(key, record);
        } else {
            record.count++;
        }

        if (record.count > maxRequests) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 429,
                errors: 'Too many requests. Please try again later.'
            });
        }

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil((record.windowStart + windowMs) / 1000));

        next({});
    };
};
