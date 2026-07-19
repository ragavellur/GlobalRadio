import { useRadioStore } from '../lib/store';

export default function LoadingIndicator() {
  const { indexLoaded } = useRadioStore();
  if (indexLoaded) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50" style={{ background: '#2b2b2b' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#00C864', borderTopColor: 'transparent' }}></div>
        <p className="text-white/60 text-sm">Loading radio stations...</p>
      </div>
    </div>
  );
}
