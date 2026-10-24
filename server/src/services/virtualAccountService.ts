import { User } from '../models';
import { env } from '../config/env';
import { FlutterwaveProvider } from '../providers/flutterwaveProvider';
import { AppError } from '../utils/AppError';

function publicVirtualAccount(account?: {
  status?: 'ACTIVE' | 'PENDING';
  accountNumber?: string;
  bankName?: string;
  reference?: string;
  orderReference?: string;
  providerReference?: string;
  createdAt?: Date;
} | null) {
  if (!account) return null;
  return {
    status: account.status,
    accountNumber: account.accountNumber,
    bankName: account.bankName,
    reference: account.reference,
    createdAt: account.createdAt,
  };
}

export async function getVirtualAccount(userId: string) {
  const user = await User.findById(userId).select('virtualAccount').lean();
  if (!user) throw AppError.notFound('User not found');
  return publicVirtualAccount(user.virtualAccount);
}

export async function createVirtualAccount(userId: string, nin: string) {
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    throw AppError.serviceUnavailable(
      'Dedicated bank-account funding is not configured yet. Please use another funding method.',
      'FLUTTERWAVE_NOT_CONFIGURED'
    );
  }

  const user = await User.findById(userId).select('fullName email phone virtualAccount');
  if (!user) throw AppError.notFound('User not found');
  if (user.virtualAccount?.status === 'ACTIVE') return publicVirtualAccount(user.virtualAccount);
  if (user.virtualAccount?.status === 'PENDING') {
    throw AppError.conflict('Your dedicated account is already being created. Please refresh shortly.', 'VIRTUAL_ACCOUNT_PENDING');
  }

  // Claim account creation first so parallel browser requests cannot issue two
  // provider calls. The NIN is passed directly to Flutterwave and is not saved.
  const claimed = await User.findOneAndUpdate(
    { _id: userId, virtualAccount: { $exists: false } },
    { $set: { virtualAccount: { status: 'PENDING' } } },
    { new: true }
  );
  if (!claimed) {
    const current = await getVirtualAccount(userId);
    if (current?.status === 'ACTIVE') return current;
    throw AppError.conflict('Your dedicated account is already being created. Please refresh shortly.', 'VIRTUAL_ACCOUNT_PENDING');
  }

  try {
    const provider = new FlutterwaveProvider();
    const account = await provider.createStaticVirtualAccount({
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      nin,
      reference: `VA_${String(user._id)}`,
    });
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          virtualAccount: {
            status: 'ACTIVE',
            accountNumber: account.accountNumber,
            bankName: account.bankName,
            // Keep our own stable transaction reference for webhook matching.
            // Flutterwave may return a separate provider reference.
            reference: `VA_${String(user._id)}`,
            orderReference: account.orderReference,
            providerReference: account.providerReference,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).select('virtualAccount');
    return publicVirtualAccount(updated?.virtualAccount);
  } catch (error) {
    await User.updateOne({ _id: userId, 'virtualAccount.status': 'PENDING' }, { $unset: { virtualAccount: 1 } });
    throw error;
  }
}
