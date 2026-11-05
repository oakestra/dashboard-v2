import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  PageHeader,
  SectionCard,
} from '@oakestra/ui';
import { ExternalLinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { CONTACT_TEXT, FAQ_ITEMS, HELP_LINKS } from '../content';

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
    <div className="space-y-5">
      <PageHeader title="Help" />

      <SectionCard title="Get in touch" description={CONTACT_TEXT} flush>
        <ul className="divide-y border-t">
          {HELP_LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group hover:bg-muted/60 focus-visible:bg-muted/60 flex items-center gap-3 px-4 py-2 outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{link.label}</span>
                  <span className="text-muted-foreground block text-xs">{link.description}</span>
                </span>
                <ExternalLinkIcon
                  aria-hidden
                  className="text-muted-foreground/60 group-hover:text-foreground size-4 shrink-0"
                />
              </a>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Frequently asked questions" flush>
        <Accordion
          type="single"
          className="border-t"
          collapsible
          value={open}
          onValueChange={(value) => setChosen({ hash, value })}
        >
          {FAQ_ITEMS.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              id={`${FAQ_PREFIX}${item.id}`}
              className="scroll-mt-20 last:border-b-0"
            >
              <AccordionTrigger className="px-4 py-2.5">{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground max-w-prose px-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionCard>
    </div>
  );
}
