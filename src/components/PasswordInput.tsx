import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  toggleLabel?: string;
  wrapperClassName?: string;
}

export function PasswordInput({
  className = '',
  toggleLabel = 'senha',
  wrapperClassName = '',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? `Ocultar ${toggleLabel}` : `Mostrar ${toggleLabel}`}
        aria-pressed={visible}
        title={visible ? `Ocultar ${toggleLabel}` : `Mostrar ${toggleLabel}`}
        className="absolute inset-y-0 right-0 flex cursor-pointer items-center justify-center px-3.5 text-neutral-500 transition-colors hover:text-neutral-800 focus:outline-none focus-visible:text-emerald-900"
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Eye className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
