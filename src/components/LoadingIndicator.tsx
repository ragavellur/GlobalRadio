import { useRadioStore } from '../lib/store';

export default function LoadingIndicator() {
  const { indexLoaded } = useRadioStore();

  if (indexLoaded) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-50">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Loading radio stations...</p>
        <p className="text-sm text-gray-600 mt-2">150,935 stations from 12,707 cities</p>
      </div>
    </div>
  );
}
