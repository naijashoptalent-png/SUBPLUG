import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  paginationQuerySchema,
  supportTicketSchema,
  ticketMessageSchema,
  ticketParamSchema,
} from '../validators/schemas';
import * as controller from '../controllers/supportController';

const router = Router();
router.use(authenticate);

router.post('/tickets', validate({ body: supportTicketSchema }), controller.createTicket);
router.get('/tickets', validate({ query: paginationQuerySchema }), controller.listTickets);
router.get('/tickets/:id', validate({ params: ticketParamSchema }), controller.getTicket);
router.post(
  '/tickets/:id/messages',
  validate({ params: ticketParamSchema, body: ticketMessageSchema }),
  controller.addMessage
);

export default router;
