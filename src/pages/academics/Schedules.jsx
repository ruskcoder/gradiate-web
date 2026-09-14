import React, { useCallback, useState, useEffect } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import ListItem, { ListItemsList } from '@/components/custom/list-item';
import { getSchedule } from '@/lib/grades-api';
import { useStore } from '@/lib/store';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { School, ChevronLeft, Plus, Pen, Trash2, Save } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from '@/components/ui/input';
import { CRHS_BELL_SCHEDULES } from '@/lib/bell-schedules';

export default function Schedules() {
  const navigate = useNavigate();
  const { users, currentUserIndex, changeUserData } = useStore();
  const currentUser = users[currentUserIndex];

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState([]);
  const [selectedBellSchedule, setSelectedBellSchedule] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editingPeriods, setEditingPeriods] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [scheduleName, setScheduleName] = useState('');

  const bellSchedules = currentUser?.bellSchedules || [];

  const setBellSchedules = (schedules) => {
    if (currentUser) {
      changeUserData('bellSchedules', schedules);
    }
  };

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);


      const data = await getSchedule(); 
      if (data.success && data.schedule) {
        setSchedule(data.schedule);
      }

    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, bellSchedules.length]);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const handleAddPeriod = () => {
    setEditingPeriods([...editingPeriods, { name: '', startTime: '', endTime: '' }]);
  };

  const handlePeriodChange = (index, field, value) => {
    const newPeriods = [...editingPeriods];
    newPeriods[index][field] = value;
    setEditingPeriods(newPeriods);
  };

  const handleDeletePeriod = (index) => {
    const newPeriods = editingPeriods.filter((_, i) => i !== index);
    setEditingPeriods(newPeriods);
  };

  const convertTo24Hour = (time12) => {
    if (!time12) return '';
    const [time, ampm] = time12.split(' ');
    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours);
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minutes}`;
  };

  const handleSaveSchedule = () => {
    const periodsWithNames = editingPeriods.map((period, index) => ({
      ...period,
      name: period.name.trim() || `Period ${index + 1}`
    }));

    if (editingSchedule !== null && editingSchedule !== undefined) {
      const newSchedules = [...bellSchedules];
      newSchedules[editingSchedule] = {
        ...bellSchedules[editingSchedule],
        periods: periodsWithNames
      };
      setBellSchedules(newSchedules);
    } else {
      if (scheduleName.trim()) {
        setBellSchedules([...bellSchedules, { name: scheduleName, periods: periodsWithNames }]);
      }
    }
    setEditingSchedule(null);
    setEditingPeriods([]);
    setScheduleName('');
  };

  const handleDeleteSchedule = () => {
    if (scheduleToDelete !== null) {
      const newSchedules = bellSchedules.filter((_, idx) => idx !== scheduleToDelete);
      setBellSchedules(newSchedules);
      setSelectedBellSchedule(null);
      setEditingSchedule(null);
      setShowDeleteDialog(false);
      setScheduleToDelete(null);
    }
  };

  const handleStartEdit = (idx) => {
    setEditingSchedule(idx);
    setScheduleName(bellSchedules[idx].name);
    const periodsWithConvertedTimes = bellSchedules[idx].periods.map(period => ({
      ...period,
      startTime: convertTo24Hour(period.startTime) || period.startTime,
      endTime: convertTo24Hour(period.endTime) || period.endTime
    }));
    setEditingPeriods(periodsWithConvertedTimes);
  };

  const handleStartNew = () => {
    setEditingSchedule(undefined);
    setEditingPeriods([{ name: '', startTime: '', endTime: '' }]);
    setScheduleName('');
  };

  const showTitle = currentUser ? currentUser.showPageTitles !== false : true;

  return (
    <div className="space-y-8 flex flex-col" style={{ height: "calc(calc((100vh - var(--spacing)*20)) - 2px)" }}>
      {showTitle && <h1 className="text-4xl font-bold">Schedule</h1>}
      <ResizablePanelGroup direction="horizontal" className='space-x-2'>
        <ResizablePanel className={`relative bg-card rounded-xl min-w-[325px] border flex flex-col overflow-hidden ${loading ? '' : ''}`} defaultSize={50} disabled={editingSchedule !== null}>
          <div className='flex items-center justify-between py-2 px-4 border-b'>
            <div className='text-center text-sm font-medium text-muted-foreground flex-1 py-1'>
              Class Schedule
            </div>
          </div>
          <div className={`flex-1 p-6 flex flex-col gap-2 overflow-y-auto ${loading ? '' : ''}`}>
            {loading && (
              <div className='absolute inset-0 bg-background/85 flex justify-center z-50'>
                <Spinner className='mt-20 size-8' />
              </div>
            )}
            <ListItemsList>
              {schedule.map((course, idx) => (
                <ListItem
                  key={idx}
                  squareColor="var(--primary)"
                  squareText={course.Periods}
                  Title={course.Description}
                  Desc={course.Course}
                  popoverContent={
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">{course.Description}</h4>
                        <p className="text-sm text-muted-foreground">
                          Course details
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Course:</span>
                          <span className="text-sm">{course.Course}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Period:</span>
                          <span className="text-sm">{course.Periods}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Teacher:</span>
                          <span className="text-sm">{course.Teacher}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Room:</span>
                          <span className="text-sm">{course.Room}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Days:</span>
                          <span className="text-sm">{course.Days}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Building:</span>
                          <span className="text-sm">{course.Building}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Marking Periods:</span>
                          <span className="text-sm">{course["Marking Periods"]}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center gap-4">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge className={`px-2 py-0 ${course.Status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}>
                            {course.Status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  }
                />
              ))}
            </ListItemsList>
          </div>
        </ResizablePanel>
        <ResizableHandle className="bg-border hover:bg-accent/50" />
        <ResizablePanel className='bg-card rounded-xl border flex flex-col min-w-[325px] overflow-hidden' defaultSize={50} disabled={editingSchedule !== null || editingSchedule === undefined && editingSchedule !== null}>
          {editingSchedule !== null ? (
            <>
              <div className='flex items-center gap-2 p-2 border-b'>
                <Button
                  size="sm"
                  variant="outline"
                  className='h-8 w-8 p-0'
                  onClick={() => {
                    setEditingSchedule(null);
                    setEditingPeriods([]);
                    setScheduleName('');
                  }}
                >
                  <ChevronLeft size={18} />
                </Button>
                <Input
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  placeholder="Enter name..."
                  className='flex-1 h-8 text-center text-sm'
                />
                <Button
                  onClick={handleSaveSchedule}
                  size="sm"
                  variant="outline"
                  className='h-8 w-8 p-0'
                >
                  <Save size={18} />
                </Button>
                {editingSchedule !== undefined && editingSchedule !== null && (
                  <Button
                    size="sm"
                    variant="outline"
                    className='h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100'
                    onClick={() => {
                      setScheduleToDelete(editingSchedule);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 size={18} />
                  </Button>
                )}
              </div>
              <div className='flex-1 overflow-auto p-4'>
                <div className='bg-card rounded-lg border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-2">Period Name</TableHead>
                        <TableHead className="pl-0">Start Time</TableHead>
                        <TableHead className="pl-0">End Time</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editingPeriods.map((period, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              placeholder={`Period ${index + 1}`}
                              value={period.name}
                              onChange={(e) => handlePeriodChange(index, 'name', e.target.value)}
                              className='h-9'
                            />
                          </TableCell>
                          <TableCell className='pl-0'>
                            <Input
                              type="time"
                              value={period.startTime}
                              onChange={(e) => handlePeriodChange(index, 'startTime', e.target.value)}
                              className='h-9'
                            />
                          </TableCell>
                          <TableCell className='pl-0'>
                            <Input
                              type="time"
                              value={period.endTime}
                              onChange={(e) => handlePeriodChange(index, 'endTime', e.target.value)}
                              className='h-9'
                            />
                          </TableCell>
                          <TableCell className='pl-0'>
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

                <div className='mt-2'>
                  <Button variant="outline" className='w-full' onClick={handleAddPeriod}>
                    Add Period
                  </Button>
                </div>
              </div>
            </>
          ) : selectedBellSchedule === null ? (
            <>
              <div className='flex items-center justify-between p-2 border-b'>
                <div className="w-8"></div>
                <div className='text-sm font-medium text-muted-foreground flex-1 text-center py-1'>
                  Bell Schedule
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className='h-8 w-8 p-0'
                  onClick={handleStartNew}
                >
                  <Plus size={18} />
                </Button>
              </div>
              <div className='flex-1 p-6 flex flex-col gap-4 overflow-y-auto'>
                <ListItemsList>
                  {bellSchedules.map((schedule, idx) => (
                    <ListItem
                      key={idx}
                      squareColor="var(--primary)"
                      squareText={<School size={24} />}
                      Title={schedule.name}
                      Desc={`${schedule.periods.length} periods`}
                      onClick={() => setSelectedBellSchedule(idx)}
                    />
                  ))}
                </ListItemsList>
                {bellSchedules.length === 0 && (
                  <div className='flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground'>
                    No bell schedules yet.
                    <Button size="sm" variant="outline" onClick={() => setBellSchedules(CRHS_BELL_SCHEDULES)}>
                      Load Cinco Ranch HS 2026–27 schedules
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className='flex items-center gap-2 p-2 border-b'>
                <Button
                  size="sm"
                  variant="outline"
                  className='h-8 w-8 p-0'
                  onClick={() => setSelectedBellSchedule(null)}
                >
                  <ChevronLeft size={18} />
                </Button>
                <span className='flex-1 text-sm font-medium text-muted-foreground text-center py-1'>{bellSchedules[selectedBellSchedule].name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className='h-8 w-8 p-0'
                  onClick={() => handleStartEdit(selectedBellSchedule)}
                >
                  <Pen size={18} />
                </Button>
              </div>
              <div className='flex-1 p-6 overflow-y-auto'>
                <div className='space-y-2'>
                  {bellSchedules[selectedBellSchedule].periods.map((period, idx) => (
                    <div key={idx} className='p-3 rounded-md border bg-muted/50'>
                      <div className='font-medium'>{period.name}</div>
                      <div className='text-sm text-muted-foreground'>{period.startTime} - {period.endTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{scheduleToDelete !== null && bellSchedules[scheduleToDelete]?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchedule}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
