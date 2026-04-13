import React from 'react';

interface MobileEmbeddedComposerShellProps {
  topControls: React.ReactNode;
  contextPanel?: React.ReactNode;
  inputArea: React.ReactNode;
  footer: React.ReactNode;
}

const MobileEmbeddedComposerShell: React.FC<MobileEmbeddedComposerShellProps> = ({
  topControls,
  contextPanel,
  inputArea,
  footer,
}) => {
  return (
    <div data-mobile-composer-shell="embedded" className="flex h-full min-h-0 flex-col gap-3">
      <div data-mobile-composer-section="mode-strip" className="min-w-0">
        {topControls}
      </div>

      {contextPanel ? (
        <div data-mobile-composer-section="context-panel" className="min-w-0">
          {contextPanel}
        </div>
      ) : null}

      <div data-mobile-composer-section="primary-input" className="min-w-0">
        {inputArea}
      </div>

      <div className="min-w-0">{footer}</div>
    </div>
  );
};

export default MobileEmbeddedComposerShell;
