import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCoffeeById } from '../lib/catalog';
import { RateForm } from './RateForm';
import { StarRating } from './StarRating';

afterEach(cleanup);

const coffee = getCoffeeById('eth-yirg-001')!;

describe('RateForm', () => {
  it('keeps invalid brew details visible and round-trips the 0°C boundary', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => true);
    render(
      <RateForm
        coffee={coffee}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    const brewToggle = screen.getByRole('button', { name: /Brew details/i });
    await user.click(brewToggle);
    const dose = screen.getByRole('spinbutton', { name: 'Coffee dose' });
    await user.type(dose, '0');
    await user.click(brewToggle);

    expect(brewToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/positive numbers/);

    await user.clear(dose);
    await user.type(screen.getByRole('spinbutton', { name: 'Temperature' }), '0');
    await user.click(screen.getByRole('radio', { name: '4 out of 5 stars' }));
    await user.click(screen.getByRole('button', { name: 'Save to journal' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        coffeeId: coffee.id,
        stars: 4,
        brew: { temperatureCelsius: 0 },
      }),
    );
  });

  it('keeps a failed save dirty so cancelling still requires confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onCancel = vi.fn();
    render(
      <RateForm
        coffee={coffee}
        onSave={() => false}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('radio', { name: '5 out of 5 stars' }));
    await user.click(screen.getByRole('button', { name: 'Save to journal' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(confirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('StarRating keyboard controls', () => {
  it('supports arrows, Home, and End with roving radio focus', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<StarRating value={3} onChange={onChange} />);
    const group = screen.getByRole('radiogroup');
    const selected = within(group).getByRole('radio', { name: '3 out of 5 stars' });
    selected.focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(4);

    rerender(<StarRating value={4} onChange={onChange} />);
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith(5);

    rerender(<StarRating value={5} onChange={onChange} />);
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});
