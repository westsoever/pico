import { useState } from 'react';
import { type FlavorTag, type RoastLevel } from '../../types/coffee';
import { type TasteSeed } from '../../lib/taste-profile';
import { ACCOUNTS, FREE_SCANS, setState, coffeeById } from './state';
import { CameraIcon } from './icons';
import { Bag } from './parts';
import { go } from './routing';

// First-run taste quiz: 3 one-tap questions, each skippable. Seeds the match % before any rating.
const QUIZ_DRINK = [
  { label: 'Black', roasts: ['light', 'medium'] },
  { label: 'With milk', roasts: ['medium', 'dark'] },
  { label: 'Both', roasts: ['medium'] },
] as const;

const QUIZ_FLAVORS: { label: string; tags: FlavorTag[] }[] = [
  { label: 'Fruity, like berries', tags: ['fruity', 'berry'] },
  { label: 'Fresh, like citrus', tags: ['citrus', 'bright'] },
  { label: 'Flowery, like tea', tags: ['floral'] },
  { label: 'Chocolate and nuts', tags: ['chocolate', 'nutty'] },
  { label: 'Sweet, like caramel', tags: ['caramel', 'chocolate'] },
];

const QUIZ_ROAST = [
  { label: 'Mild and bright', roasts: ['light'] },
  { label: 'In between', roasts: ['medium'] },
  { label: 'Dark and bold', roasts: ['dark'] },
] as const;

export function Quiz({ q }: { q: URLSearchParams }) {
  const [step, setStep] = useState(0);
  const [roasts, setRoasts] = useState<RoastLevel[]>([]);
  const [flavors, setFlavors] = useState<FlavorTag[]>([]);
  // replace: the quiz leaves no history entry, so closing the next screen can't land back in it
  const finish = (seed: TasteSeed) => { setState({ tasteSeed: seed }); window.location.replace(`#${q.get('next') || '/discover'}`); };
  const steps = [
    { title: 'How do you drink your coffee?', options: QUIZ_DRINK.map((o) => ({ label: o.label, pick: () => { setRoasts([...o.roasts]); setStep(1); } })) },
    { title: 'Which sounds best?', options: QUIZ_FLAVORS.map((o) => ({ label: o.label, pick: () => { setFlavors(o.tags); setStep(2); } })) },
    { title: 'How strong do you like it?', options: [
      ...QUIZ_ROAST.map((o) => ({ label: o.label, pick: () => finish({ flavors, roasts: [...o.roasts] }) })),
      { label: 'Not sure', pick: () => finish({ flavors, roasts }) },
    ] },
  ];
  return (
    <div className="p-screen p-quiz">
      <div className="p-quiz__top">
        <div className="p-dots">{steps.map((_, i) => <span key={i} data-on={i <= step || undefined} />)}</div>
        <button className="p-link" onClick={() => finish({ flavors, roasts })}>Skip</button>
      </div>
      <h1 className="p-title">{steps[step].title}</h1>
      <div className="p-quiz__options">
        {steps[step].options.map((o) => <button key={o.label} className="p-btn p-btn--ghost" onClick={o.pick}>{o.label}</button>)}
      </div>
      <p className="p-fine">So Pico can show how well each coffee suits you. Your ratings take over from here.</p>
    </div>
  );
}

export function Welcome() {
  // Scan and Browse pass through the taste quiz first; "I have an account" goes straight to sign-in.
  // The quiz replaces the welcome entry (and the quiz replaces itself), so Back never returns to onboarding.
  const done = (to: string) => {
    setState({ seenWelcome: true });
    if (to.startsWith('/signup')) go(to);
    else window.location.replace(`#/quiz?next=${encodeURIComponent(to)}`);
  };
  // Transparent-PNG bags (corner alpha 0) from 3 roasters, so no white box shows behind them.
  const hero = ['coffee-collective-mulugeta-anaerobic', 'kontra-kenya-gicherori', 'skaastrupkaffen-special-blend']
    .map((id) => coffeeById(id)).filter((c) => c !== undefined);
  // This bag fills more of its photo (89% vs 76% of the height), so shrink it to the same visible height.
  const heroScale: Record<string, number> = { 'skaastrupkaffen-special-blend': 0.85 };
  return (
    <div className="p-welcome">
      <div className="p-welcome__bags">
        {hero.map((c, i) => <span key={c.id} className="p-welcome__bag" data-i={i} style={{ scale: heroScale[c.id] }}><Bag coffee={c} w={300} /></span>)}
      </div>
      <h1 className="p-welcome__title">Know if you’ll love a bag before you open it.</h1>
      <p className="p-welcome__body">Taste it. Rate it. Let Pico find your next favorite.</p>
      <button className="p-btn p-btn--amber" onClick={() => done('/scan')}><CameraIcon size={22} /> Scan a coffee bag</button>
      <button className="p-btn p-btn--ghost" onClick={() => done('/discover')}>Browse coffees</button>
      {ACCOUNTS && <span className="p-fine">{FREE_SCANS} free scans, no account needed · <button className="p-link" onClick={() => done('/signup?reason=account')}>I have an account</button></span>}
    </div>
  );
}
