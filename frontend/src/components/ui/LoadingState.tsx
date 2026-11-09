import { Loader2 } from 'lucide-react';

export const LoadingState = ({ text = "Loading..." }: { text?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[200px]">
      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      <p className="text-sm font-medium text-gray-500">{text}</p>
    </div>
  );
};

export const LoadingOverlay = () => {
  return (
    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
    </div>
  );
};
