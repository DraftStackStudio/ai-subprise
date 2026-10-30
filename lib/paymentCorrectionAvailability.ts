export const paymentCorrectionPreviewBranch = "codex/payment-correction-preview";

export const paymentCorrectionsEnabled =
  process.env.NEXT_PUBLIC_PAYMENT_CORRECTIONS_ENABLED === "true"
  && process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
  && process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF === paymentCorrectionPreviewBranch;

export const paymentCorrectionsUnavailableMessage =
  "Payment corrections are temporarily unavailable until the database update is complete.";
