import React from 'react';
import { Button, type ButtonProps } from '@lobehub/ui';

export type KkButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost' | 'recharge';

export interface KkButtonProps extends Omit<ButtonProps, 'type'> {
  tone?: KkButtonTone;
}

export function KkButton({ tone = 'secondary', className, ...props }: KkButtonProps) {
  return (
    <Button
      {...(props as any)}
      className={[
        'kk-button',
        `kk-button--${tone}`,
        className,
      ].filter(Boolean).join(' ')}
    />
  );
}
