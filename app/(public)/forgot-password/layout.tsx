import { buildMetadata } from "@/app/lib/utils/metadata"

export const metadata = buildMetadata({
  title: "Forgot Password",
  description: "Reset your Along account password.",
  path: "/forgot-password",
})

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
