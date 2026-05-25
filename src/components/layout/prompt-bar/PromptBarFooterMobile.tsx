import React from 'react';

interface PromptBarFooterMobileProps {
  children: React.ReactNode;
}

const PromptBarFooterMobile: React.FC<PromptBarFooterMobileProps> = ({ children }) => {
  return (
    <div
      data-mobile-action-overflow-policy="single-row-primary-secondary-drawer"
      className="input-bar-footer prompt-bar-footer-frost flex w-full flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible px-1 pb-1 pt-0.5 min-h-[44px]"
    >
      {children}
    </div>
  );
};

export default PromptBarFooterMobile;
