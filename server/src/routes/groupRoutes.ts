import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { createGroup, inviteMember, removeMember, getMyGroups } from '../controllers/groupController';

const router = Router();

// Protect all group routes
router.use(authenticateToken);

router.post('/', createGroup);
router.post('/invite', inviteMember);
router.post('/remove', removeMember);
router.get('/', getMyGroups);

export default router;
