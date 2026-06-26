import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const MusicTaskCardRenderer: React.FC<CanvasCardRenderContext> = ({
  item,
  detailLevel,
  isSelected,
  highlighted,
}) => {
  const node = item?.node || item;
  const telemetry = node?.telemetry;

  // 1. Ghost Level
  if (detailLevel === 'ghost') {
    return (
      <div 
        className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-950/20 backdrop-blur-sm pointer-events-auto"
        style={{ width: '320px', height: '160px', padding: '12px' }}
      >
        <div className="w-12 h-3 bg-emerald-500/20 rounded mb-2" />
        <div className="w-full h-8 bg-emerald-500/10 rounded" />
      </div>
    );
  }

  // 2. Skeleton Level (Wave outline +Cover skeleton)
  if (detailLevel === 'skeleton') {
    return (
      <div 
        className="rounded-2xl border border-white/10 bg-zinc-900/90 pointer-events-auto flex flex-col p-5 gap-3 shadow-2xl"
        style={{ width: '380px', height: '200px' }}
      >
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 rounded-lg bg-zinc-800 animate-pulse" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="w-24 h-4 bg-zinc-700 rounded animate-pulse" />
            <div className="w-16 h-3 bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-full h-8 bg-zinc-800 rounded-lg animate-pulse mt-2 flex items-center gap-1 px-2">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="flex-1 bg-zinc-700/50 rounded" style={{ height: `${Math.random() * 20 + 4}px` }} />
          ))}
        </div>
      </div>
    );
  }

  // 3. Full / Compact rendering
  const isFull = detailLevel === 'full';

  return (
    <div 
      className={`rounded-2xl border p-5 pointer-events-auto flex flex-col justify-between overflow-hidden shadow-2xl bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : highlighted ? 'border-emerald-400/60' : 'border-white/10'
      }`}
      style={{
        width: '420px',
        height: isFull ? '280px' : '180px',
        color: '#f4f4f5',
      }}
    >
      {/* Header */}
      <div className="flex gap-4 items-center">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg relative group">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
            <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              MUSIC
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate">
              {node?.model || 'Music-Generator'}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1 truncate">
            {node?.prompt || '未命名音乐生成任务'}
          </h4>
          {node?.audioLyrics && (
            <p className="text-[10px] text-zinc-400 truncate mt-0.5">
              歌词: {node.audioLyrics}
            </p>
          )}
        </div>
      </div>

      {/* Waveform Player */}
      <div className="flex flex-col gap-1.5 my-2">
        <div className="h-8 bg-zinc-900/50 rounded-lg flex items-center gap-1 px-3 border border-white/5">
          {/* Waveform Bars */}
          {[12, 18, 10, 24, 8, 16, 28, 14, 20, 26, 12, 16, 22, 10, 18, 6, 14, 28, 10, 16, 8, 20, 14, 18].map((h, i) => (
            <div 
              key={i} 
              className={`flex-1 rounded-full ${i < 10 ? 'bg-emerald-400' : 'bg-zinc-700'}`} 
              style={{ height: `${h}px` }} 
            />
          ))}
          <span className="text-[10px] font-mono text-zinc-400 ml-2">00:15 / 02:00</span>
        </div>
      </div>

      {/* Telemetry Display */}
      {isFull && (
        <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-zinc-400">
            <div className="bg-zinc-900/40 p-1.5 rounded border border-white/5">
              <span className="text-zinc-600 text-[8px] uppercase block">耗时 (Latency)</span>
              <span className="text-white font-semibold">{telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(2)}s` : '8.6s'}</span>
            </div>
            <div className="bg-zinc-900/40 p-1.5 rounded border border-white/5">
              <span className="text-zinc-600 text-[8px] uppercase block">Token / 规格</span>
              <span className="text-white font-semibold">{telemetry?.usage?.totalTokens || 'Stereo 44k'}</span>
            </div>
            <div className="bg-zinc-900/40 p-1.5 rounded border border-white/5">
              <span className="text-zinc-600 text-[8px] uppercase block">花费 (Cost)</span>
              <span className="text-white font-semibold text-emerald-400">{telemetry?.cost?.chargedCredits || 2} Credits</span>
            </div>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono flex justify-between">
            <span>信道: {telemetry?.route?.sourceType || 'cloud-platform-key'}</span>
            <span>凭证: {telemetry?.cost?.ledgerId || 'tx_music_923'}</span>
          </div>
        </div>
      )}

      {/* Footer for compact */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-1.5 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Platform'}</span>
          <span className="text-emerald-400">{telemetry?.cost?.chargedCredits || 2} Credits</span>
        </div>
      )}
    </div>
  );
};

export default MusicTaskCardRenderer;
