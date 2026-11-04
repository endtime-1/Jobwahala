/**
 * What applicants are told when an employer moves their application, and how employer
 * response time is tracked. Pure functions, so they are easy to test.
 */

export const APPLICATION_STAGES = ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'] as const;

/** An application left in "New" this long triggers a reminder to the employer. */
export const NEW_REMINDER_DAYS = 14;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The label applicants and employers both see. "SUBMITTED" is called New on the board. */
export const STAGE_LABEL: Record<string, string> = {
  SUBMITTED: 'New',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Not selected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export type StatusMessage = {
  /** Short line used as the in-app title and the email subject. */
  title: string;
  /** One or two friendly sentences. */
  message: string;
};

/**
 * Friendly wording for each stage. Moving an application back to New sends nothing.
 * The rejection message is deliberately kind: it thanks the person and does not blame them.
 */
export const describeStatusChange = (
  status: string,
  context: { jobTitle: string; company: string },
): StatusMessage | null => {
  const { jobTitle, company } = context;

  switch (status) {
    case 'SHORTLISTED':
      return {
        title: `Good news: you are shortlisted for ${jobTitle}`,
        message: `${company} liked your application for ${jobTitle} and has shortlisted you. They may be in touch soon, so keep an eye on your messages and email.`,
      };
    case 'INTERVIEW':
      return {
        title: `${company} would like to interview you`,
        message: `${company} would like to talk to you about ${jobTitle}. Watch your messages and email for the time and place, and good luck!`,
      };
    case 'OFFERED':
      return {
        title: `You have an offer from ${company}`,
        message: `Congratulations! ${company} would like to offer you the ${jobTitle} role. They will be in touch with the details, so keep an eye on your messages and email.`,
      };
    case 'HIRED':
      return {
        title: `Congratulations, you are hired at ${company}`,
        message: `${company} has marked you as hired for ${jobTitle}. Well done, and all the best in the new role.`,
      };
    case 'REJECTED':
      return {
        title: `An update on your application to ${company}`,
        message: `Thank you for applying for ${jobTitle} at ${company}, and for the time you put into your application. After careful thought they have decided not to take it forward this time. That is not a reflection of your worth, and we know it is not the news you hoped for. New roles are added every day, and we hope you will keep looking.`,
      };
    default:
      return null;
  }
};

/** Hours between applying and the employer's first move, never negative. */
export const responseHours = (appliedAt: Date, respondedAt: Date) =>
  Math.max(0, (respondedAt.getTime() - appliedAt.getTime()) / HOUR_MS);

/** Folds one more response into the running average. Kept unrounded so it never drifts; round it when showing it. */
export const nextResponseStats = (
  current: { avgResponseHours: number | null; responseCount: number },
  hours: number,
) => {
  const count = current.responseCount + 1;
  const previousTotal = (current.avgResponseHours ?? 0) * current.responseCount;
  const average = (previousTotal + hours) / count;
  return { avgResponseHours: average, responseCount: count };
};

/** True when this change is the employer's first response to the applicant. */
export const isFirstResponse = (
  application: { status: string; firstRespondedAt?: Date | null },
  nextStatus: string,
) => !application.firstRespondedAt && application.status === 'SUBMITTED' && nextStatus !== 'SUBMITTED';

export const reminderCutoff = (now: Date = new Date()) => new Date(now.getTime() - NEW_REMINDER_DAYS * DAY_MS);

/** "When it last changed": older rows have no statusChangedAt, so fall back to updatedAt. */
export const lastChangedAt = (application: { statusChangedAt?: Date | null; updatedAt: Date }) =>
  application.statusChangedAt ?? application.updatedAt;
