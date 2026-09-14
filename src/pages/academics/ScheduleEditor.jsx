import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser, useStore } from '@/lib/store'
import { ChevronLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ScheduleEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useCurrentUser();
  const changeUserData = useStore((s) => s.changeUserData);
  const scheduleData = location.state?.scheduleData;
  const showTitle = user ? user.showPageTitles !== false : true;

  const [name, setName] = React.useState(scheduleData?.name || '');
  const [periods, setPeriods] = React.useState(
    scheduleData?.periods?.map((p) => ({ ...p })) || [
      { name: '', startTime: '', endTime: '' }
    ]
  );

  const handleAddPeriod = () => {
    setPeriods([...periods, { name: '', startTime: '', endTime: '' }]);
  };

  const handlePeriodChange = (index, field, value) => {
    const newPeriods = [...periods];
    newPeriods[index] = { ...newPeriods[index], [field]: value };
    setPeriods(newPeriods);
  };

  const handleDeletePeriod = (index) => {
    setPeriods(periods.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const scheduleName = name.trim();
    if (!scheduleName) {
      toast('Give the bell schedule a name first');
      return;
    }
    const cleaned = periods
      .filter((p) => p.name.trim() || p.startTime || p.endTime)
      .map((p, i) => ({ ...p, name: p.name.trim() || `Period ${i + 1}` }));

    const schedules = [...(user?.bellSchedules || [])];
    // Editing an existing schedule replaces it (even if renamed); a new name appends.
    const originalName = scheduleData?.name;
    const idx = schedules.findIndex((s) => s.name === (originalName ?? scheduleName));
    const saved = { name: scheduleName, periods: cleaned };
    if (idx >= 0) schedules[idx] = saved;
    else schedules.push(saved);

    changeUserData('bellSchedules', schedules);
    toast(`Saved "${scheduleName}"`);
    navigate(-1);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className='flex items-center gap-3 p-4 border-b bg-card'>
        <Button
          variant="ghost"
          size="sm"
          className='h-8 w-8 p-0'
          onClick={() => navigate(-1)}
        >
          <ChevronLeft size={20} />
        </Button>
        {showTitle ? (
          <h1 className='text-2xl font-bold'>
            {scheduleData?.name ? 'Edit Bell Schedule' : 'New Bell Schedule'}
          </h1>
        ) : null}
        <Input
          placeholder='Schedule name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          className='h-9 max-w-xs flex-1 ml-auto'
        />
        <Button onClick={handleSave}>
          Save
        </Button>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='bg-card rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period Name</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      placeholder={`Period ${index + 1}`}
                      value={period.name}
                      onChange={(e) => handlePeriodChange(index, 'name', e.target.value)}
                      className='h-9'
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder='7:25 AM'
                      value={period.startTime}
                      onChange={(e) => handlePeriodChange(index, 'startTime', e.target.value)}
                      className='h-9'
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder='8:05 AM'
                      value={period.endTime}
                      onChange={(e) => handlePeriodChange(index, 'endTime', e.target.value)}
                      className='h-9'
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className='h-9 w-9 p-0 text-destructive'
                      onClick={() => handleDeletePeriod(index)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className='mt-6'>
          <Button variant="outline" className='w-full' onClick={handleAddPeriod}>
            Add Period
          </Button>
        </div>
      </div>
    </div>
  )
}
