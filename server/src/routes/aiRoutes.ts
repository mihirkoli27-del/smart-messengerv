import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { summarizeChat, translateMessage, suggestReplies, checkToxicity } from '../controllers/aiController';

const router = Router();

// Protect all AI features behind access token authentication
router.use(authenticateToken);

router.post('/summarize', summarizeChat);
router.post('/translate', translateMessage);
router.post('/suggest-replies', suggestReplies);
router.post('/check-toxicity', checkToxicity);

export default router;
