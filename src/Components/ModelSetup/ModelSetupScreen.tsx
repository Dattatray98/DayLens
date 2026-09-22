import React from 'react';
import { SiGoogleassistant } from 'react-icons/si';
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
  return `${Math.round(mb)} MB`;
}

const statusConfig: Record<ModelSetupStatus, { label: string; description: string }> = {
  preparing: {
    label: 'Preparing your AI assistant',
    description: 'Initializing local runtime...',
  },
  downloading: {
    label: 'Preparing your AI assistant',
    description: 'Downloading local AI model...',
  },
  verifying: {
    label: 'Preparing your AI assistant',
    description: 'Verifying model integrity...',
  },
  ready: {
    label: 'AI Assistant Ready',
    description: 'Model verified. Launching...',
  },
  error: {
    label: 'Setup Interrupted',
    description: 'Unable to complete model download.',
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
    <div className="min-h-screen bg-black text-white flex flex-col justify-between px-6 py-8 relative overflow-hidden select-none">
      {/* Background ambient glow matching existing Home.tsx aesthetic */}
      <div className="bg-[#009ADA] blur-[140px] absolute -top-16 -right-16 h-64 w-64 opacity-30 pointer-events-none" />
      <div className="bg-[#3B82F6] blur-[150px] absolute -bottom-16 -left-16 h-64 w-64 opacity-20 pointer-events-none" />

      {/* Top Header / Branding */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0EA5E9]" />
          <h1 className="text-base font-semibold tracking-wide text-[#DFE2ED]">
            wellNess Voice
          </h1>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#909193] font-medium">
          Offline AI
        </span>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-col items-center text-center my-auto py-8">
        {/* Animated/Glowing Emblem */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-[#0EA5E9]/20 blur-xl pointer-events-none" />
          <div className="relative h-24 w-24 rounded-3xl bg-[#1b1d1f] border border-white/12 flex items-center justify-center shadow-xl shadow-cyan-950/40">
            {status === 'error' ? (
              <MdErrorOutline className="h-12 w-12 text-rose-500" />
            ) : status === 'ready' ? (
              <MdCheckCircleOutline className="h-12 w-12 text-emerald-400" />
            ) : (
              <SiGoogleassistant className="h-12 w-12 text-[#0EA5E9]" />
            )}
          </div>
        </div>

        {/* Status Title & Subtitle */}
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">
          {currentConfig.label}
        </h2>
        <p className="text-sm text-[#909193] max-w-xs leading-relaxed mb-8">
          {status === 'error' && error ? error : currentConfig.description}
        </p>

        {/* Progress Display Card */}
        {status !== 'error' && (
          <div className="w-full max-w-sm bg-[#1b1d1f] border border-white/10 rounded-2xl p-5 shadow-lg space-y-3">
            {/* Real Progress Bar */}
            <div className="w-full bg-[#26292d] rounded-full h-3 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#009ADA] to-[#0EA5E9] h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>

            {/* Metrics: Percentage & Byte count */}
            <div className="flex justify-between items-center pt-1 text-sm">
              <span className="text-white font-semibold text-base">
                {clampedProgress}%
              </span>
              <span className="text-[#909193] text-xs font-mono">
                {totalBytes > 0
                  ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
                  : status === 'verifying'
                  ? 'Verifying...'
                  : 'Preparing...'}
              </span>
            </div>
          </div>
        )}

        {/* Error State: Retry Action */}
        {status === 'error' && (
          <div className="w-full max-w-sm bg-[#1b1d1f] border border-rose-500/20 rounded-2xl p-5 space-y-4">
            <p className="text-xs text-rose-400/90 leading-normal">
              {error || 'The download could not be completed. Please check your connection and try again.'}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#0284c7] active:scale-[0.99] text-white font-medium py-3 px-4 rounded-xl transition-all shadow-md shadow-cyan-900/30 text-sm"
              >
                <FaArrowRotateRight className="h-4 w-4" />
                <span>Retry Download</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Trust Badge Footer */}
      <footer className="relative z-10 w-full max-w-sm mx-auto">
        <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#1b1d1f]/80 border border-white/8 text-left">
          <div className="p-2 rounded-xl bg-[#0EA5E9]/10 text-[#0EA5E9] shrink-0 mt-0.5">
            <FaShieldHalved className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-white text-xs font-semibold tracking-wide">
              One-time setup
            </h3>
            <p className="text-[#909193] text-xs leading-relaxed">
              The AI model stays on your device. All inference runs 100% offline with zero external data sharing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ModelSetupScreen;

