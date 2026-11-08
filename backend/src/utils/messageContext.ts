/** What a conversation is about: the most recent job application between the two people, whichever way round it was. */

export type ConversationContext = { jobId: string; jobTitle: string; status: string };

type ApplicationRow = {
  seekerId: string;
  status: string;
  createdAt: Date;
  job: { id: string; title: string; employerId: string };
};

/**
 * Newest application first. For each person you are talking to, the job you applied to (or they applied to) most recently.
 * Returns a map from that other person's id to the context.
 */
export const latestContextByPerson = (applications: ApplicationRow[], userId: string) => {
  const byPerson = new Map<string, ConversationContext>();
  const newestFirst = [...applications].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  for (const application of newestFirst) {
    const other = application.seekerId === userId ? application.job.employerId : application.seekerId;
    if (other === userId || byPerson.has(other)) continue;
    byPerson.set(other, { jobId: application.job.id, jobTitle: application.job.title, status: application.status });
  }
  return byPerson;
};
