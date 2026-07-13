import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { isAdmin, getReports, toggleSuspendUser, getStats } from '../controllers/adminController';

const router = Router();

// All endpoints in this router require JWT and Admin role verification
router.use(authenticateToken);
router.use(isAdmin);

router.get('/reports', getReports);
router.put('/users/:userId/suspend', toggleSuspendUser);
router.get('/stats', getStats);

export default router;
