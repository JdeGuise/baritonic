export const KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

export interface KeySelectorProps {
  id: string;
  label: string;
  value: string;
  onChange: (key: string) => void;
  emphasis?: boolean;
}

export function KeySelector({ id, label, value, onChange, emphasis }: KeySelectorProps) {
  // A detected key may be spelled outside the twelve offered here (C# minor,
  // say). Keep it selectable rather than silently snapping it to something
  // else.
  const known = (KEYS as readonly string[]).includes(value);
  const options = known ? [...KEYS] : [value, ...KEYS];

  return (
    <span className="kgroup">
      <label className="klabel" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        aria-label={label}
        className={emphasis ? "ksel emphasis" : "ksel"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </span>
  );
}
