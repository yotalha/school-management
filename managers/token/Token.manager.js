const jwt        = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const md5        = require('md5');


module.exports = class TokenManager {

    constructor({config, mongomodels}){
        this.config              = config;
        this.mongomodels         = mongomodels;
        this.longTokenExpiresIn  = '3y';
        this.shortTokenExpiresIn = '1y';

        this.httpExposed         = ['v1_createShortToken'];
    }

    /** 
     * short token are issue from long token 
     * short tokens are issued for 72 hours 
     * short tokens are connected to user-agent
     * short token are used on the soft logout 
     * short tokens are used for account switch 
     * short token represents a device. 
     * long token represents a single user. 
     *  
     * long token contains immutable data and long lived
     * master key must exists on any device to create short tokens
     */
    genLongToken({userId, userKey}){
        return jwt.sign(
            { 
                userKey, 
                userId,
            }, 
            this.config.dotEnv.LONG_TOKEN_SECRET, 
            {expiresIn: this.longTokenExpiresIn
        })
    }

    genShortToken({userId, userKey, role, schoolId, sessionId, deviceId}){
        return jwt.sign(
            { userKey, userId, role, schoolId, sessionId, deviceId}, 
            this.config.dotEnv.SHORT_TOKEN_SECRET, 
            {expiresIn: this.shortTokenExpiresIn
        })
    }

    _verifyToken({token, secret}){
        let decoded = null;
        try {
            decoded = jwt.verify(token, secret);
        } catch(err) { console.log(err); }
        return decoded;
    }

    verifyLongToken({token}){
        return this._verifyToken({token, secret: this.config.dotEnv.LONG_TOKEN_SECRET,})
    }
    verifyShortToken({token}){
        return this._verifyToken({token, secret: this.config.dotEnv.SHORT_TOKEN_SECRET,})
    }


    /** generate shortId based on a longId */
    async v1_createShortToken({__longToken, __device}){

        let decoded = __longToken;

        const user = await this.mongomodels.user.findById(decoded.userId);
        if (!user) {
            return { errors: 'User not found' };
        }

        let shortToken = this.genShortToken({
            userId: decoded.userId,
            userKey: decoded.userKey,
            role: user.role,
            schoolId: user.schoolId ? user.schoolId.toString() : null,
            sessionId: nanoid(),
            deviceId: md5(__device),
        });

        return { shortToken };
    }
}