const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallbackkeyforhackathon123!';

router.post('/google', async (req, res) => {
    try {
        const { token, profile } = req.body;
        if (!token && !profile) return res.status(400).json({ error: 'Token or profile is required' });

        let payload;

        try {
            if (profile && profile.email) {
                // useGoogleLogin flow: profile already fetched from Google userinfo API
                payload = {
                    sub: profile.sub,
                    email: profile.email,
                    name: profile.name,
                    picture: profile.picture
                };
            } else if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'MOCK_CLIENT_ID') {
                const decoded = jwt.decode(token);
                if (!decoded || !decoded.email) throw new Error('Invalid mock token');
                payload = decoded;
            } else {
                const ticket = await client.verifyIdToken({
                    idToken: token,
                    audience: process.env.GOOGLE_CLIENT_ID,
                });
                payload = ticket.getPayload();
            }
        } catch (verifyError) {
            console.error('Token verification failed:', verifyError.message);
            return res.status(401).json({ error: 'Invalid Google token' });
        }

        const { sub: googleId, email, name, picture: avatar } = payload;

        // Find or create user
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ googleId, email, name, avatar });
        } else if (!user.googleId) {
            // Update legacy user with googleId just in case
            user.googleId = googleId;
            await user.save();
        }

        // Generate JWT for our backend
        const authToken = jwt.sign(
            { userId: user._id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token: authToken,
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ error: 'Server error during authentication' });
    }
});

module.exports = router;
