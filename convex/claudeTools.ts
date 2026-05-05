"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const getAvailableNurses = action({
  args: {
    area: v.string(),
    datetime: v.string(),
  },
  handler: async (ctx, { area, datetime }): Promise<unknown> => {
    const nurses = await ctx.runQuery(api.nurses.listAll, {});

    const date = new Date(datetime);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = dayNames[date.getDay()];
    const mins = date.getHours() * 60 + date.getMinutes();
    const areaKey = area.toUpperCase().replace(/\s/g, "");

    const available = (nurses as Array<{
      _id: string;
      name: string;
      coverageAreas: string[];
      simulatedReliability: number;
      workingHours: { start: string; end: string; days: string[] };
    }>).filter((n) => {
      const covers = n.coverageAreas.some((a) => {
        const k = a.toUpperCase().replace(/\s/g, "");
        return k === areaKey || areaKey.startsWith(k);
      });
      if (!covers) return false;
      if (!n.workingHours.days.includes(day)) return false;
      const [sh, sm] = n.workingHours.start.split(":").map(Number);
      const [eh, em] = n.workingHours.end.split(":").map(Number);
      return mins >= sh * 60 + sm && mins <= eh * 60 + em - 60;
    });

    return available.map((n) => ({
      id: n._id,
      name: n.name,
      coverageAreas: n.coverageAreas,
      reliability: n.simulatedReliability,
    }));
  },
});
