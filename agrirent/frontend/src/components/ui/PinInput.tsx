import React, { useRef, KeyboardEvent, ClipboardEvent } from 'react';

export interface PinInputProps {
  length?: number;
  value: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
  error?: string;
  hasError?: boolean;
  autoFocus?: boolean;
}

export const PinInput: React.FC<PinInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
  error,
  hasError = false,
  autoFocus = true,
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const handleChange = (index: number, val: string) => {
    const cleanDigit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanDigit;

    const newPin = newDigits.join('').slice(0, length);
    onChange(newPin);

    // Auto-advance focus to next box
    if (cleanDigit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    onChange(pasted);
    const targetIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[targetIndex]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 sm:gap-3" onPaste={handlePaste}>
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[i] || ''}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-11 h-13 sm:w-13 sm:h-15 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl border transition-all duration-150 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:cursor-not-allowed ${
              error || hasError
                ? 'border-rose-300 bg-rose-50/30 text-rose-700 focus:border-rose-500 focus:ring-rose-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-brand-500 focus:ring-brand-500/20 shadow-sm'
            }`}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>
      {error && <p className="text-xs text-rose-600 font-medium text-center">{error}</p>}
    </div>
  );
};
