import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AppWindowIcon,
  BlocksIcon,
  BuildingIcon,
  ChevronRightIcon,
  LayoutDashboardIcon,
  PlusIcon,
  PuzzleIcon,
  ServerIcon,
  StoreIcon,
  UsersIcon,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  PageHeader,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../../src';

const MAIN = [
  { label: 'Overview', icon: LayoutDashboardIcon, active: true },
  { label: 'Applications', icon: AppWindowIcon, badge: 8 },
  { label: 'Infrastructure', icon: ServerIcon },
];

const MANAGEMENT = [
  { label: 'Users', icon: UsersIcon },
  { label: 'Organizations', icon: BuildingIcon },
];

type Args = React.ComponentProps<typeof Sidebar>;

function DashboardSidebar(props: Args) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BlocksIcon className="size-4" />
              </div>
              <div className="grid text-left leading-tight">
                <span className="font-semibold">Oakestra</span>
                <span className="text-xs text-muted-foreground">root orchestrator</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupAction aria-label="New application">
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton isActive={item.active} tooltip={item.label}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MANAGEMENT.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton tooltip={item.label}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <Collapsible asChild defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Addons">
                      <PuzzleIcon />
                      <span>Addons</span>
                      <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#installed">Installed</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#marketplace">
                          <StoreIcon />
                          Marketplace
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Addons</SidebarGroupLabel>
          <SidebarGroupContent>
            {/* What the addons group shows while /ui-addons is loading. */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar size="sm">
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              <span>Admin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

const meta = {
  title: 'Navigation/Sidebar',
  component: Sidebar,
  args: { collapsible: 'icon', variant: 'sidebar', side: 'left' },
  argTypes: {
    collapsible: { control: 'inline-radio', options: ['offcanvas', 'icon', 'none'] },
    variant: { control: 'inline-radio', options: ['sidebar', 'floating', 'inset'] },
    side: { control: 'inline-radio', options: ['left', 'right'] },
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => (
    // The sidebar container is position: fixed with h-svh. The transform makes this frame its
    // containing block, so on the docs page it stays inside the preview instead of covering the
    // page. Separate docs iframes would avoid that too, but they do not get the theme global.
    <div className="h-[560px] overflow-hidden [transform:translateZ(0)] [&_[data-slot=sidebar-container]]:h-full">
      <SidebarProvider className="min-h-full">
        <DashboardSidebar {...args} />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4!" />
            <span className="text-sm text-muted-foreground">Press ⌘B to toggle</span>
          </header>
          <div className="p-6">
            <PageHeader title="Overview" description="Clusters, applications and their health." />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  ),
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CollapsibleToIcons: Story = {};

export const Offcanvas: Story = { args: { collapsible: 'offcanvas' } };

export const Inset: Story = { args: { variant: 'inset' } };

export const Floating: Story = { args: { variant: 'floating' } };
