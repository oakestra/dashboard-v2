import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@oakestra/ui';
import { ExternalLinkIcon } from 'lucide-react';

import { CONTACT_TEXT, FAQ_ITEMS, HELP_LINKS } from '../content';

export function HelpPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Help" description="Answers to common questions and ways to reach us." />

      <Card>
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {FAQ_ITEMS.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>{CONTACT_TEXT}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-3">
            {HELP_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:bg-accent focus-visible:ring-ring/50 block h-full rounded-md border p-3 outline-none focus-visible:ring-[3px]"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {link.label}
                    <ExternalLinkIcon aria-hidden className="size-3.5" />
                  </span>
                  <span className="text-muted-foreground text-sm">{link.description}</span>
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
