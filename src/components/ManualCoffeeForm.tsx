import { useState } from 'react';
import type { ManualCoffeeInput, RoastLevel } from '../types/coffee';
import { COFFEE_PROCESSES, ROAST_LEVEL_LABELS } from '../types/coffee';

interface ManualCoffeeFormProps {
  onSubmit: (input: ManualCoffeeInput) => void;
  onCancel?: () => void;
}

const inputClassName = 'field';

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
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <p className="text-sm text-pico-muted">Only the name and roaster are required.</p>

      <div>
        <label htmlFor="coffee-name" className="field-label">
          Coffee name
        </label>
        <input
          id="coffee-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kieni"
          className={inputClassName}
          required
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="coffee-roaster" className="field-label">
          Roaster
        </label>
        <input
          id="coffee-roaster"
          type="text"
          value={roaster}
          onChange={(e) => setRoaster(e.target.value)}
          placeholder="e.g. Coffee Collective"
          className={inputClassName}
          required
        />
      </div>

      <div>
        <label htmlFor="coffee-origin" className="field-label">
          Origin
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
          <label htmlFor="coffee-roast" className="field-label">
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
          <label htmlFor="coffee-process" className="field-label">
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
          <label htmlFor="coffee-custom-process" className="field-label">
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
          <label htmlFor="coffee-variety" className="field-label">
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
          <label htmlFor="coffee-sca-score" className="field-label">
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
          <p id="sca-score-help" className={`mt-1 text-xs ${scaScoreInvalid ? 'text-pico-danger' : 'text-pico-muted'}`}>
            {scaScoreInvalid ? 'Enter a score from 0 to 100.' : 'On the bag, if given (0–100)'}
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary flex-1"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary flex-1"
        >
          Continue to rating
        </button>
      </div>
    </form>
  );
}
