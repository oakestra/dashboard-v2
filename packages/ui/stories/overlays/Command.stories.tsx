import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AppWindowIcon,
  BoxesIcon,
  LayoutDashboardIcon,
  PlusIcon,
  ServerIcon,
  SettingsIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Kbd } from '../../src';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../../src/command';

function PaletteItems() {
  return (
    <>
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem>
            <LayoutDashboardIcon />
            Overview
          </CommandItem>
          <CommandItem>
            <AppWindowIcon />
            Applications
          </CommandItem>
          <CommandItem>
            <ServerIcon />
            Infrastructure
          </CommandItem>
          <CommandItem>
            <SettingsIcon />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>
            <PlusIcon />
            New application
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <BoxesIcon />
            Deploy service
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}

const meta = {
  title: 'Overlays/Command',
  component: Command,
  parameters: {
    docs: {
      description: {
        component: 'cmdk, imported from the `@oakestra/ui/command` subpath.',
      },
    },
  },
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  render: (args) => (
    <Command {...args} className="w-96 max-w-[calc(100vw-2rem)] rounded-lg border shadow-md">
      <PaletteItems />
    </Command>
  ),
};

export const Dialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          setOpen((value) => !value);
        }
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, []);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open palette
          <Kbd className="ml-2">⌘K</Kbd>
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false}>
          <PaletteItems />
        </CommandDialog>
      </>
    );
  },
};
