import React from 'react';
import { Modal, type ModalProps } from '@lobehub/ui';

export interface KkModalProps extends ModalProps {
  children?: React.ReactNode;
}

export function KkModal({ children, ...props }: KkModalProps) {
  return (
    <Modal {...props}>
      {children}
    </Modal>
  );
}
