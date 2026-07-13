import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { sendMessage, getMessages } from '../controllers/messageController';
import upload from '../middlewares/upload';

const router = Router();

// Protect all message routes
router.use(authenticateToken);

router.post('/', upload.single('file'), sendMessage);
router.get('/:roomId', getMessages);

export default router;
