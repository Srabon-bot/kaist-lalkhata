import { z } from "zod";

export const ExtractionTypeSchema = z.enum(["credit_sale", "cash_sale", "repayment", "unclear"]);
export type ExtractionType = z.infer<typeof ExtractionTypeSchema>;

export const ItemTranslationsSchema = z.object({
  bn: z.string().nullable(),
  en: z.string().nullable(),
  ko: z.string().nullable(),
});
export type ItemTranslations = z.infer<typeof ItemTranslationsSchema>;

export const ExtractionResultSchema = z.object({
  type: ExtractionTypeSchema,
  customer: z.string().nullable(),
  item: z.string().nullable(),
  // Optional (not just nullable) so a response from a prompt variant that
  // doesn't produce this field yet (e.g. a cached/older call) still parses.
  item_translations: ItemTranslationsSchema.nullable().optional(),
  amount_taka: z.number().nullable(),
  confidence: z.object({
    customer: z.number().min(0).max(1),
    item: z.number().min(0).max(1),
    amount: z.number().min(0).max(1),
  }),
  transcript: z.string(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
