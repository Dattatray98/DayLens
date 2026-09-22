import React from 'react';
import { FaShieldHalved, FaArrowRotateRight } from 'react-icons/fa6';
import { MdErrorOutline, MdCheckCircleOutline } from 'react-icons/md';

export type ModelSetupStatus = 'preparing' | 'downloading' | 'verifying' | 'ready' | 'error';

export interface ModelSetupState {
  status: ModelSetupStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

export interface ModelSetupScreenProps extends ModelSetupState {
  onRetry?: () => void;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  if (mb < 1) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${Math.round(mb)} MB`;
}

const statusConfig: Record<
  ModelSetupStatus,
  {
    title: string;
    subtitle: string;
    dotClass: string;
  }
> = {
  preparing: {
    title: 'Preparing local AI',
    subtitle: 'Checking the on-device model.',
    dotClass: 'bg-[#0EA5E9]',
  },
  downloading: {
    title: 'Downloading local AI',
    subtitle: 'Downloading on-device intelligence model for offline use.',
    dotClass: 'bg-[#0EA5E9]',
  },
  verifying: {
    title: 'Verifying local AI',
    subtitle: 'Checking model integrity before use.',
    dotClass: 'bg-amber-400',
  },
  ready: {
    title: 'Local AI ready',
    subtitle: 'Model verified. Launching...',
    dotClass: 'bg-emerald-400',
  },
  error: {
    title: 'Local AI setup failed',
    subtitle: 'Unable to prepare local model on this device.',
    dotClass: 'bg-rose-500',
  },
};

export const ModelSetupScreen: React.FC<ModelSetupScreenProps> = ({
  status,
  progress,
  downloadedBytes,
  totalBytes,
  error,
  onRetry,
}) => {
  const currentConfig = statusConfig[status] || statusConfig.preparing;
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="min-h-screen bg-[#0E1012] text-white flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-8 relative overflow-hidden select-none">
      {/* Subtle ambient lighting */}
      <div className="bg-[#009ADA] blur-[140px] absolute -top-16 -right-16 h-64 w-64 opacity-25 pointer-events-none" />
      <div className="bg-[#3B82F6] blur-[150px] absolute -bottom-16 -left-16 h-64 w-64 opacity-20 pointer-events-none" />

      {/* Top Header / Status Pill */}
      <header className="relative z-10 flex items-center justify-between w-full max-w-sm mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#0EA5E9]/15 border border-[#0EA5E9]/30 flex items-center justify-center">
            <span className="text-[#0EA5E9] font-black text-[10px] leading-none">W</span>
          </div>
          <span className="text-xs font-semibold tracking-tight text-white/90">
            wellNess Voice
          </span>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#909193] font-medium font-mono">
          On-Device AI
        </span>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-col items-center text-center my-auto py-6 sm:py-8 w-full max-w-sm mx-auto">
        {/* Brand Emblem */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-[#0EA5E9]/20 blur-xl pointer-events-none" />
          <div className="relative h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-[#1b1d1f] border border-[#0EA5E9]/30 flex items-center justify-center shadow-xl shadow-cyan-950/40">
            {status === 'error' ? (
              <MdErrorOutline className="h-8 sm:h-9 w-8 sm:w-9 text-rose-500" />
            ) : status === 'ready' ? (
              <MdCheckCircleOutline className="h-8 sm:h-9 w-8 sm:w-9 text-emerald-400" />
            ) : (
              <span className="text-[#0EA5E9] font-black text-2xl sm:text-3xl tracking-tighter select-none">
                W
              </span>
            )}
          </div>
        </div>

        {/* App Title */}
        <div className="flex items-center justify-center mb-5">
          <span className="font-bold text-lg sm:text-xl tracking-tight text-white">
            well<span className="text-[#0EA5E9]">Ness</span>
          </span>
          <span className="text-white/80 font-medium text-lg sm:text-xl ml-1">
            Voice
          </span>
        </div>

        {/* Phase Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
          <span
            className={`w-2 h-2 rounded-full ${currentConfig.dotClass} ${
              status === 'downloading' || status === 'preparing' || status === 'verifying'
                ? 'animate-pulse'
                : ''
            }`}
          />
          <h2 className="text-xs sm:text-sm font-medium text-white tracking-wide">
            {currentConfig.title}
          </h2>
        </div>

        {/* Supporting Description */}
        <p className="text-xs sm:text-sm text-[#909193] max-w-xs leading-relaxed mb-6 break-words [overflow-wrap:anywhere]">
          {status === 'error' && error ? 'Model preparation encountered an issue.' : currentConfig.subtitle}
        </p>

        {/* State A: Preparing */}
        {status === 'preparing' && (
          <div
            role="progressbar"
            aria-label="Preparing local AI"
            className="w-full bg-[#1b1d1f] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3"
          >
            <div className="w-full bg-[#26292d] rounded-full h-2.5 overflow-hidden">
              <div className="bg-gradient-to-r from-[#009ADA] to-[#0EA5E9] h-full rounded-full w-2/5 animate-pulse" />
            </div>
            <div className="flex justify-between items-center text-xs text-[#909193]">
              <span className="font-mono">Runtime check</span>
              <span>Initializing...</span>
            </div>
          </div>
        )}

        {/* State B: Downloading */}
        {status === 'downloading' && (
          <div
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Downloading local AI"
            className="w-full bg-[#1b1d1f] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3"
          >
            <div className="w-full bg-[#26292d] rounded-full h-2.5 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#009ADA] to-[#0EA5E9] h-full rounded-full transition-all duration-200 ease-out"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
            <div className="flex justify-between items-center pt-0.5 text-xs">
              <span className="text-white font-semibold font-mono text-sm">
                {clampedProgress}%
              </span>
              <span className="text-[#909193] font-mono">
                {totalBytes > 0
                  ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
                  : `${formatBytes(downloadedBytes)} downloaded`}
              </span>
            </div>
          </div>
        )}

        {/* State C: Verifying */}
        {status === 'verifying' && (
          <div
            role="progressbar"
            aria-label="Verifying local AI"
            className="w-full bg-[#1b1d1f] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3"
          >
            <div className="w-full bg-[#26292d] rounded-full h-2.5 overflow-hidden p-0.5">
              <div className="bg-gradient-to-r from-[#009ADA] to-amber-400 h-full rounded-full w-full animate-pulse" />
            </div>
            <div className="flex justify-between items-center pt-0.5 text-xs text-[#909193]">
              <span className="font-mono text-amber-400">Integrity check</span>
              <span>Checking model files...</span>
            </div>
          </div>
        )}

        {/* State D: Ready */}
        {status === 'ready' && (
          <div
            role="status"
            aria-label="Local AI ready"
            className="w-full bg-[#1b1d1f] border border-emerald-500/25 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2"
          >
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium">
              <MdCheckCircleOutline className="h-5 w-5" />
              <span>Ready</span>
            </div>
          </div>
        )}

        {/* State E: Error */}
        {status === 'error' && (
          <div className="w-full bg-[#1b1d1f] border border-rose-500/25 rounded-2xl p-4 sm:p-5 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
                <MdErrorOutline className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="text-white text-xs font-semibold">Error Details</h4>
                <p className="text-xs text-rose-300/90 leading-relaxed break-words [overflow-wrap:anywhere]">
                  {error || 'Unable to complete local model setup. Please check storage and network connection.'}
                </p>
              </div>
            </div>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label="Retry local AI setup"
                className="w-full flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#0284c7] active:scale-[0.99] text-white font-medium py-3 px-4 rounded-xl transition-all shadow-md shadow-cyan-950/40 text-sm cursor-pointer"
              >
                <FaArrowRotateRight className="h-4 w-4" />
                <span>Retry Setup</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Trust Badge Footer */}
      <footer className="relative z-10 w-full max-w-sm mx-auto">
        <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#1b1d1f]/80 border border-white/8 text-left">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-[#0EA5E9]/10 text-[#0EA5E9] shrink-0">
              <FaShieldHalved className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white text-xs font-medium tracking-wide">
                Local processing
              </h3>
              <p className="text-[#909193] text-[11px] leading-tight truncate">
                On-device intelligence & data
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono shrink-0 ml-2">
            100% Offline
          </span>
        </div>
      </footer>
    </div>
  );
};

export default ModelSetupScreen;

