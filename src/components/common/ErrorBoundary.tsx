// @ts-nocheck
import { Component, ReactNode, ErrorInfo } from 'react';
import { isChunkLoadError, recoverFromStaleCache } from '../../lib/lazyWithRetry';

interface Props { children: ReactNode; fallbackTitle?: string; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  handleReset = async () => {
    // chunk লোডের ভুল (পুরোনো PWA ক্যাশে পুরোনো chunk) হলে ক্যাশ পরিষ্কার করে
    // রিলোড — সাধারণ রিলোডে একই পুরোনো ক্যাশ আবার আসতে পারে।
    if (isChunkLoadError(this.state.error)) {
      await recoverFromStaleCache();
    }
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      const chunkErr = isChunkLoadError(this.state.error);
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center text-xl">!</div>
            <h2 className="mt-3 text-lg font-black text-slate-900">{this.props.fallbackTitle || 'কিছু ভুল হয়েছে'}</h2>
            <p className="mt-1 text-[15px] text-slate-600 leading-relaxed">
              {chunkErr
                ? 'অ্যাপের নতুন ভার্সন লোড হতে পারেনি (পুরোনো ক্যাশ)। নিচের বোতামে চাপ দিলে নতুন করে লোড হবে।'
                : 'অ্যাপে একটি ত্রুটি ঘটেছে। রিফ্রেশ করে আবার চেষ্টা করুন।'}
              <br />
              <span className="font-mono text-[11px] text-red-700 break-all">{this.state.error?.message}</span>
            </p>
            <div className="mt-4 flex flex-col gap-2 items-center">
              <button
                onClick={this.handleReset}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#065f46] text-white text-[15px] font-bold active:scale-95 transition"
              >
                ↺ {chunkErr ? 'নতুন করে লোড করুন' : 'রিলোড'}
              </button>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 text-[15px] font-bold text-slate-700"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
