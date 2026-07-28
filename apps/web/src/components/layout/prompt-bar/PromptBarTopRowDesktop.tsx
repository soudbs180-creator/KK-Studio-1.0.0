import React from 'react';

interface PromptBarTopRowDesktopProps {
  children: React.ReactNode;
}

const PromptBarTopRowDesktop: React.FC<PromptBarTopRowDesktopProps> = ({ children }) => {
  return (
    <div className="kk-composer-floating-tools flex items-center justify-between gap-1.5">
      {children}
    </div>
  );
};

export default PromptBarTopRowDesktop;
