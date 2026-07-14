import { prisma } from "@/app/lib/db/prisma"
import { notFound } from "next/navigation"
import { UserList } from "@/app/components/features/profile/UserList"

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const user = await prisma.user.findUnique({
    where: { userName: username },
    select: { id: true },
  })
  if (!user) notFound()

  return (
    <UserList
      userId={user.id}
      username={username}
      type="followers"
    />
  )
}
