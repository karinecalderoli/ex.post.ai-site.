import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "./prisma";

export const MAX_SCHEDULED_POSTS_PER_DAY = 5;

export class ScheduleLimitError extends Error {
  constructor(public date: Date, public limit: number) {
    super(`Limite de ${limit} publicações agendadas por dia atingido para ${date.toDateString()}.`);
  }
}

export async function assertWithinDailyLimit(userId: string, scheduledFor: Date) {
  const count = await prisma.scheduledPost.count({
    where: {
      userId,
      scheduledFor: { gte: startOfDay(scheduledFor), lte: endOfDay(scheduledFor) },
      status: { in: ["SCHEDULED", "PUBLISHED"] },
    },
  });
  if (count >= MAX_SCHEDULED_POSTS_PER_DAY) {
    throw new ScheduleLimitError(scheduledFor, MAX_SCHEDULED_POSTS_PER_DAY);
  }
}

export async function createScheduledPost(params: {
  userId: string;
  videoSceneId: string;
  platform: import("@prisma/client").Platform;
  scheduledFor: Date;
}) {
  await assertWithinDailyLimit(params.userId, params.scheduledFor);
  return prisma.scheduledPost.create({ data: params });
}
