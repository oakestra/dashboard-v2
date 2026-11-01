import type { Meta, StoryObj } from '@storybook/react-vite';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../src';

const ITEMS = [
  {
    value: 'sla',
    title: 'What is an SLA?',
    body: 'The deployment descriptor of an application: its services, their images, resources and constraints.',
  },
  {
    value: 'cluster',
    title: 'How is a cluster chosen?',
    body: 'The root scheduler picks a cluster that satisfies the constraints, then the cluster scheduler picks a worker.',
  },
  {
    value: 'addons',
    title: 'Where do addons come from?',
    body: 'From the marketplace. Installed addons with a UI show up in the navigation.',
  },
];

const meta = {
  title: 'Data display/Accordion',
  component: Accordion,
  args: { type: 'single', collapsible: true, defaultValue: 'sla' },
  argTypes: { type: { control: 'inline-radio', options: ['single', 'multiple'] } },
  render: (args) => (
    <Accordion {...args} className="w-96 max-w-[calc(100vw-2rem)]">
      {ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>{item.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const Multiple: Story = {
  args: { type: 'multiple', defaultValue: ['sla', 'addons'] },
};
