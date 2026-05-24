import React from "react";
import type { ReviewFindingStatus, ReviewPipelineStageStatus, ReviewRunStatus } from "@firmcode/shared";

type Tone = "neutral" | "info" | "success" | "warning" | "critical";

const statusTone: Record<ReviewRunStatus, Tone> = {
  queued: "info",
  running: "warning",
  succeeded: "success",
  failed: "critical",
  cancelled: "neutral",
  superseded: "neutral"
};

const pipelineTone: Record<ReviewPipelineStageStatus, Tone> = {
  pending: "neutral",
  running: "warning",
  succeeded: "success",
  failed: "critical",
  skipped: "neutral"
};

const findingStatusTone: Record<ReviewFindingStatus, Tone> = {
  open: "warning",
  posted: "success",
  suppressed: "neutral",
  resolved: "success",
  false_positive: "neutral"
};

const toneClassName: Record<Tone, string> = {
  neutral: "border-mist bg-shell text-secondary",
  info: "border-orange-200 bg-blush text-ember",
  success: "border-green-200 bg-green-50 text-success",
  warning: "border-orange-200 bg-blush text-ember",
  critical: "border-red-200 bg-red-50 text-critical"
};

export function StatusBadge({ status }: { status: ReviewRunStatus }) {
  return <Badge className={toneClassName[statusTone[status]]}>{formatLabel(status)}</Badge>;
}

export function PipelineStatusBadge({ status }: { status: ReviewPipelineStageStatus }) {
  return <Badge className={toneClassName[pipelineTone[status]]}>{formatLabel(status)}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone: Tone =
    severity === "critical" || severity === "high" ? "critical" : severity === "medium" ? "warning" : "neutral";

  return <Badge className={toneClassName[tone]}>{formatLabel(severity)}</Badge>;
}

export function FindingStatusBadge({ status }: { status: ReviewFindingStatus }) {
  return <Badge className={toneClassName[findingStatusTone[status]]}>{formatLabel(status)}</Badge>;
}

export function BooleanBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge className={enabled ? toneClassName.success : toneClassName.neutral}>
      {enabled ? "Enabled" : "Disabled"}
    </Badge>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
