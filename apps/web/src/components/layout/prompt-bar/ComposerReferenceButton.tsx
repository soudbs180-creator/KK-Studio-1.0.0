import React from 'react';
import { ImagePlus } from 'lucide-react';
import { PROMPT_COMPOSER_ACTIONS } from '../../../features/ai-assistant-runtime';

interface ComposerReferenceButtonProps {
  count: number;
  onClick: () => void;
}

/** Keeps the reference entry point in the same semantic slot across modes. */
const ComposerReferenceButton: React.FC<ComposerReferenceButtonProps> = ({ count, onClick }) => (
  <button
    type="button"
    data-composer-control="reference"
    data-prompt-composer-action={PROMPT_COMPOSER_ACTIONS.addReferenceImage.uiAction}
    className="kk-composer-reference-button prompt-bar-liquid-button"
    onClick={onClick}
    aria-label={count > 0 ? `管理参考，当前 ${count} 项` : '添加参考'}
    title={count > 0 ? `管理参考 · ${count}` : '添加参考'}
  >
    <ImagePlus size={15} aria-hidden="true" />
    <span>参考</span>
    {count > 0 ? <span className="kk-composer-reference-count">{count}</span> : null}
  </button>
);

export default ComposerReferenceButton;
