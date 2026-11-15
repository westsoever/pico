import { useState } from 'react';
import { CloseIcon } from './icons';
import { back, go } from './routing';

export function AddByHand() {
  const [done, setDone] = useState(false);
  return (
    <div className="p-sheet-page">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
      {done ? (
        <>
          <h1>Saved to your journal</h1>
          <p>Want other people to find it too? Send it to Pico and we’ll add it to the catalog.</p>
          <button className="p-btn p-btn--amber" onClick={() => go('/journal')}>Send this coffee to Pico</button>
          <button className="p-btn p-btn--ghost" onClick={() => go('/journal')}>Not now</button>
        </>
      ) : (
        <form className="p-form" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
          <h1>Add a coffee</h1>
          <input placeholder="Coffee name" required />
          <input placeholder="Roaster" required />
          <input placeholder="Origin (optional)" />
          <button className="p-btn p-btn--dark">Save</button>
        </form>
      )}
    </div>
  );
}
