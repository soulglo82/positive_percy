import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { APPROVED_ICONS } from './approvedIcons';

// E03: an owner-approved Phosphor Duotone icon, drawn from its exact source SVG.
// approvedIcons.js is generated from the approval register and checked against
// the pinned upstream files (src/test/approvedIcons.test.js), so `inner` is a
// build-time constant from verified repository files, never user or network
// data. Icons are decorative: the button or text beside them carries the name.
const PercyIcon = forwardRef(function PercyIcon({ id, className, ...rest }, ref) {
  const icon = APPROVED_ICONS[id];
  if (!icon) {
    if (import.meta.env.DEV) throw new Error(`PercyIcon: "${id}" is not an approved icon`);
    return null;
  }
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={icon.viewBox}
      fill={icon.fill || undefined}
      aria-hidden="true"
      focusable="false"
      className={cn('inline-block shrink-0', className)}
      data-icon={id}
      dangerouslySetInnerHTML={{ __html: icon.inner }}
      {...rest}
    />
  );
});

export default PercyIcon;

// A component with the Lucide calling shape, for maps such as categoryIcons.js.
export function approvedIcon(id) {
  if (!APPROVED_ICONS[id]) throw new Error(`approvedIcon: "${id}" is not an approved icon`);
  const Icon = forwardRef(function ApprovedIcon(props, ref) {
    return <PercyIcon ref={ref} id={id} {...props} />;
  });
  Icon.displayName = `ApprovedIcon(${id})`;
  return Icon;
}
