import React from 'react';
import { Dropdown, type DropdownProps } from '@lobehub/ui';

export interface KkDropdownProps extends DropdownProps {}

export function KkDropdown(props: KkDropdownProps) {
  return <Dropdown {...(props as any)} />;
}
