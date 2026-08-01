import React from 'react';

import { GenerationMode } from '../../../types';

interface ComposerGenerationCountFieldProps {
  mode: GenerationMode;
  parallelCount: number;
  onSelect: (count: number) => void;
  className?: string;
}

/** Keeps generation quantity inside the shared parameter hierarchy. */
const ComposerGenerationCountField: React.FC<ComposerGenerationCountFieldProps> = ({
  mode,
  parallelCount,
  onSelect,
  className = 'kk-composer-parameter-count',
}) => {
  const normalizedCount = Math.min(10, Math.max(1, parallelCount));

  return (
    <section className={className} aria-labelledby="composer-parameter-count-title" data-generation-mode={mode}>
      <div className="kk-composer-parameter-count__heading">
        <span id="composer-parameter-count-title">生成数量</span>
        <output htmlFor="composer-parameter-count-slider">{normalizedCount} 张</output>
      </div>
      <input
        id="composer-parameter-count-slider"
        className="kk-composer-parameter-count__slider"
        type="range"
        min={1}
        max={10}
        step={1}
        value={normalizedCount}
        aria-valuetext={`${normalizedCount} 张`}
        onChange={(event) => onSelect(Number(event.currentTarget.value))}
      />
      <div className="kk-composer-parameter-count__ticks" aria-hidden="true">
        <span>1</span><span>5</span><span>10</span>
      </div>
    </section>
  );
};

export default ComposerGenerationCountField;
