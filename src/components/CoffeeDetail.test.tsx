import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoffeeDetail } from './CoffeeDetail';
import { CoffeeCard } from './SimilarList';

afterEach(cleanup);

function renderDetail(coffeeId: string) {
  return render(
    <CoffeeDetail
      coffeeId={coffeeId}
      onSave={vi.fn(() => true)}
      onBack={vi.fn()}
      onSelectCoffee={vi.fn()}
    />,
  );
}

function detailValue(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('CoffeeDetail roaster details', () => {
  it('shows the bag image, coffee facts, tasting notes, and roaster link', () => {
    renderDetail('fixture-ethiopia');

    expect(screen.getByRole('img', { name: 'Halo Hartume bag from Fixture Roasters' })).toHaveAttribute(
      'src',
      'https://example.com/halo-hartume.jpg',
    );
    expect(detailValue('Origin')).toBe('Ethiopia, Yirgacheffe');
    expect(detailValue('Producer')).toBe('Halo Hartume Washing Station');
    expect(detailValue('Variety')).toBe('Heirloom');
    expect(detailValue('Altitude')).toBe('1900–2100 masl');
    expect(detailValue('Process')).toBe('washed');
    expect(detailValue('Roast')).toBe('Light roast · Filter');
    expect(detailValue("Roaster's notes")).toBe('jasmine, lemon zest');
    expect(detailValue('Roaster')).toBe('Fixture Roasters, Copenhagen');

    const link = screen.getByRole('link', { name: /View at roaster/ });
    expect(link).toHaveAttribute('href', 'https://example.com/shop/halo-hartume');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAccessibleName('View at roaster (opens in a new tab)');
    expect(screen.queryByText(/Past coffee/)).not.toBeInTheDocument();
  });

  it('falls back to the Pico placeholder when the bag image fails to load', () => {
    renderDetail('fixture-ethiopia');

    fireEvent.error(screen.getByRole('img', { name: /bag from Fixture Roasters/ }));

    expect(screen.queryByRole('img', { name: /bag from Fixture Roasters/ })).not.toBeInTheDocument();
  });

  it('marks past coffees and leaves out details the roaster did not give', () => {
    renderDetail('fixture-colombia');

    expect(screen.getByText(/Past coffee/)).toBeInTheDocument();
    expect(detailValue('Origin')).toBe('Colombia');
    expect(detailValue('Roast')).toBe('Medium roast · Espresso');
    expect(detailValue('Roaster')).toBe('Second Fixture Coffee');
    expect(screen.queryByText('Producer', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Altitude', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View at roaster/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('CoffeeCard thumbnail', () => {
  it('shows a decorative bag thumbnail and falls back to the Pico mark on error', () => {
    const { container } = render(
      <CoffeeCard
        name="Halo Hartume"
        roaster="Fixture Roasters"
        origin="Ethiopia"
        imageUrl="https://example.com/halo-hartume.jpg"
        onClick={vi.fn()}
      />,
    );

    const thumbnail = container.querySelector('img');
    expect(thumbnail).toHaveAttribute('alt', '');
    expect(screen.getByRole('button')).toHaveAccessibleName(/Halo Hartume.*Fixture Roasters.*Ethiopia/);

    fireEvent.error(thumbnail as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
  });
});
