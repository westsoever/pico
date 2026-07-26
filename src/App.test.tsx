import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(cleanup);

describe('Pico app interactions', () => {
  it('takes a catalog coffee from Discover through rating and saving to the Journal', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/discover';

    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Discover' })).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: /Yirgacheffe Kochere.*Onyx Coffee Lab.*Ethiopia/i,
      }),
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Yirgacheffe Kochere' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/coffee/eth-yirg-001?from=discover');

    const ratingForm = screen.getByRole('heading', { name: 'Rate this coffee' }).closest('section');
    expect(ratingForm).not.toBeNull();
    const form = within(ratingForm as HTMLElement);
    const saveButton = form.getByRole('button', { name: 'Save to journal' });
    expect(saveButton).toBeDisabled();

    await user.click(form.getByRole('radio', { name: '4 out of 5 stars' }));
    await user.type(
      form.getByRole('textbox', { name: /Tasting note/i }),
      'Jasmine and lemon, with a clean finish.',
    );
    await user.click(saveButton);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Journal' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/journal');
    expect(screen.getByRole('status')).toHaveTextContent('Saved to your coffee journal.');
    expect(screen.getByRole('heading', { level: 3, name: 'Yirgacheffe Kochere' })).toBeInTheDocument();
    expect(screen.getByLabelText('4 out of 5 stars')).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem('pico-user-data') ?? '{}');
    expect(stored.ratings).toEqual([
      expect.objectContaining({
        coffeeId: 'eth-yirg-001',
        stars: 4,
        note: 'Jasmine and lemon, with a clean finish.',
      }),
    ]);

    const search = screen.getByRole('searchbox', { name: 'Search journal' });
    await user.type(search, 'does not exist');
    expect(screen.getByRole('heading', { name: 'No journal entries match' })).toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 1 entry')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('heading', { level: 3, name: 'Yirgacheffe Kochere' })).toBeInTheDocument();
  });

  it('honors direct hashes and reacts to browser hash navigation', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/journal';

    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Journal' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discover' }));
    await waitFor(() => expect(window.location.hash).toBe('#/discover'));
    expect(screen.getByRole('heading', { level: 1, name: 'Discover' })).toBeInTheDocument();

    window.location.hash = '#/taste';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Taste' })).toBeInTheDocument();

    window.location.hash = '#/coffee/eth-yirg-001?from=journal';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Yirgacheffe Kochere' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Journal' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/journal');
  });

  it('removes an unfinished custom coffee when rating is cancelled', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/discover';
    render(<App />);

    await user.click(screen.getByRole('button', { name: '+ Add coffee' }));
    await user.click(screen.getByRole('button', { name: 'Enter label details' }));
    await user.type(screen.getByRole('textbox', { name: 'Coffee name' }), 'Test Lot');
    await user.type(screen.getByRole('textbox', { name: 'Roaster' }), 'Test Roaster');
    await user.click(screen.getByRole('button', { name: 'Continue to rating' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Test Lot' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pico-custom-coffees') ?? '[]')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Discover' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('pico-custom-coffees') ?? '[]')).toEqual([]);
  });

  it('falls back safely when a coffee hash contains malformed URI encoding', () => {
    window.location.hash = '#/coffee/%E0%A4%A?from=journal';

    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByRole('heading', { level: 1, name: 'Journal' })).toBeInTheDocument();
  });

  it('keeps the rating draft open and reports an error when storage fails', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/discover';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });

    render(<App />);
    await user.click(
      screen.getByRole('button', {
        name: /Yirgacheffe Kochere.*Onyx Coffee Lab.*Ethiopia/i,
      }),
    );

    const ratingForm = screen.getByRole('heading', { name: 'Rate this coffee' }).closest('section');
    const form = within(ratingForm as HTMLElement);
    await user.click(form.getByRole('radio', { name: '4 out of 5 stars' }));
    await user.type(form.getByRole('textbox', { name: /Tasting note/i }), 'Keep this draft.');
    await user.click(form.getByRole('button', { name: 'Save to journal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full');
    expect(window.location.hash).toBe('#/coffee/eth-yirg-001?from=discover');
    expect(form.getByRole('textbox', { name: /Tasting note/i })).toHaveValue('Keep this draft.');
  });

  it('does not carry a draft into a different coffee', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.location.hash = '#/coffee/eth-yirg-001?from=discover';
    render(<App />);

    await user.click(screen.getByRole('radio', { name: '5 out of 5 stars' }));
    await user.type(screen.getByRole('textbox', { name: /Tasting note/i }), 'Only for coffee A');

    const similarSection = screen.getByRole('heading', { name: 'Similar coffees' }).closest('section');
    expect(similarSection).not.toBeNull();
    await user.click(within(similarSection as HTMLElement).getAllByRole('button')[0]);

    expect(screen.getByRole('textbox', { name: /Tasting note/i })).toHaveValue('');
    expect(screen.getByRole('radio', { name: '1 out of 5 stars' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('guards internal and native hash navigation while a rating draft is dirty', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/discover';
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<App />);
    await user.click(
      screen.getByRole('button', {
        name: /Yirgacheffe Kochere.*Onyx Coffee Lab.*Ethiopia/i,
      }),
    );
    await user.type(screen.getByRole('textbox', { name: /Tasting note/i }), 'Unsaved');

    await user.click(screen.getByRole('button', { name: 'Journal' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/coffee/eth-yirg-001?from=discover');

    window.location.hash = '#/taste';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe('#/coffee/eth-yirg-001?from=discover');
    expect(screen.getByRole('textbox', { name: /Tasting note/i })).toHaveValue('Unsaved');
  });
});
