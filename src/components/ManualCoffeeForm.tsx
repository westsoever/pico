import { useState } from 'react';
import type { ManualCoffeeInput, RoastLevel } from '../types/coffee';
import { COFFEE_PROCESSES, ROAST_LEVEL_LABELS } from '../types/coffee';

interface ManualCoffeeFormProps {
  onSubmit: (input: ManualCoffeeInput) => void;
  onCancel?: () => void;
}

const inputClassName =
  'w-full rounded-xl border border-[#e8dfd6] bg-white px-4 py-3 text-[#1c1410] placeholder:text-[#766257] focus:border-[#6b3a2a] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/20';

export function ManualCoffeeForm({ onSubmit, onCancel }: ManualCoffeeFormProps) {
  const [name, setName] = useState('');
  const [roaster, setRoaster] = useState('');
  const [origin, setOrigin] = useState('');
  const [process, setProcess] = useState<string>('washed');
  const [customProcess, setCustomProcess] = useState('');
  const [roastLevel, setRoastLevel] = useState<RoastLevel>('medium');
  const [variety, setVariety] = useState('');
  const [scaScore, setScaScore] = useState('');

  const resolvedProcess = process === 'other' ? customProcess.trim() : process;
  const parsedScaScore = scaScore.trim() ? Number(scaScore) : undefined;
  const scaScoreInvalid =
    parsedScaScore !== undefined &&
    (!Number.isFinite(parsedScaScore) || parsedScaScore < 0 || parsedScaScore > 100);
  const canSubmit =
    name.trim().length > 0 &&
    roaster.trim().length > 0 &&
    resolvedProcess.length > 0 &&
    !scaScoreInvalid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      name: name.trim(),
      roaster: roaster.trim(),
      origin: origin.trim() || undefined,
      process: resolvedProcess,
      roastLevel,
      variety: variety.trim() || undefined,
      scaScore: parsedScaScore,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-[#e2d6cc] bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-[#1c1410]">Coffee details</h3>
        <p className="mt-1 text-sm leading-5 text-[#78675d]">
          Copy what you can from the label. Only name, roaster, roast, and process are required.
        </p>
      </div>

      <div>
        <label htmlFor="coffee-name" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
          Coffee name
        </label>
        <input
          id="coffee-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Yirgacheffe Kochere"
          className={inputClassName}
          required
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="coffee-roaster" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
          Roaster
        </label>
        <input
          id="coffee-roaster"
          type="text"
          value={roaster}
          onChange={(e) => setRoaster(e.target.value)}
          placeholder="e.g. Onyx Coffee Lab"
          className={inputClassName}
          required
        />
      </div>

      <div>
        <label htmlFor="coffee-origin" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
          Origin (optional)
        </label>
        <input
          id="coffee-origin"
          type="text"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="e.g. Ethiopia"
          className={inputClassName}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="coffee-roast" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
            Roast
          </label>
          <select
            id="coffee-roast"
            value={roastLevel}
            onChange={(e) => setRoastLevel(e.target.value as RoastLevel)}
            className={inputClassName}
          >
            {(Object.entries(ROAST_LEVEL_LABELS) as [RoastLevel, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="coffee-process" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
            Process
          </label>
          <select
            id="coffee-process"
            value={process}
            onChange={(e) => setProcess(e.target.value)}
            className={inputClassName}
          >
            {COFFEE_PROCESSES.map((option) => (
              <option key={option} value={option}>
                {option === 'other' ? 'Other…' : option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {process === 'other' && (
        <div>
          <label htmlFor="coffee-custom-process" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
            Custom process
          </label>
          <input
            id="coffee-custom-process"
            type="text"
            value={customProcess}
            onChange={(e) => setCustomProcess(e.target.value)}
            placeholder="e.g. carbonic maceration"
            className={inputClassName}
            required
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="coffee-variety" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
            Variety
          </label>
          <input
            id="coffee-variety"
            type="text"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            placeholder="e.g. Geisha, Bourbon"
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="coffee-sca-score" className="mb-2 block text-sm font-medium text-[#6b3a2a]">
            SCA Score
          </label>
          <input
            id="coffee-sca-score"
            type="number"
            min={0}
            max={100}
            step={0.25}
            value={scaScore}
            onChange={(e) => setScaScore(e.target.value)}
            placeholder="e.g. 86.5"
            className={inputClassName}
            aria-invalid={scaScoreInvalid}
            aria-describedby="sca-score-help"
          />
          <p id="sca-score-help" className={`mt-1 text-xs ${scaScoreInvalid ? 'text-[#9b2c2c]' : 'text-[#766257]'}`}>
            {scaScoreInvalid ? 'Enter a score from 0 to 100.' : 'Specialty Coffee Association (0–100)'}
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[#d6c7bb] bg-white py-3 font-medium text-[#6b3a2a] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 rounded-xl bg-[#6b3a2a] py-3 font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#6b3a2a] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to rating
        </button>
      </div>
    </form>
  );
}
