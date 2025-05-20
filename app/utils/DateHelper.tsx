'use client';

import { useEffect, useState } from "react";

export function LocalizedDate({ timestamp }: { timestamp: number }) {
  const [dateString, setDateString] = useState("");

  useEffect(() => {
    setDateString(new Date(timestamp).toLocaleDateString());
  }, [timestamp]);

  return <span className="text-xs text-muted-foreground">{dateString}</span>;
}
