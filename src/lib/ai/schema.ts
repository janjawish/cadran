import { z } from "zod";
export const observationSchema = z.object({
  brandText: z.string(),
  collectionText: z.string(),
  referenceText: z.string(),
  features: z
    .array(
      z.object({
        area: z.string(),
        observation: z.string(),
        status: z.enum(["observed", "uncertain", "not-visible"]),
      }),
    )
    .max(25),
  anomalies: z.array(z.string()).max(20),
  missing: z.array(z.string()).max(20),
});
export const candidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        catalogId: z.string().optional(),
        brand: z.string(),
        model: z.string(),
        reference: z.string(),
        confidence: z.number().min(0).max(100),
        reasons: z.array(z.string()),
      }),
    )
    .min(1)
    .max(6),
  summary: z.string(),
});
export const listingSchema = z.object({
  title: z.string(),
  text: z.string(),
  price: z.number().nonnegative().nullable(),
  year: z.number().int().min(1800).max(2200).nullable(),
  condition: z.enum(["excellent", "good", "fair", "poor", "unknown"]),
  box: z.enum(["yes", "no", "unknown"]),
  papers: z.enum(["yes", "no", "unknown"]),
  service: z.string(),
  seller: z.string(),
  positives: z.array(z.string()),
  inconsistencies: z.array(z.string()),
  missing: z.array(z.string()),
  questions: z.array(z.string()),
});
export const generatedSchema = z.object({
  title: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  characteristics: z.array(z.string()),
  toSpecify: z.array(z.string()),
});
