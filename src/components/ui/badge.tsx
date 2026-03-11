import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary';
}

export function Badge({
  variant = 'default',
  className = '',
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  const variantStyles =
    variant === 'default'
      ? 'bg-slate-100 text-slate-700'
      : 'bg-slate-50 text-slate-600';

  return (
    <span className={`${baseStyles} ${variantStyles} ${className}`} {...props} />
  );
}
