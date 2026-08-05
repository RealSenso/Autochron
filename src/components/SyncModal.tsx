import React, { useState } from 'react';
import {
  X,
  Cloud,
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Copy,
  PlusCircle,
  LogOut,
  ArrowRightLeft,
} from 'lucide-react';
import {
  saveScheduleBySyncCode,
  fetchScheduleBySyncCode,
} from '../lib/firebase';
import { UserScheduleData } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocalData: UserScheduleData;
  onCloudDataFetched: (cloudData: UserScheduleData) => void;
  syncCode: string | null;
  onSyncCodeChange: (code: string | null) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  currentLocalData,
  onCloudDataFetched,
  syncCode,
  onSyncCodeChange,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateNewSyncCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Readable letters & numbers
    let code1 = '';
    let code2 = '';
    for (let i = 0; i < 4; i++) {
      code1 += chars.charAt(Math.floor(Math.random() * chars.length));
      code2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CHRONO-${code1}-${code2}`;
  };

  const handleCreateNewSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const newCode = generateNewSyncCode();
      await saveScheduleBySyncCode(newCode, currentLocalData);
      onSyncCodeChange(newCode);
      setSuccess(`Successfully generated Sync Code: ${newCode}. Your schedule is now backed up to the cloud!`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate sync code.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Normalize input: make uppercase, strip leading/trailing spaces, replace multiple spaces
    let rawInput = inputCode.trim().toUpperCase().replace(/\s+/g, '');

    let formattedCode = rawInput;

    // Help with different user formats for maximum resilience on mobile devices:
    if (rawInput.startsWith('CHRONO-')) {
      // It's already mostly structured, just ensure it has correct dashes
      const content = rawInput.substring(7).replace(/-/g, '');
      if (content.length === 8) {
        formattedCode = `CHRONO-${content.slice(0, 4)}-${content.slice(4)}`;
      }
    } else {
      // User omitted the "CHRONO-" prefix
      const stripped = rawInput.replace(/-/g, '');
      if (stripped.length === 8) {
        // e.g. "ABCD-EFGH" or "ABCDEFGH"
        formattedCode = `CHRONO-${stripped.slice(0, 4)}-${stripped.slice(4)}`;
      } else if (rawInput.startsWith('CHRONO') && rawInput.length === 14) {
        // e.g. "CHRONOABCDEFGH"
        const content = rawInput.substring(6);
        formattedCode = `CHRONO-${content.slice(0, 4)}-${content.slice(4)}`;
      }
    }

    try {
      // Fetch cloud schedule for this code
      const cloudData = await fetchScheduleBySyncCode(formattedCode);
      if (cloudData) {
        onCloudDataFetched(cloudData);
        onSyncCodeChange(formattedCode);
        setSuccess(`Connected successfully! Synced and downloaded schedule for code ${formattedCode}.`);
        setInputCode('');
      } else {
        setError(`Sync Code "${formattedCode}" was not found. Please make sure you have generated the code on your other device first, or check for typos.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    onSyncCodeChange(null);
    setSuccess('Disconnected safely. Your changes will now only be saved locally.');
    setError(null);
  };

  const handleCopyToClipboard = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-stone-100 flex flex-col animate-scale-in">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-vela-600" />
            <h2 className="font-display font-semibold text-lg text-stone-800">Device Sync</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-200/80 rounded-lg text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-5">
          {/* Explanation Banner */}
          <div className="p-3.5 bg-stone-50 border border-stone-100 rounded-lg text-xs text-stone-600 space-y-1.5">
            <div className="font-semibold text-stone-700 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-vela-500" />
              No account needed
            </div>
            <p>
              A sync code is all it takes — no email, no password. Generate one here, then enter it on your phone, tablet, or any other device to keep your schedule mirrored in real time.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {syncCode ? (
            /* Active Sync View */
            <div className="space-y-5">
              <div className="bg-vela-50/50 border border-vela-100/60 rounded-xl p-4 text-center space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-vela-600">Active Sync Code</div>
                <div className="font-mono text-2xl font-black text-stone-800 tracking-wider bg-white py-2 px-3 rounded-lg border border-vela-100 inline-block shadow-xs">
                  {syncCode}
                </div>
                
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleCopyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
              </div>

              <div className="text-xs text-stone-500 text-center">
                Your schedule, sleep plans, tasks, and ML habit models are syncing bidirectionally across all devices connected to this code!
              </div>

              <div className="border-t border-stone-100 pt-4 flex justify-end">
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 hover:border-red-200 hover:bg-red-50 text-stone-600 hover:text-red-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect Code
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected View - Option to create or enter code */
            <div className="space-y-6">
              {/* Option 1: Create New Cloud Slot */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Option 1: Backup & Create Sync Code</h3>
                <p className="text-xs text-stone-500">
                  Generate a unique cloud-backed synchronization code for your current layout and start linking other screens.
                </p>
                <button
                  onClick={handleCreateNewSync}
                  disabled={loading}
                  className="w-full py-2.5 bg-vela-600 hover:bg-vela-700 disabled:bg-vela-300 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlusCircle className="w-4 h-4" />
                  )}
                  Generate Sync Code
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-100"></div>
                <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-wider text-stone-400">OR</span>
                <div className="flex-grow border-t border-stone-100"></div>
              </div>

              {/* Option 2: Connect Existing Sync Code */}
              <form onSubmit={handleConnectExisting} className="space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Option 2: Connect Existing Device Code</h3>
                  <p className="text-xs text-stone-500">
                    Enter the code displayed on your other device to connect and download that schedule.
                  </p>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    required
                    placeholder="CHRONO-XXXX-XXXX"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-stone-200 focus:border-vela-500 focus:ring-1 focus:ring-vela-500 rounded-lg text-sm bg-white placeholder-stone-400 text-stone-800 font-mono tracking-wider focus:outline-none uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !inputCode.trim()}
                  className="w-full py-2.5 bg-stone-800 hover:bg-stone-950 disabled:bg-stone-300 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  Connect & Sync
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
