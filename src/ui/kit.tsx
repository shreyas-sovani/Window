import { useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "ghost" | "link";

const variantClass: Record<Variant, string> = {
  primary: "btn primary",
  ghost: "btn ghost",
  link: "btn link",
};

type ButtonProps = {
  variant?: Variant;
  href?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children">;

/** shadcn-style minimal button: one component, three variants, anchor when href is set. */
export function Button({ variant = "ghost", href, className, children, ...rest }: ButtonProps) {
  const cls = [variantClass[variant], className].filter(Boolean).join(" ");
  if (href) {
    return (
      <a className={cls} href={href} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "up" | "down" | "clay" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

/** Subtle scroll-reveal: children fade up once they enter the viewport. */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.classList.contains("in")) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.style.animationDelay = `${delay}ms`;
            el.classList.add("in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  );
}

/* ---------- shadcn-style primitives (in-repo; paper-ledger tokens) ---------- */

export type MenuItem =
  | { kind: "button"; label: string; onSelect: () => void; icon?: string }
  | { kind: "link"; label: string; href: string; icon?: string };

/** DropdownMenu: keyboard trigger, Escape + outside-click close, menu/menuitem roles. */
export function DropdownMenu(props: { trigger: ReactNode; items: MenuItem[]; align?: "left" | "right"; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className={`dd${open ? " open" : ""}`} ref={root}>
      <button
        type="button"
        className="dd-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={props.label}
        onClick={() => setOpen((v) => !v)}
      >
        {props.trigger}
        <span className="dd-caret" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="dd-menu" role="menu" aria-label={props.label}>
          {props.items.map((item) =>
            item.kind === "link" ? (
              <a key={item.label} className="dd-item" role="menuitem" href={item.href} target="_blank" rel="noreferrer">
                {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                className="dd-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export type ToggleItem = { value: string; label: string; hint?: string };

/** ToggleGroup: pressed pills, `disabled` keeps the item visible with its reason. */
export function ToggleGroup(props: {
  items: ToggleItem[];
  value: string;
  onValueChange: (v: string) => void;
  label: string;
  itemStates?: Record<string, "on" | "off" | "auto" | "waiting">;
}) {
  return (
    <div className="tgroup" role="group" aria-label={props.label}>
      {props.items.map((it) => {
        const state = props.itemStates?.[it.value];
        const on = state === "on";
        return (
          <button
            key={it.value}
            type="button"
            className={`tg-item${on ? " on" : ""}${state === "auto" ? " auto" : ""}${state === "waiting" ? " waiting" : ""}`}
            aria-pressed={on}
            title={it.hint}
            onClick={() => props.onValueChange(it.value)}
          >
            {it.label}
            {state === "auto" && (
              <span className="tg-badge" title="Selected automatically — this series has the best live Window">
                auto
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Tooltip: CSS-driven on hover and keyboard focus; the title stays as fallback. */
export function Tooltip(props: { content: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tip" tabIndex={0} aria-describedby={id}>
      {props.children}
      <span role="tooltip" id={id} className="tip-body">
        {props.content}
      </span>
    </span>
  );
}
