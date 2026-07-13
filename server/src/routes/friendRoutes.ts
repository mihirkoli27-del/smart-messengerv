import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, getFriendsAndRequests } from '../controllers/friendController';

const router = Router();

// Protect all friend routes
router.use(authenticateToken);

router.post('/request', sendFriendRequest);
router.post('/accept', acceptFriendRequest);
router.post('/reject', rejectFriendRequest);
router.post('/remove', removeFriend);
router.get('/', getFriendsAndRequests);

export default router;
