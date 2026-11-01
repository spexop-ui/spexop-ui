import React, { useState, ChangeEvent } from 'react';

export interface InputProps { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean }

export function Input({ id, label, value, onChange, disabled = false }: InputProps) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>('');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validate = (val: string) => {
    if (disabled) return '';
    const trimmed = val.trim();
    if (trimmed === '') return '';
    return emailRegex.test(trimmed) ? '' : 'Enter a valid email address.';
  };
  const handleBlur = () => {
    setTouched(true);
    setError(validate(value));
  };
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    if (touched) setError(validate(newVal));
  };
  const errorId = `${id}-error`;
  const showError = !!error;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="email"
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={showError ? true : undefined}
        aria-describedby={showError ? errorId : undefined}
      />
      {showError && (
        <p id={errorId} className="field-error" role="alert">{error}</p>
      )}
    </div>
  );
}
