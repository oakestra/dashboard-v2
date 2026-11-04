import { useCurrentUser } from '@oakestra/dashboard-sdk';
import {
  Avatar,
  AvatarFallback,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@oakestra/ui';
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon, UserIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useModuleEnabled } from '../../core/modules';
import { useAuthSession } from '../../core/auth/auth-context';
import type { ThemePreference } from '../../core/theme/theme';
import { useTheme } from '../../core/theme/theme-context';

const THEME_OPTIONS: readonly { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
];

export function UserMenu() {
  const user = useCurrentUser();
  const auth = useAuthSession();
  const theme = useTheme();
  const profileEnabled = useModuleEnabled('profile');
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2" data-testid="user-menu">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{user.username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.username}</p>
          <p className="text-muted-foreground truncate text-xs">
            {user.roles.length > 0 ? user.roles.join(', ').replaceAll('_', ' ') : 'No roles'}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileEnabled ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <UserIcon aria-hidden />
                  Profile
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground py-1 text-xs font-normal">
            Theme
          </DropdownMenuLabel>
          {/*
            The segments are menu items rather than toggle buttons: the menu owns keyboard focus
            (arrow keys, Tab is swallowed), so plain buttons in here would be unreachable without
            a mouse. preventDefault keeps the menu open, so the change can be seen right away.
          */}
          <div
            role="group"
            aria-label="Theme"
            className="bg-muted mx-1 mb-1 grid grid-cols-3 gap-0.5 rounded-md p-0.5"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = theme.preference === value;
              return (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem
                      role="menuitemradio"
                      aria-label={label}
                      aria-checked={selected}
                      onSelect={(event) => {
                        event.preventDefault();
                        theme.setPreference(value);
                      }}
                      className={cn(
                        'text-muted-foreground justify-center px-1.5 py-1.5',
                        selected &&
                          'bg-background text-foreground focus:bg-background focus:text-foreground shadow-sm',
                      )}
                    >
                      <Icon aria-hidden />
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => auth.logout('user')} data-testid="logout">
          <LogOutIcon aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
