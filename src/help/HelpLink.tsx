import { CircleHelp } from "lucide-react";
import { Link } from "react-router-dom";

interface HelpLinkProps {
  slug: string;
  label?: string;
  className?: string;
}

/**
 * Small contextual "help" link that opens the matching article in the
 * Help & User Guide. Used next to feature titles so users can read about
 * exactly the screen they are looking at.
 */
export function HelpLink({ slug, label = "Learn more", className = "" }: HelpLinkProps): React.ReactElement {
  return (
    <Link
      to={`/help/${slug}`}
      className={`inline-flex items-center gap-1 text-[12px] font-semibold text-accent transition-colors hover:opacity-80 ${className}`}
    >
      <CircleHelp size={14} />
      {label}
    </Link>
  );
}