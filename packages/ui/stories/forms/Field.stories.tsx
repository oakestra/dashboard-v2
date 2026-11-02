import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  Input,
  Label,
  Switch,
} from '../../src';

const meta = {
  title: 'Forms/Field',
  component: Field,
  parameters: {
    docs: {
      description: {
        component:
          'Layout primitives for forms. Pages use them with React Hook Form and `zodResolver`; `FieldError` takes the `errors` of a field state directly.',
      },
    },
  },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal', 'responsive'] },
  },
  decorators: [
    (Story) => (
      <div className="w-96 max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <FieldLabel htmlFor="app-name">Application name</FieldLabel>
      <Input id="app-name" placeholder="my-application" />
      <FieldDescription>Lowercase letters, digits and dashes.</FieldDescription>
    </Field>
  ),
};

export const WithError: Story = {
  render: (args) => (
    <Field {...args} data-invalid>
      <FieldLabel htmlFor="namespace">Namespace</FieldLabel>
      <Input id="namespace" defaultValue="Default Namespace" aria-invalid />
      <FieldError errors={[{ message: 'Use at most 30 lowercase letters and digits.' }]} />
    </Field>
  ),
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  render: (args) => (
    <Field {...args}>
      <Checkbox id="terms" />
      <FieldLabel htmlFor="terms">Delete all services of this application</FieldLabel>
    </Field>
  ),
};

export const Form: Story = {
  render: () => (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <FieldSet>
        <FieldLegend>Account</FieldLegend>
        <FieldDescription>Shown to other members of your organization.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input id="username" defaultValue="alice" />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" defaultValue="alice@example.com" />
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Notifications</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="notify-failures">Service failures</FieldLabel>
              <FieldDescription>Email me when an instance of my services fails.</FieldDescription>
            </FieldContent>
            <Switch id="notify-failures" defaultChecked />
          </Field>
        </FieldGroup>
      </FieldSet>
      <Button type="submit">Save</Button>
    </form>
  ),
};

export const PlainLabel: Story = {
  name: 'Label',
  render: () => (
    <div className="grid gap-2">
      <Label htmlFor="plain">Cluster name</Label>
      <Input id="plain" placeholder="edge-01" />
    </div>
  ),
};
