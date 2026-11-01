import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  PageHeader,
  SectionCard,
} from '@oakestra/ui';
import { BookOpenIcon, CodeIcon, ExternalLinkIcon, MessageCircleIcon } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { useLocation } from 'react-router';

import { CONTACT_TEXT, FAQ_ITEMS, HELP_LINKS } from '../content';

const LINK_ICONS: Readonly<Record<string, ComponentType<{ className?: string }>>> = {
  docs: BookOpenIcon,
  website: MessageCircleIcon,
  github: CodeIcon,
};

const FAQ_PREFIX = 'faq-';

export function HelpPage() {
  const { hash } = useLocation();
  // `/help#faq-instance-status` opens that answer, so error pages can deep-link into the FAQ. A
  // manual choice wins until the hash changes again.
  const hashId = hash.startsWith(`#${FAQ_PREFIX}`) ? hash.slice(1 + FAQ_PREFIX.length) : '';
  const linkedId = FAQ_ITEMS.some((item) => item.id === hashId) ? hashId : '';
  const [chosen, setChosen] = useState<{ hash: string; value: string } | null>(null);
  const open = chosen?.hash === hash ? chosen.value : linkedId;

  useEffect(() => {
    if (linkedId) document.getElementById(`${FAQ_PREFIX}${linkedId}`)?.scrollIntoView?.();
  }, [linkedId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Help" description="Answers to common questions and ways to reach us." />

      <section aria-labelledby="help-contact" className="space-y-3">
        <div>
          <h2 id="help-contact" className="text-base font-semibold">
            Get in touch
          </h2>
          <p className="text-muted-foreground text-sm">{CONTACT_TEXT}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {HELP_LINKS.map((link) => {
            const Icon = LINK_ICONS[link.id] ?? ExternalLinkIcon;
            return (
              <li key={link.id}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-card hover:border-primary/30 hover:bg-accent/40 focus-visible:ring-ring/50 flex h-full gap-3 rounded-xl border p-4 shadow-xs transition-colors outline-none focus-visible:ring-[3px]"
                >
                  <span
                    aria-hidden
                    className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      {link.label}
                      <ExternalLinkIcon aria-hidden className="text-muted-foreground size-3.5" />
                    </span>
                    <span className="text-muted-foreground block text-sm">{link.description}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <SectionCard title="Frequently asked questions">
        <Accordion
          type="single"
          collapsible
          value={open}
          onValueChange={(value) => setChosen({ hash, value })}
        >
          {FAQ_ITEMS.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              id={`${FAQ_PREFIX}${item.id}`}
              className="scroll-mt-20"
            >
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground max-w-prose">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionCard>
    </div>
  );
}
