import { useEffect, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";

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
export function Button({ variant = "ghost", href, children, ...rest }: ButtonProps) {
  const cls = variantClass[variant];
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
