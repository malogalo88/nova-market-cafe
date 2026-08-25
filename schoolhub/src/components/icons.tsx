/** Minimal inline icon set — avoids adding an icon library dependency. */
interface P {
  size?: number;
}
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Icon = {
  Home: ({ size }: P) => (
    <svg {...base(size)}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Classes: ({ size }: P) => (
    <svg {...base(size)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="7" cy="6" r="0.5" />
    </svg>
  ),
  Students: ({ size }: P) => (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.6-3.5 2.8-5 5.5-5s4.9 1.5 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 15c2.6.2 4.1 1.6 4.5 4.4" />
    </svg>
  ),
  Teacher: ({ size }: P) => (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M12 16v4m-4 0h8M8 9h5M8 12h3" />
    </svg>
  ),
  Check: ({ size }: P) => (
    <svg {...base(size)}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  ),
  Calendar: ({ size }: P) => (
    <svg {...base(size)}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M8 3v4m8-4v4" />
    </svg>
  ),
  Users: ({ size }: P) => (
    <svg {...base(size)}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 21c.8-4 3.6-6 7-6s6.2 2 7 6" />
    </svg>
  ),
  Shield: ({ size }: P) => (
    <svg {...base(size)}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  ),
  Gear: ({ size }: P) => (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v3m0 12.4v3M2.8 12h3m12.4 0h3M5.5 5.5l2.1 2.1m8.8 8.8l2.1 2.1m0-13l-2.1 2.1M7.6 16.4l-2.1 2.1" />
    </svg>
  ),
  Search: ({ size }: P) => (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  ),
  Menu: ({ size }: P) => (
    <svg {...base(size)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Sun: ({ size }: P) => (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5m0 14v2.5M4.9 4.9L6.7 6.7m10.6 10.6l1.8 1.8M2.5 12H5m14 0h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  ),
  Moon: ({ size }: P) => (
    <svg {...base(size)}>
      <path d="M20 13.5A8 8 0 1110 3a6.5 6.5 0 0010 10.5z" />
    </svg>
  ),
  Clock: ({ size }: P) => (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  List: ({ size }: P) => (
    <svg {...base(size)}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  ),
};
