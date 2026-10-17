import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLabelText } from '../lib/label-ocr';
import { ScanView } from './ScanView';

const PHOTO = 'data:image/jpeg;base64,bGFiZWw=';

vi.mock('../lib/label-ocr', () => ({ readLabelText: vi.fn() }));

// The real capture resizes through canvas, which jsdom lacks.
vi.mock('./CameraCapture', () => ({
  CameraCapture: ({
    photoDataUrl,
    onCapture,
    title,
  }: {
    photoDataUrl?: string;
    onCapture: (dataUrl: string | undefined) => void;
    title?: string;
  }) =>
    photoDataUrl ? (
      <button type="button" onClick={() => onCapture(undefined)}>Remove photo</button>
    ) : (
      <button type="button" onClick={() => onCapture(PHOTO)}>{title}</button>
    ),
}));

const readLabel = vi.mocked(readLabelText);

afterEach(cleanup);

function renderScan() {
  const onSelectCoffee = vi.fn();
  const user = userEvent.setup();
  render(<ScanView onSelectCoffee={onSelectCoffee} />);
  const scan = () => user.click(screen.getByRole('button', { name: 'Scan a coffee bag' }));
  const results = () => within(screen.getByRole('region', { name: 'Label scan results' }));
  return { user, onSelectCoffee, scan, results };
}

describe('ScanView label scanning', () => {
  it('makes scanning the first action on Discover', () => {
    renderScan();

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Scan a coffee bag');
    expect(screen.getByText(/never uploaded/)).toBeInTheDocument();
  });

  it('shows likely coffees and opens the chosen one with the label photo', async () => {
    let finishReading: (text: string) => void = () => {};
    readLabel.mockReturnValue(new Promise((resolve) => (finishReading = resolve)));
    const { user, onSelectCoffee, scan, results } = renderScan();

    await scan();
    expect(readLabel).toHaveBeenCalledWith(PHOTO);
    expect(screen.getByRole('status')).toHaveTextContent('Reading label…');

    finishReading('FIXTURE ROASTERS\nHalo Hartume\nEthiopia · Yirgacheffe\n250 g');
    expect(await results().findByRole('heading', { name: 'Is it one of these?' })).toBeInTheDocument();

    const cards = results().getAllByRole('button', { name: /Fixture Roasters/ });
    expect(cards[0]).toHaveAccessibleName(/Halo Hartume.*Matched Fixture Roasters, Halo Hartume/);
    expect(cards[1]).toHaveAccessibleName(/Gatomboya.*Roaster match only/);

    await user.click(cards[0]);
    expect(onSelectCoffee).toHaveBeenCalledWith('fixture-ethiopia', PHOTO);
  });

  it('pre-fills search with the label words when none of the suggestions fit', async () => {
    readLabel.mockResolvedValue('Second Fixture Coffee\nFazenda Rainha\nBrazil');
    const { user, scan, results } = renderScan();

    await scan();
    await user.click(await results().findByRole('button', { name: 'None of these' }));

    const search = screen.getByRole('searchbox', { name: 'Search coffee catalog' });
    expect(search).toHaveFocus();
    expect(search).toHaveValue('fazenda rainha brazil');
    const browse = within(screen.getByRole('region', { name: 'Browse coffees' }));
    expect(browse.getAllByRole('button', { name: /Fazenda Rainha/ })[0]).toBeInTheDocument();
  });

  it('says when the label is readable but the coffee is not in the catalog', async () => {
    readLabel.mockResolvedValue('Wonderland Roasters\nLychee Bomb');
    const { user, scan, results } = renderScan();

    await scan();
    expect(await results().findByText(/did not find this coffee/)).toBeInTheDocument();
    await user.click(results().getByRole('button', { name: 'Search the catalog' }));

    expect(screen.getByRole('searchbox', { name: 'Search coffee catalog' })).toHaveValue('wonderland lychee bomb');
  });

  it('offers search and adding the coffee when no text is read', async () => {
    readLabel.mockResolvedValue('  |||  ~~ \n');
    const { user, onSelectCoffee, scan, results } = renderScan();

    await scan();
    expect(await results().findByText(/No text could be read/)).toBeInTheDocument();

    await user.click(results().getByRole('button', { name: 'Search instead' }));
    const search = screen.getByRole('searchbox', { name: 'Search coffee catalog' });
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');

    await user.click(results().getByRole('button', { name: 'Add it' }));
    expect(screen.getByRole('region', { name: 'Add from the bag' })).toHaveFocus();
    expect(screen.getByText(/label photo is saved with the rating/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Coffee name' }), 'Mystery Lot');
    await user.type(screen.getByRole('textbox', { name: 'Roaster' }), 'Unknown Roaster');
    await user.click(screen.getByRole('button', { name: 'Continue to rating' }));

    expect(onSelectCoffee).toHaveBeenCalledWith(expect.stringMatching(/^custom-/), PHOTO, true);
  });

  it('offers search when the label reader cannot start', async () => {
    readLabel.mockRejectedValue(new Error('offline'));
    const { scan, results } = renderScan();

    await scan();
    expect(await results().findByText(/label reader could not start/)).toBeInTheDocument();
    expect(results().getByRole('button', { name: 'Search instead' })).toBeInTheDocument();
  });

  it('ignores a late result after the photo was removed', async () => {
    let finishReading: (text: string) => void = () => {};
    readLabel.mockReturnValue(new Promise((resolve) => (finishReading = resolve)));
    const { user, scan, results } = renderScan();

    await scan();
    await user.click(screen.getByRole('button', { name: 'Remove photo' }));
    finishReading('Fixture Roasters Halo Hartume');

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(results().queryByRole('heading', { name: 'Is it one of these?' })).not.toBeInTheDocument();
  });
});
