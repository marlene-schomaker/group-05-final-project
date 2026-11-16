import { Router } from 'express';
import { HomeController } from './home.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', HomeController.getDashboard);

export default router;
