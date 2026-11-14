// @ts-nocheck
import { Component, ReactNode, ErrorInfo } from 'react';

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
  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center text-xl">!</div>
            <h2 className="mt-3 text-base font-black text-slate-900">{this.props.fallbackTitle || 'কিছু ভুল হয়েছে'}</h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              অ্যাপে একটি ত্রুটি ঘটেছে। রিফ্রেশ করে আবার চেষ্টা করুন।<br/>
              <span className="font-mono text-[11px] text-red-700 break-all">{this.state.error?.message}</span>
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <button onClick={this.handleReset} className="px-4 py-2 rounded-xl bg-emerald-900 text-white text-xs font-bold">↺ রিলোড</button>
              <button onClick={()=> this.setState({hasError:false})} className="px-4 py-2 rounded-xl border border-slate-200 text-xs">বন্ধ করুন</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
