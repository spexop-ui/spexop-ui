import type { ChangeEvent } from 'react';
export interface InputProps { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean }
export function Input({ id, label, value, onChange, disabled = false }: InputProps) {
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} type="email" value={value} disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} /></div>;
}
