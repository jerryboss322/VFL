import React from "react";

interface Props {
  tone: "loading" | "error" | "disconnected" | "empty";
  title: string;
  detail?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function StatePanel({ tone, title, detail, action }: Props) {
  const isAlert = tone === "error" || tone === "disconnected";
  const isLoading = tone === "loading";

  return (
    <div
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      className="flex flex-col items-center justify-center rounded-card border border-line bg-coal p-8 text-center sm:flex-row sm:items-start sm:text-left sm:gap-4"
    >
      <div className="mb-3 shrink-0 sm:mb-0 sm:mt-0.5">
        {isLoading && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#014D38] text-accent">
            <svg
              className="h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          </div>
        )}

        {isAlert && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-loss/15 text-loss border border-loss/30">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        )}

        {tone === "empty" && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-graphite text-fog border border-line">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1">
        <h3 className={`text-sm font-semibold ${isAlert ? "text-loss" : "text-bone"}`}>
          {title}
        </h3>
        {detail && <p className="mt-1 text-xs text-fog max-w-md">{detail}</p>}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-3 inline-flex items-center rounded-control bg-accent px-3 py-1.5 font-mono text-xs font-bold text-ink transition-opacity hover:opacity-90"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
