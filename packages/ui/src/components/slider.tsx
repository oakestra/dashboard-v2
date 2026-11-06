import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from '../lib/utils';

/**
 * `thumbLabel` names the thumb (one label, or one per thumb for a range). Radix reads
 * `aria-label` from the Thumb, not the Root, so a label passed to the Root never reaches the
 * element screen readers focus. `thumbValueText` is what they announce as the value, for sliders
 * whose raw number means nothing to a person, such as a position on a log scale.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabel,
  thumbValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabel?: string | readonly string[];
  thumbValueText?: string;
}) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  );
  const labelFor = (index: number) =>
    typeof thumbLabel === 'string' ? thumbLabel : thumbLabel?.[index];

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-sm bg-foreground/10 data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={labelFor(index)}
          aria-valuetext={thumbValueText}
          className="block size-4 shrink-0 rounded-full border border-primary bg-background transition-[box-shadow] hover:ring-4 hover:ring-ring/20 focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-hidden disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
