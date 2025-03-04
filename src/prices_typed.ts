import "./polyfills";
import express from "express";
import { Database } from "./database";
import { Temporal } from "@js-temporal/polyfill";

type PD = Temporal.PlainDate;

function convert(date: Date | PD | undefined): PD | undefined {
  return date && (date instanceof Date ? date.toTemporalInstant().toZonedDateTimeISO("UTC").toPlainDate() : date);
}

// Refactor the following code to get rid of the legacy Date class.
// Use Temporal.PlainDate instead. See /test/date_conversion.spec.mjs for examples.

function createApp(database: Database) {
  const app = express();

  app.put("/prices", (req, res) => {
    const type = req.query.type as string;
    const cost = parseInt(req.query.cost as string);
    database.setBasePrice(type, cost);
    res.json();
  });

  app.get("/prices", (req, res) => {
    const age = req.query.age ? parseInt(req.query.age as string) : undefined;
    const type = req.query.type as string;
    const baseCost = database.findBasePriceByType(type)!.cost;
    const date = parseDate(req.query.date as string);
    const dateTemp = convert(date);
    const cost = calculateCost(age, type, dateTemp, baseCost);
    res.json({ cost });
  });

  function parseDate(dateString: string | undefined): Date | undefined {
    if (dateString) {
      return new Date(dateString);
    }
  }

  function calculateCost(age: number | undefined, type: string, date: PD | undefined, baseCost: number) {
    if (type === "night") {
      return calculateCostForNightTicket(age, baseCost);
    } else {
      return calculateCostForDayTicket(age, convert(date), baseCost);
    }
  }

  function calculateCostForNightTicket(age: number | undefined, baseCost: number) {
    if (age === undefined) {
      return 0;
    }
    if (age < 6) {
      return 0;
    }
    if (age > 64) {
      return Math.ceil(baseCost * 0.4);
    }
    return baseCost;
  }

  function calculateCostForDayTicket(age: number | undefined, date: PD | undefined, baseCost: number) {
    let reduction = calculateReduction(date);
    if (age === undefined) {
      return Math.ceil(baseCost * (1 - reduction / 100));
    }
    if (age < 6) {
      return 0;
    }
    if (age < 15) {
      return Math.ceil(baseCost * 0.7);
    }
    if (age > 64) {
      return Math.ceil(baseCost * 0.75 * (1 - reduction / 100));
    }
    return Math.ceil(baseCost * (1 - reduction / 100));
  }

  function calculateReduction(date: PD | undefined) {
    let reduction = 0;
    if (date && isMonday(date) && !isHoliday(date)) {
      reduction = 35;
    }
    return reduction;
  }

  function isMonday(date: PD) {
    return date.dayOfWeek === 1;
  }

  function isHoliday(date: PD) {
    const holidays = database.getHolidays();
    for (let row of holidays) {
      let holidayTemp = Temporal.PlainDate.from(row.holiday);
      if (date && date.equals(holidayTemp)) {
        return true;
      }
    }
    return false;
  }

  return app;
}

export { createApp };
