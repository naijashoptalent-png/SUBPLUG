import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as adminService from '../services/adminService';
import * as purchaseService from '../services/purchaseService';
import * as catalogueService from '../services/catalogueService';
import * as supportService from '../services/supportService';
import { reconcileWallets } from '../services/walletService';
import { AppError } from '../utils/AppError';
import { writeAudit } from '../services/auditService';

function actor(req: Request) {
  return { userId: req.user!.id, role: req.user!.role, req };
}

export const overview = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await adminService.getOverview(Number(req.query.days ?? 30)) });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.listUsers({
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    search: req.query.search as string | undefined,
    status: req.query.status as string | undefined,
    role: req.query.role as string | undefined,
  });
  res.json({ data });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: await adminService.getUserDetail(req.params.id) });
});

export const setUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.setUserStatus(
    req.user!.id,
    req.user!.role,
    req.user!.name,
    req.params.id,
    req.body.status,
    req.body.reason,
    req
  );
  res.json({ data });
});

export const adjustWallet = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.adjustWallet(
    { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    req.body,
    req
  );
  res.json({ data });
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const data = await purchaseService.listTransactions(
    { userId: req.user!.id, role: 'ADMIN', req },
    {
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
      search: req.query.search as string | undefined,
      service: req.query.service as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      userId: req.query.userId as string | undefined,
      provider: req.query.provider as string | undefined,
    }
  );
  res.json({ data });
});

export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  const data = await purchaseService.getTransaction(
    { userId: req.user!.id, role: 'ADMIN', req },
    req.params.reference
  );
  res.json({ data });
});

export const approveReview = asyncHandler(async (req: Request, res: Response) => {
  const data = await purchaseService.approveHeldTransaction(
    { userId: req.user!.id, role: req.user!.role, req },
    req.params.reference
  );
  res.json({ data });
});

export const rejectReview = asyncHandler(async (req: Request, res: Response) => {
  const data = await purchaseService.rejectHeldTransaction(
    { userId: req.user!.id, role: req.user!.role, req },
    req.params.reference,
    req.body.reason
  );
  res.json({ data });
});

export const checkTransactionStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await purchaseService.checkProviderStatus(
    { userId: req.user!.id, role: req.user!.role, req },
    req.params.reference
  );
  res.json({ data });
});

export const syncCatalogue = asyncHandler(async (req: Request, res: Response) => {
  const data = await catalogueService.syncCatalogue(req.user!.id);
  await writeAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CATALOGUE_SYNCED',
    entityType: 'ServicePlan',
    metadata: data.counts,
    req,
  });
  res.json({ data });
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await catalogueService.updatePlan(req.params.id, req.body);
  await writeAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'PLAN_UPDATED',
    entityType: 'ServicePlan',
    entityId: req.params.id,
    metadata: req.body,
    req,
  });
  res.json({ data });
});

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getAdminPlans({
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    service: req.query.service as string | undefined,
    network: req.query.network as string | undefined,
    search: req.query.search as string | undefined,
  });
  res.json({ data });
});

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await adminService.getSettings() });
});

export const saveSetting = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.key === 'maintenance' && req.body.value?.enabled === true && req.body.confirm !== 'ENABLE MAINTENANCE') {
    throw AppError.badRequest(
      'Confirm maintenance mode by providing confirm: "ENABLE MAINTENANCE"',
      'CONFIRMATION_REQUIRED'
    );
  }
  const data = await adminService.saveSetting(
    { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    req.body.key,
    req.body.value,
    req
  );
  res.json({ data });
});

export const listProviders = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: await adminService.listProviders() });
});

export const switchProviderRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.switchProviderRoute(
    { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    req.body.service,
    req.body.provider,
    req
  );
  res.json({ data });
});

export const checkProviders = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.checkProviders(req.user!.id, req.user!.role, req.user!.name, req);
  res.json({ data });
});

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.listAuditLogs({
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    action: req.query.action as string | undefined,
    actorId: req.query.actorId as string | undefined,
    entityType: req.query.entityType as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  res.json({ data });
});

export const listFundings = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.listFundingsAdmin({
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    userId: req.query.userId as string | undefined,
  });
  res.json({ data });
});

export const recheckFunding = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.recheckFunding(
    { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    req.params.reference,
    req
  );
  res.json({ data });
});

export const listSupportTickets = asyncHandler(async (req: Request, res: Response) => {
  const data = await supportService.listAllTickets({
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
  });
  res.json({ data });
});

export const getSupportTicket = asyncHandler(async (req: Request, res: Response) => {
  const data = await supportService.getTicket({ id: req.user!.id, role: 'ADMIN' }, req.params.id);
  res.json({ data });
});

export const replySupportTicket = asyncHandler(async (req: Request, res: Response) => {
  const data = await supportService.replyAsStaff(
    { id: req.user!.id, name: req.user!.name, role: req.user!.role as 'SUPPORT' | 'ADMIN' },
    req.params.id,
    req.body.body,
    req.body.status,
    req
  );
  res.json({ data });
});

export const reconciliation = asyncHandler(async (req: Request, res: Response) => {
  const result = await reconcileWallets(200);
  const snapshot = await adminService.getReconciliationSnapshot();
  await writeAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'WALLET_RECONCILIATION_RUN',
    entityType: 'Wallet',
    metadata: { checked: result.checked, discrepancies: result.discrepancies.length },
    req,
  });
  res.json({ data: { ...result, snapshot } });
});
