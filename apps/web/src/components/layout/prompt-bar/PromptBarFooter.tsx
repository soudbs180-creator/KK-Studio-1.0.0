import React from 'react';
import PromptBarFooterMobile from './PromptBarFooterMobile';
import PromptBarFooterDesktop from './PromptBarFooterDesktop';
import PromptVoiceInputButton from './PromptVoiceInputButton';

interface PromptBarFooterProps {
  isMobile: boolean;
  children: React.ReactNode;
}

const PromptBarFooter: React.FC<PromptBarFooterProps> = ({ isMobile, children }) => {
  if (isMobile) {
    return (
      <PromptBarFooterMobile>
        <PromptVoiceInputButton />
        {children}
      </PromptBarFooterMobile>
    );
  }

  return (
    <PromptBarFooterDesktop>
      <PromptVoiceInputButton />
      {children}
    </PromptBarFooterDesktop>
  );
};

export default PromptBarFooter;
