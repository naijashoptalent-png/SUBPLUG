import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as supportService from '../services/supportService';

function customer(req: Request) {
  return { id: req.user!.id, name: req.user!.name, role: req.user!.role as 'CUSTOMER' | 'SUPPORT' | 'ADMIN' };
}

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await supportService.createTicket(customer(req), req.body);
  res.status(201).json({ data: ticket });
});

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const result = await supportService.listMyTickets(req.user!.id, Number(req.query.page ?? 1), Number(req.query.limit ?? 20));
  res.json({ data: result });
});

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await supportService.getTicket({ id: req.user!.id, role: req.user!.role }, req.params.id);
  res.json({ data: ticket });
});

export const addMessage = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await supportService.addCustomerMessage(customer(req), req.params.id, req.body.body);
  res.json({ data: ticket });
});
