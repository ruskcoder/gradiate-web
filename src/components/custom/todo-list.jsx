import { useState, useMemo, useEffect, useRef } from 'react';
import { useCurrentUser, useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import AddTodoDialog from './add-todo-dialog';

export default function TodoList() {
  const user = useCurrentUser();
  const { toggleTodoComplete, removeTodo } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [animatingTodos, setAnimatingTodos] = useState(new Set());
  // Completion animations are deferred with setTimeout; without this the timers
  // kept firing (and toggling todos) after the list unmounted.
  const completionTimers = useRef(new Set());
  useEffect(
    () => () => {
      completionTimers.current.forEach(clearTimeout);
      completionTimers.current.clear();
    },
    []
  );

  const todos = user?.todos || [];

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) =>
      todo.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todos, searchTerm]);

  const activeTodos = filteredTodos.filter((todo) => !todo.completed);
  const completedTodos = filteredTodos.filter((todo) => todo.completed);

  const groupedTodos = useMemo(() => {
    const groups = {};

    activeTodos.forEach((todo) => {
      let dateKey;
      if (todo.dueDate) {
        const date = new Date(todo.dueDate);
        dateKey = date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      } else {
        dateKey = 'No Date';
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(todo);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'No Date') return -1;
      if (b === 'No Date') return 1;
      return new Date(a) - new Date(b);
    });

    const sortedGroups = {};
    sortedKeys.forEach((key) => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [activeTodos]);

  const handleToggleTodo = (id) => {
    const todo = todos.find((t) => t.id === id);
    if (todo && !todo.completed) {
      setAnimatingTodos((prev) => new Set([...prev, id]));
      const timer = setTimeout(() => {
        completionTimers.current.delete(timer);
        toggleTodoComplete(id);
        setAnimatingTodos((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
      completionTimers.current.add(timer);
    } else {
      toggleTodoComplete(id);
    }
  };

  const handleRemoveTodo = (e, id) => {
    // The delete button sits INSIDE a row whose own onClick toggles the todo,
    // so without this the click both removed the todo and re-toggled it.
    e.stopPropagation();
    removeTodo(id);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Todo List</h2>
        <Button
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="gap-2 cursor-pointer"
          variant="outline"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {/* <Input
        placeholder="Search todos..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full h-9"
      /> */}

      <div className="space-y-2">
        {Object.keys(groupedTodos).length === 0 && activeTodos.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No tasks yet!
          </p>
        ) : (
          Object.entries(groupedTodos).map(([date, items], groupIndex) => (
            <div key={date}>
              {date !== 'No Date' && (
                <h3 className="text-xs font-semibold text-muted-foreground mb-1 uppercase">
                  {date}
                </h3>
              )}
              <div className="space-y-1">
                {items.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => handleToggleTodo(todo.id)}
                    className={`flex items-center gap-2 p-2 bg-background rounded hover:bg-accent cursor-pointer overflow-hidden transition-all duration-300 ${animatingTodos.has(todo.id)
                        ? 'opacity-0 max-h-0 py-0 mb-0'
                        : 'opacity-100 max-h-20'
                      }`}
                  >
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => handleToggleTodo(todo.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words">{todo.title}</p>
                      {todo.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          {formatTime(todo.dueDate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {groupIndex < Object.keys(groupedTodos).length - 1 && (
                <div className="h-px bg-border my-2" />
              )}
            </div>
          ))
        )}
      </div>

      {completedTodos.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-8 px-0"
            >
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{
                  transform: completedOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              />
              Completed ({completedTodos.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {completedTodos.map((todo) => (
              <div
                key={todo.id}
                onClick={() => handleToggleTodo(todo.id)}
                className="flex items-center gap-2 p-2 bg-background rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => handleToggleTodo(todo.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-through break-words">
                    {todo.title}
                  </p>
                  {todo.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      {formatTime(todo.dueDate)}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleRemoveTodo(e, todo.id)}
                  className="flex-shrink-0 h-6 w-6 p-0 hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <AddTodoDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
}
