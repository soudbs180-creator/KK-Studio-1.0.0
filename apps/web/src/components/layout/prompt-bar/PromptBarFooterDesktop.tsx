import React from 'react';

interface PromptBarFooterDesktopProps {
  children: React.ReactNode;
}

const PromptBarFooterDesktop: React.FC<PromptBarFooterDesktopProps> = ({ children }) => {
  return (
    <div className="input-bar-footer flex w-full min-w-0 flex-nowrap items-center gap-1.5">
      {children}
    </div>
  );
};

export default PromptBarFooterDesktop;
