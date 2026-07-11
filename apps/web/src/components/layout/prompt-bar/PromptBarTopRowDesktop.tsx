import React from 'react';

interface PromptBarTopRowDesktopProps {
  children: React.ReactNode;
}

const PromptBarTopRowDesktop: React.FC<PromptBarTopRowDesktopProps> = ({ children }) => {
  return (
    <div className="flex items-center justify-between gap-1.5">
      {children}
    </div>
  );
};

export default PromptBarTopRowDesktop;
