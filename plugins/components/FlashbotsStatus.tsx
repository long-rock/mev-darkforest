import { h, JSX } from "preact";
import type { FlashbotsResult } from "../lib/flashbots";

export function FlashbotsStatus({ status }: { status: FlashbotsResult }): JSX.Element {
  let inner;
  if (status.status === "submitting") {
    inner = <span>Submitting</span>;
  } else {
    inner = (
      <span>
        {status.targetBlock} - {status.status}
      </span>
    );
  }
  return <div>{inner}</div>;
}
