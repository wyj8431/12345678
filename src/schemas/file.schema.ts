import { z } from "zod";

export const fileInitSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  fileType: z.enum(["pdf", "word", "excel", "txt", "image", "audio"]),
  checksum: z.string().min(8).max(128),
  ingestMode: z.enum(["temporary", "permanent"]).default("permanent")
});

export const fileCompleteSchema = fileInitSchema.extend({
  uploadId: z.string().min(8)
});

export type FileInitRequest = z.infer<typeof fileInitSchema>;
export type FileCompleteRequest = z.infer<typeof fileCompleteSchema>;
