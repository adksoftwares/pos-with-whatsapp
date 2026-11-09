import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Shifts = () => {
  const [shift, setShift] = useState<any>(null);
  const [float, setFloat] = useState('0');
  const [closing, setClosing] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setShift((await apiClient.get('/shifts/current')).data);
    } catch {
      setShift(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const open = async () => {
    try {
      await apiClient.post('/shifts/open', { openingCash: Number(float) });
      toast.success('Shift opened');
      load();
    } catch (x: any) {
      toast.error(x.message || 'Open failed');
    }
  };

  const close = async () => {
    try {
      await apiClient.post('/shifts/' + shift.id + '/close', { closingCash: Number(closing) });
      toast.success('Shift closed');
      setShift(null);
    } catch (x: any) {
      toast.error(x.message || 'Close failed');
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cashier Shift</h1>
        <p className="text-sm text-gray-500">Opening float and end-of-shift cash reconciliation</p>
      </div>
      <Card>
        <CardContent className="p-5 space-y-4">
          {loading ? (
            'Loading…'
          ) : shift ? (
            <>
              <p className="font-semibold text-emerald-700">
                Shift open since {new Date(shift.openedAt).toLocaleString('en-LK')}
              </p>
              <p>Opening float: LKR {Number(shift.openingCash).toLocaleString('en-LK')}</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                placeholder="Counted closing cash (LKR)"
              />
              <Button onClick={close} disabled={!closing}>
                Close shift
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm">No active shift. Enter the cash float before starting sales.</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={float}
                onChange={(e) => setFloat(e.target.value)}
                placeholder="Opening cash (LKR)"
              />
              <Button onClick={open}>Open shift</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
