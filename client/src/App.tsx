import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/layout/ProtectedRoute';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useTheme } from '@/hooks/useTheme';

const HomePage = lazy(() => import('@/pages/public/HomePage').then((m) => ({ default: m.HomePage })));
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const HowItWorksPage = lazy(() => import('@/pages/public/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })));
const AboutPage = lazy(() => import('@/pages/public/AboutPage').then((m) => ({ default: m.AboutPage })));
const FaqPage = lazy(() => import('@/pages/public/FaqPage').then((m) => ({ default: m.FaqPage })));
const ContactPage = lazy(() => import('@/pages/public/ContactPage').then((m) => ({ default: m.ContactPage })));
const TermsPage = lazy(() => import('@/pages/public/TermsPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const TwoFactorPage = lazy(() => import('@/pages/auth/TwoFactorPage').then((m) => ({ default: m.TwoFactorPage })));

const MockPaymentPage = lazy(() => import('@/pages/funding/MockPaymentPage').then((m) => ({ default: m.MockPaymentPage })));
const FundingCallbackPage = lazy(() => import('@/pages/funding/FundingCallbackPage').then((m) => ({ default: m.FundingCallbackPage })));

const OverviewPage = lazy(() => import('@/pages/dashboard/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const WalletPage = lazy(() => import('@/pages/dashboard/WalletPage').then((m) => ({ default: m.WalletPage })));
const BuyAirtimePage = lazy(() => import('@/pages/dashboard/BuyAirtimePage').then((m) => ({ default: m.BuyAirtimePage })));
const BuyDataPage = lazy(() => import('@/pages/dashboard/BuyDataPage').then((m) => ({ default: m.BuyDataPage })));
const PayElectricityPage = lazy(() => import('@/pages/dashboard/PayElectricityPage').then((m) => ({ default: m.PayElectricityPage })));
const PayCablePage = lazy(() => import('@/pages/dashboard/PayCablePage').then((m) => ({ default: m.PayCablePage })));
const TransactionsPage = lazy(() => import('@/pages/dashboard/TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
const TransactionDetailPage = lazy(() => import('@/pages/dashboard/TransactionDetailPage').then((m) => ({ default: m.TransactionDetailPage })));
const ReferralsPage = lazy(() => import('@/pages/dashboard/ReferralsPage').then((m) => ({ default: m.ReferralsPage })));
const SupportPage = lazy(() => import('@/pages/dashboard/SupportPage').then((m) => ({ default: m.SupportPage })));
const SupportTicketPage = lazy(() => import('@/pages/dashboard/SupportTicketPage').then((m) => ({ default: m.SupportTicketPage })));
const NotificationsPage = lazy(() => import('@/pages/dashboard/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminUserDetailPage = lazy(() => import('@/pages/admin/AdminUserDetailPage').then((m) => ({ default: m.AdminUserDetailPage })));
const AdminTransactionsPage = lazy(() => import('@/pages/admin/AdminTransactionsPage').then((m) => ({ default: m.AdminTransactionsPage })));
const AdminTransactionDetailPage = lazy(() => import('@/pages/admin/AdminTransactionDetailPage').then((m) => ({ default: m.AdminTransactionDetailPage })));
const AdminFundingsPage = lazy(() => import('@/pages/admin/AdminFundingsPage').then((m) => ({ default: m.AdminFundingsPage })));
const AdminPlansPage = lazy(() => import('@/pages/admin/AdminPlansPage').then((m) => ({ default: m.AdminPlansPage })));
const AdminProvidersPage = lazy(() => import('@/pages/admin/AdminProvidersPage').then((m) => ({ default: m.AdminProvidersPage })));
const AdminReconciliationPage = lazy(() => import('@/pages/admin/AdminReconciliationPage').then((m) => ({ default: m.AdminReconciliationPage })));
const AdminSupportPage = lazy(() => import('@/pages/admin/AdminSupportPage').then((m) => ({ default: m.AdminSupportPage })));
const AdminSupportTicketPage = lazy(() => import('@/pages/admin/AdminSupportTicketPage').then((m) => ({ default: m.AdminSupportTicketPage })));
const AdminAuditPage = lazy(() => import('@/pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));

function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={resolved}
      richColors
      closeButton
      toastOptions={{ duration: 4500 }}
      className="font-sans"
    />
  );
}

export default function App() {
  return (
    <>
      <AppToaster />
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Route>

        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/two-factor" element={<TwoFactorPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/wallet/funding/callback" element={<FundingCallbackPage />} />
          <Route path="/mock-payment" element={<MockPaymentPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<OverviewPage />} />
            <Route path="/dashboard/wallet" element={<WalletPage />} />
            <Route path="/dashboard/airtime" element={<BuyAirtimePage />} />
            <Route path="/dashboard/data" element={<BuyDataPage />} />
            <Route path="/dashboard/electricity" element={<PayElectricityPage />} />
            <Route path="/dashboard/cable" element={<PayCablePage />} />
            <Route path="/dashboard/transactions" element={<TransactionsPage />} />
            <Route path="/dashboard/transactions/:reference" element={<TransactionDetailPage />} />
            <Route path="/dashboard/referrals" element={<ReferralsPage />} />
            <Route path="/dashboard/support" element={<SupportPage />} />
            <Route path="/dashboard/support/:id" element={<SupportTicketPage />} />
            <Route path="/dashboard/notifications" element={<NotificationsPage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['SUPPORT', 'ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminOverviewPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
            <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
            <Route path="/admin/transactions/:reference" element={<AdminTransactionDetailPage />} />
            <Route path="/admin/fundings" element={<AdminFundingsPage />} />
            <Route path="/admin/plans" element={<AdminPlansPage />} />
            <Route path="/admin/providers" element={<AdminProvidersPage />} />
            <Route path="/admin/reconciliation" element={<AdminReconciliationPage />} />
            <Route path="/admin/support" element={<AdminSupportPage />} />
            <Route path="/admin/support/:id" element={<AdminSupportTicketPage />} />
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/admin/audit" element={<AdminAuditPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        </Routes>
      </Suspense>
    </>
  );
}
