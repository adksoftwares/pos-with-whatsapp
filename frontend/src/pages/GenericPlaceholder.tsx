import { Card, CardContent } from '../components/ui/Card';

export const GenericPlaceholder = ({ title, description }: { title: string, description: string }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
        <p className="text-gray-500 text-sm mt-1">{description}</p>
      </div>

      <Card className="min-h-[400px] flex items-center justify-center border-dashed">
        <CardContent className="flex flex-col items-center text-center p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title} Module</h3>
          <p className="text-gray-500 max-w-sm">
            This module will be implemented in a future phase. The architecture is ready to support it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
