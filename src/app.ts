import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import { setupDatabase } from './db/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve your webpages from src/client
app.use(express.static(path.join(__dirname, 'client')));

app.use('/api/v1/auth', authRoutes);

// Moved to /api/health so it doesn't block index.html
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

async function startServer() {
    await setupDatabase();

    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

startServer();