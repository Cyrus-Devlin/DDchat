"use client";

import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
interface Props {
  customers: Doc<"customers">[];
  selectedCustomerId: Id<"customers"> | null;
  onSelectCustomer: (id: Id<"customers">) => void;
}

export default function ChatHeader({
  customers,
  selectedCustomerId,
  onSelectCustomer,
}: Props) {
  return (
    <div className="bg-[#128c7e] px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-white/80 text-sm whitespace-nowrap">As:</span>
        <Select
          value={selectedCustomerId ?? ""}
          onValueChange={(v) => onSelectCustomer(v as Id<"customers">)}
        >
          <SelectTrigger className="bg-white/20 border-0 text-white h-8 w-44 text-sm focus:ring-0">
            <SelectValue placeholder="Pick a customer…" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
