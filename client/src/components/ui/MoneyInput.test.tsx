import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MoneyInput } from './MoneyInput';

function Harness({ error }: { error?: string }) {
  const [value, setValue] = useState('');
  return <MoneyInput label="Amount" value={value} onChange={setValue} error={error} />;
}

describe('MoneyInput', () => {
  it('keeps a sanitized Naira string and displays the exact kobo amount', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText('Amount');
    await user.type(input, '1,234.567');

    expect(input).toHaveValue('1234.56');
    expect(screen.getByText(/1,234\.56/)).toBeInTheDocument();
    expect(screen.getByText('Charged exactly, in kobo')).toBeInTheDocument();
  });

  it('rejects letters and limits input to two decimal places', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText('Amount');
    await user.type(input, 'abc12x.3y45');

    expect(input).toHaveValue('12.34');
  });

  it('shows an accessible validation error instead of the hint', () => {
    render(<Harness error="Enter an amount" />);

    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount');
    expect(screen.queryByText('Enter an amount in Naira')).not.toBeInTheDocument();
  });
});
