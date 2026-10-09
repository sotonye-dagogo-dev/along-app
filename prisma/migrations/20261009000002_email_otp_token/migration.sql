-- CreateTable EmailOtpToken (durable email-verification / change-email OTP storage)
CREATE TABLE IF NOT EXISTS "EmailOtpToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" TEXT,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtpToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailOtpToken_email_purpose_idx" ON "EmailOtpToken"("email", "purpose");
CREATE INDEX IF NOT EXISTS "EmailOtpToken_userId_purpose_idx" ON "EmailOtpToken"("userId", "purpose");
CREATE INDEX IF NOT EXISTS "EmailOtpToken_expiresAt_idx" ON "EmailOtpToken"("expiresAt");
