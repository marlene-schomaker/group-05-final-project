import {Router} from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if(!email || !password) {
            return res.status(400).json({error: "Email and password are required"});
        }

        const existingUser = await db
            .selectFrom('users')
            .selectAll()
            .where('email', '=', email)
            .executeTakeFirst();

        if (existingUser) {
            return res.status(409).json({ error: 'Email already in use'});
        }

        const password_hash = await bcrypt.hash(password, 10);

        const newUser = await db   
            .insertInto('users')
            .values({email, password_hash})
            .returning(['id', 'email', 'created_at'])
            .executeTakeFirstOrThrow();
        
        const token = jwt.sign({user_id: newUser.id, email: newUser.email}, JWT_SECRET, {
            expiresIn: '1h',
        });

        return res.status(201).json({token, user: newUser });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error '});
    }
});

router.post('/login', async (req, res) => {
    try {
        const {email, password}  = req.body;

        const user = await db
            .selectFrom('users')
            .selectAll()
            .where('email', '=', email)
            .executeTakeFirst();
        if(!user){
            return res.status(401).json({ error: 'Invalid credentials'});
        }
        
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials'});
        }

        const token = jwt.sign({user_id: user.id, email: user.email}, JWT_SECRET, {
            expiresIn: '1h',
        });
        return res.json({token});

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error'});
    }
});

export default router;