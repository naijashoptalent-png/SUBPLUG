import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { FormError } from './FormError';
import { StatCard } from './StatCard';
import { StatusBadge } from './Badge';

describe('FormError', () => {
  it('renders an alert with its message', () => {
    render(<FormError>Something went wrong</FormError>);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders nothing without children', () => {
    const { container } = render(<FormError>{null}</FormError>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StatCard', () => {
  it('renders a label, value, hint, and trend', () => {
    render(
      <StatCard
        label="Wallet balance"
        value="₦1,250"
        icon={Wallet}
        hint="Available now"
        trend={{ value: '+12.5%', positive: true }}
      />
    );

    expect(screen.getByText('Wallet balance')).toBeInTheDocument();
    expect(screen.getByText('₦1,250')).toBeInTheDocument();
    expect(screen.getByText('Available now')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toHaveClass('text-success');
  });

  it('shows a skeleton while loading instead of the value', () => {
    render(<StatCard label="Volume" value="₦99,999" icon={Wallet} loading />);

    expect(screen.queryByText('₦99,999')).not.toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('maps known statuses to human labels', () => {
    render(<StatusBadge status="SUCCESSFUL" />);
    expect(screen.getByText('Successful')).toBeInTheDocument();
  });

  it('uses the canonical review label and falls back for unknown statuses', () => {
    const { rerender } = render(<StatusBadge status="REQUIRES_REVIEW" />);
    expect(screen.getByText('In review')).toBeInTheDocument();

    rerender(<StatusBadge status="AWAITING_PROVIDER" />);
    expect(screen.getByText('Awaiting Provider')).toBeInTheDocument();
  });
});
