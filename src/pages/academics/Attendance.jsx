import React from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import Calendar from '@/components/custom/calendar';
import ListItem, { ListItemsList } from '@/components/custom/list-item';
import { getAttendance } from '@/lib/grades-api';
import { Spinner } from '@/components/ui/spinner';

export default function Attendance() {
  const [loading, setLoading] = React.useState(true);
  const [allEvents, setAllEvents] = React.useState({});
  const [currentMonth, setCurrentMonth] = React.useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear());

  const fetchAttendanceForMonth = React.useCallback(async (month, year) => {
    try {
      setLoading(true);
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const dateString = `${monthNames[month]}-${year}`;
      const data = await getAttendance(dateString);
      
      if (data.success && data.events) {
        setAllEvents((prevEvents) => ({
          ...prevEvents,
          ...data.events
        }));
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMonthChange = React.useCallback((month, year) => {
    setCurrentMonth(month);
    setCurrentYear(year);
    document.querySelector('.panel-right').scrollTo(0, 0);
  }, []);

  React.useEffect(() => {
    fetchAttendanceForMonth(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  const showTitle = true;

  return (
    <div className="space-y-8 flex flex-col" style={{ height: "calc(calc((100vh - var(--spacing)*20)) - 2px)" }}>
      {showTitle && <h1 className="text-4xl font-bold">Attendance</h1>}
      <ResizablePanelGroup direction="horizontal" className='space-x-2'>
        <ResizablePanel className='min-w-[500px]'>
          <Calendar
            initialMonth={currentMonth}
            initialYear={currentYear}
            events={allEvents}
            loading={loading}
            onMonthChange={handleMonthChange}
          />
        </ResizablePanel>
        <ResizableHandle className="bg-border hover:bg-accent/50" />
        <ResizablePanel className={`panel-right bg-card rounded-xl p-6 border flex flex-col gap-2 align-center min-w-[200px] relative min-h-0 ${loading ? '' : '!overflow-y-auto'}`}>
          {loading && (
            <div className='absolute inset-0 bg-background/85 flex items-center justify-center z-50 rounded-xl'>
              <Spinner className='size-8' />
            </div>
          )}
          <ListItemsList>
            {Object.entries(allEvents).map(([dateStr, eventsList]) => {
              const [month, day, year] = dateStr.split('/').map(Number);
              const eventYear = year > 100 ? year : 2000 + year;
              if (month === currentMonth + 1 && eventYear === currentYear) {
                return eventsList.map((event, idx) => {
                  const dateWithoutYear = `${month}/${day}`;
                  const periodsDisplay = event.periods.length > 0 ? ` • ${event.periods.join(', ')}` : '';
                  const desc = `${dateWithoutYear}${periodsDisplay}`;
                  return (
                    <ListItem
                      key={`${dateStr}-${idx}`}
                      squareColor={event.color || 'var(--primary)'}
                      squareText={day}
                      Title={event.event}
                      Desc={desc}
                    />
                  );
                });
              }
              return null;
            })}
          </ListItemsList>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
