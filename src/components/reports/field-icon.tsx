"use client";

import {
  CalendarDays,
  Hash,
  Link2,
  Tag,
  Type,
} from "lucide-react";
import type { FieldDataType } from "@/lib/reports/pivot-fields";

const SIZE = 14;

export function FieldIcon({
  dataType,
  className,
}: {
  dataType: FieldDataType;
  className?: string;
}) {
  switch (dataType) {
    case "string":
      return <Type size={SIZE} className={className} />;
    case "number":
      return <Hash size={SIZE} className={className} />;
    case "date":
      return <CalendarDays size={SIZE} className={className} />;
    case "enum":
      return <Tag size={SIZE} className={className} />;
    case "relation":
      return <Link2 size={SIZE} className={className} />;
  }
}
