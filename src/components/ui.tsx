import type { ReactNode } from 'react';
import { zoneChipStyle } from '../lib/format';

export function BackButton({ onClick }: { onClick: () => void }) {
  return <button className="btn-back" onClick={onClick} aria-label="Voltar">←</button>;
}

export function Chip({ label, selected, onClick, check = false }: { label: string; selected: boolean; onClick: () => void; check?: boolean }) {
  return (
    <button type="button" className={`chip${selected ? ' on' : ''}`} onClick={onClick}>
      <span>{label}</span>
      {check && selected && <span className="check">✓</span>}
    </button>
  );
}

export function ChipSm({ label, selected, onClick, flex = false }: { label: string; selected: boolean; onClick: () => void; flex?: boolean }) {
  return (
    <button type="button" className={`chip-sm${selected ? ' on' : ''}${flex ? ' flex1' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={o} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={onClick}>
      <span />
    </button>
  );
}

export function ZoneChip({ zone, large = false }: { zone: string | null | undefined; large?: boolean }) {
  if (!zone) return null;
  return <span className={`zone-chip${large ? ' lg' : ''}`} style={zoneChipStyle(zone)}>{zone}</span>;
}

export function Section({ label, children, gap = 10 }: { label: string; children: ReactNode; gap?: number }) {
  return (
    <div className="col" style={{ gap }}>
      <span className="section-label">{label}</span>
      {children}
    </div>
  );
}

export function Overlay({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`overlay ${className}`}>{children}</div>;
}
