/** How a person is shown in a conversation: a name people recognise, their role, and their email as a fallback. */

export const participantSelect = {
  id: true,
  email: true,
  role: true,
  employerProfile: { select: { companyName: true } },
  jobSeekerProfile: { select: { firstName: true, lastName: true } },
  freelancerProfile: { select: { firstName: true, lastName: true } },
} as const;

type ParticipantRow = {
  id: string;
  email: string | null;
  role?: string | null;
  employerProfile?: { companyName?: string | null } | null;
  jobSeekerProfile?: { firstName?: string | null; lastName?: string | null } | null;
  freelancerProfile?: { firstName?: string | null; lastName?: string | null } | null;
};

const fullName = (profile?: { firstName?: string | null; lastName?: string | null } | null) =>
  [profile?.firstName, profile?.lastName].map((part) => part?.trim()).filter(Boolean).join(' ');

/** The company name for employers (not the placeholder given at sign-up), otherwise the person's own name. Null when there is none. */
export const displayNameOf = (user: ParticipantRow) => {
  const company = user.employerProfile?.companyName?.trim();
  if (company && company !== 'New Company') return company;
  return fullName(user.jobSeekerProfile) || fullName(user.freelancerProfile) || null;
};

export const toParticipant = (user: ParticipantRow) => ({
  id: user.id,
  email: user.email,
  role: user.role ?? null,
  name: displayNameOf(user),
});
