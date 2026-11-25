import { useNotify } from '@oakestra/dashboard-sdk';
import {
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  PageHeader,
  SectionCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oakestra/ui';
import { useState } from 'react';

// Admins only: the route declares `roles: ['Admin']`. Saving is a demo, nothing is stored.
export function SettingsPage() {
  const notify = useNotify();
  const [strategy, setStrategy] = useState('FedAvg');
  const [minLearners, setMinLearners] = useState('2');

  return (
    <div className="fl:space-y-5">
      <PageHeader title="Settings" description="Defaults for new federated learning projects." />
      <SectionCard title="Aggregation">
        <form
          className="fl:max-w-md fl:space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            notify.success('Settings saved');
          }}
        >
          <Field>
            <FieldLabel htmlFor="fl-strategy">Aggregation strategy</FieldLabel>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger
                id="fl-strategy"
                aria-label="Aggregation strategy"
                className="fl:w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FedAvg">FedAvg</SelectItem>
                <SelectItem value="FedProx">FedProx</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              FedProx tolerates learners whose data differs a lot from the others.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="fl-min-learners">Minimum learners per round</FieldLabel>
            <Input
              id="fl-min-learners"
              type="number"
              min={1}
              value={minLearners}
              onChange={(event) => setMinLearners(event.target.value)}
            />
            <FieldDescription>A round waits until this many learners reported.</FieldDescription>
          </Field>
          <Button type="submit">Save</Button>
        </form>
      </SectionCard>
    </div>
  );
}
