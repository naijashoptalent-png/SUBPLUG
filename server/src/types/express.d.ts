import { Role } from '../config/constants';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      name: string;
      email: string;
      role: Role;
      emailVerifiedAt: Date | null;
      status: string;
    }
    interface Request {
      user?: AuthUser;
      rawBody?: Buffer;
      requestId?: string;
    }
  }
}

export {};
