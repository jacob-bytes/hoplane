import { Chip, type ChipProps } from "./chip";

/**
 * shadcn/ui spelling of the same primitive. `size` and `color` keep the
 * HeroUI shape until call sites migrate to Badge variants.
 */
export type BadgeProps = ChipProps;

export function Badge(props: BadgeProps) {
  return <Chip {...props} />;
}
