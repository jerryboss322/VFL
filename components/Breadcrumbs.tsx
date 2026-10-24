"use client";

import Link from "next/link";
import React from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 font-mono text-[11px] text-fog">
      <Link
        href="/"
        className="transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded px-1"
      >
        Home
      </Link>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <span className="text-line select-none">/</span>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded px-1"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`px-1 ${isLast ? "text-bone font-semibold" : "text-fog"}`} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
