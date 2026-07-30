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
  const options = mode === GenerationMode.PPT
    ? [1, 2, 4, 6, 8, 10]
    : [1, 2, 3, 4];

  return (
    <section className={className} aria-labelledby="composer-parameter-count-title">
      <span id="composer-parameter-count-title">生成数量</span>
      <div role="radiogroup" aria-label="生成数量">
        {options.map((count) => (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={parallelCount === count}
            data-selected={parallelCount === count}
            onClick={() => onSelect(count)}
          >
            {count}
          </button>
        ))}
      </div>
    </section>
  );
};

export default ComposerGenerationCountField;
