import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useStore } from '@/lib/store';
import { CommandPalette } from '@/components/custom/command-palette';
import { useBackgroundRefresh } from '@/hooks/use-background-refresh';

export default function MainLayout({ children }) {
  const currentUserIndex = useStore((state) => state.currentUserIndex);
  const users = useStore((state) => state.users);
  useBackgroundRefresh();

  const notLogged = (currentUserIndex == -1 || users.length == 0);

  return (
    <>
      {notLogged && <div>You must be logged in to access this. </div>}
      {!notLogged && <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="p-8 h-full">
            <SidebarTrigger className="-ml-1 md:hidden" />
            {children}
          </div>
        </SidebarInset>
        <CommandPalette />
      </SidebarProvider>}
    </>
  );
}
