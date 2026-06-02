import React from 'react';
import { Select, type SelectProps } from '@lobehub/ui';

export interface KkSelectProps extends SelectProps {}

export function KkSelect(props: KkSelectProps) {
  return <Select {...(props as any)} />;
}
