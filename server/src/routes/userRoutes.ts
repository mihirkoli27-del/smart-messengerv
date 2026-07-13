import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { getProfile, updateProfile, updateSettings, searchUsers, blockUser, unblockUser, reportUser } from '../controllers/userController';

const router = Router();

// Protect all user routes with JWT check
router.use(authenticateToken);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/settings', updateSettings);
router.get('/search', searchUsers);
router.post('/block', blockUser);
router.post('/unblock', unblockUser);
router.post('/report', reportUser);

export default router;
