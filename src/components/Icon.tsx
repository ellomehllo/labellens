const PATHS = {
  camera: 'M14.5 4h-5L7.5 6.5H4.5A1.5 1.5 0 0 0 3 8v10a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V8a1.5 1.5 0 0 0-1.5-1.5h-3L14.5 4Z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  upload: 'M12 15V4 M7.5 8.5 12 4l4.5 4.5 M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15',
  type: 'M5 7V5h14v2 M12 5v14 M9 19h6',
  tag: 'M3.5 12.1V4.5a1 1 0 0 1 1-1h7.6l8.4 8.4a1.4 1.4 0 0 1 0 2l-6 6a1.4 1.4 0 0 1-2 0l-9-7.8Z M8 8h.01',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M8.5 12.5l2.5 2.5 4.5-5',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6 M12 17h.01',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 11v5 M12 8h.01',
  alert: 'M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z M12 9.5v4 M12 17h.01',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  trash: 'M4 7h16 M9 7V4.5h6V7 M6 7l1 13h10l1-13 M10 11v5 M14 11v5',
  chevron: 'm6 9 6 6 6-6',
  x: 'M18 6 6 18 M6 6l12 12',
  plus: 'M12 5v14 M5 12h14',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  shield: 'M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  history: 'M3 12a9 9 0 1 0 2.6-6.4L3 8 M3 3v5h5 M12 7v5l3 2',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15Z M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4',
  phone: 'M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
