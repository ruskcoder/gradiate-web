import {
  Check,
  ChevronsUpDown,
  LogOut,
  UserPlus,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { accountKey, homePath, useCurrentUser, useStore, type User } from '@/lib/store';

function AccountIdentity({ user }: { user: User }) {
  return (
    <>
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarFallback className="rounded-lg bg-sidebar-ring">{user.avatar}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name || user.username}</span>
        <span className="truncate text-xs text-muted-foreground">{user.district || user.username}</span>
      </div>
    </>
  )
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const user = useCurrentUser();
  const users = useStore((s) => s.users);
  const currentUserIndex = useStore((s) => s.currentUserIndex);

  if (!user) return null;

  // Every account change is followed by a full page load, so no page keeps the
  // previous account's grades in component state.
  const switchTo = (index: number) => {
    if (index === currentUserIndex) return;
    useStore.getState().switchUser(index);
    location.href = homePath(useStore.getState().currentUser());
  };

  const logOut = () => {
    useStore.getState().removeUser(currentUserIndex);
    const next = useStore.getState().currentUser();
    location.href = next ? homePath(next) : "/login";
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-ring">{user.avatar}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.username}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Accounts
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {users.map((account, index) => (
                <DropdownMenuItem
                  key={accountKey(account)}
                  className="gap-2 p-2"
                  onSelect={() => switchTo(index)}
                >
                  <AccountIdentity user={account} />
                  {index === currentUserIndex && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { location.href = "/login"; }}>
              <UserPlus />
              Add account
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={logOut}>
              <LogOut />
              {users.length > 1 ? `Log out of ${user.name || user.username}` : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
