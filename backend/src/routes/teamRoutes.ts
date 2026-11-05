import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { createRateLimit } from '../middleware/security';
import { validate } from '../middleware/validate';
import { acceptInvite, getMembership, getTeam, inviteMember, removeMember } from '../controllers/teamController';

const router = Router();

// The team belongs to the signed-in company owner: these never act as a company a person is a member of.
router.use(authMiddleware, roleMiddleware(['EMPLOYER']));

const inviteLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: 'team-invite' });

router.get('/', getTeam);
router.get('/membership', getMembership);
router.post('/invite', inviteLimit, validate(z.object({ body: z.object({ email: z.string().trim().toLowerCase().email().max(160) }).strict() })), inviteMember);
router.post('/accept', validate(z.object({ body: z.object({ token: z.string().min(20).max(200) }).strict() })), acceptInvite);
router.delete('/:id', validate(z.object({ params: z.object({ id: z.string().min(1).max(80) }) })), removeMember);

export default router;
