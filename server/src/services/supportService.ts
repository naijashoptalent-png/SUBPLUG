import { Request } from 'express';
import { Types } from 'mongoose';
import { SupportTicket, Transaction, User } from '../models';
import { AppError } from '../utils/AppError';
import { generateTicketReference } from '../utils/reference';
import { paginationMeta } from '../utils/pagination';
import { notify } from './notificationService';
import { sendSupportReply } from './emailService';
import { writeAudit } from './auditService';

export async function createTicket(
  user: { id: string; name: string; role: 'CUSTOMER' | 'SUPPORT' | 'ADMIN' },
  input: {
    subject: string;
    category: 'TRANSACTION_DISPUTE' | 'WALLET' | 'ACCOUNT' | 'OTHER';
    message: string;
    transactionReference?: string;
  }
) {
  let transaction = null;
  if (input.transactionReference) {
    transaction = await Transaction.findOne({
      reference: input.transactionReference.toUpperCase(),
      userId: user.id,
    });
    if (!transaction) throw AppError.badRequest('Transaction reference was not found on your account', 'TRANSACTION_NOT_FOUND');
  }
  const ticket = await SupportTicket.create({
    reference: generateTicketReference(),
    userId: user.id,
    subject: input.subject,
    category: input.category,
    transactionReference: transaction?.reference ?? null,
    transactionId: transaction?._id ?? null,
    messages: [
      {
        authorId: user.id,
        authorRole: user.role,
        authorName: user.name,
        body: input.message,
        createdAt: new Date(),
      },
    ],
    lastMessageAt: new Date(),
    priority: input.category === 'TRANSACTION_DISPUTE' ? 'HIGH' : 'NORMAL',
  });
  return ticket.toObject();
}

export async function listMyTickets(userId: string, page: number, limit: number) {
  const [tickets, total] = await Promise.all([
    SupportTicket.find({ userId })
      .select('reference subject category status priority transactionReference lastMessageAt createdAt')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportTicket.countDocuments({ userId }),
  ]);
  return { tickets, pagination: paginationMeta(total, page, limit) };
}

export async function getTicket(user: { id: string; role: string }, ticketId: string) {
  if (!Types.ObjectId.isValid(ticketId)) throw AppError.badRequest('Invalid ticket id');
  const filter: Record<string, unknown> = { _id: ticketId };
  if (user.role === 'CUSTOMER' || user.role === 'SUPPORT') filter.userId = user.id;
  const ticket = await SupportTicket.findOne(filter).lean();
  if (!ticket) throw AppError.notFound('Ticket not found');
  return ticket;
}

export async function addCustomerMessage(
  user: { id: string; name: string; role: 'CUSTOMER' | 'SUPPORT' | 'ADMIN' },
  ticketId: string,
  body: string
) {
  const ticket = await SupportTicket.findOne({ _id: ticketId, userId: user.id });
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (ticket.status === 'CLOSED') throw AppError.conflict('This ticket is closed. Open a new ticket for further help.', 'TICKET_CLOSED');
  if (ticket.status === 'RESOLVED') ticket.status = 'OPEN';
  ticket.messages.push({
    authorId: user.id as unknown as Types.ObjectId,
    authorRole: user.role,
    authorName: user.name,
    body,
    createdAt: new Date(),
  });
  ticket.lastMessageAt = new Date();
  await ticket.save();
  return ticket.toObject();
}

export async function listAllTickets(options: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;
  if (options.search) {
    const safe = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { reference: { $regex: safe, $options: 'i' } },
      { subject: { $regex: safe, $options: 'i' } },
      { transactionReference: { $regex: safe, $options: 'i' } },
    ];
  }
  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate('userId', 'fullName email')
      .sort({ lastMessageAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  return { tickets, pagination: paginationMeta(total, options.page, options.limit) };
}

export async function replyAsStaff(
  actor: { id: string; name: string; role: 'SUPPORT' | 'ADMIN' },
  ticketId: string,
  body: string,
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
  req?: Request
) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw AppError.notFound('Ticket not found');
  ticket.messages.push({
    authorId: actor.id as unknown as Types.ObjectId,
    authorRole: actor.role,
    authorName: actor.name,
    body,
    createdAt: new Date(),
  });
  ticket.lastMessageAt = new Date();
  if (status) {
    ticket.status = status;
    if (status === 'CLOSED') ticket.closedAt = new Date();
  } else if (ticket.status === 'OPEN') {
    ticket.status = 'IN_PROGRESS';
  }
  await ticket.save();

  await notify({
    userId: String(ticket.userId),
    type: 'SUPPORT',
    title: `Support replied to ${ticket.reference}`,
    body: body.slice(0, 300),
    link: '/dashboard/support',
  });
  const user = await User.findById(ticket.userId).lean();
  if (user) await sendSupportReply(user.email, ticket.reference, body);
  await writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'SUPPORT_TICKET_REPLIED',
    entityType: 'SupportTicket',
    entityId: String(ticket._id),
    metadata: { reference: ticket.reference, status: ticket.status },
    req,
  });
  return ticket.toObject();
}
