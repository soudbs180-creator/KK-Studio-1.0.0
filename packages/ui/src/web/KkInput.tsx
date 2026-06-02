import React from 'react';
import { Input, type InputProps } from '@lobehub/ui';

export interface KkInputProps extends InputProps {}

export function KkInput(props: KkInputProps) {
  return <Input {...props} />;
}
