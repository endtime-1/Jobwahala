type MatchableJob = {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  type?: string | null;
  location?: string | null;
};

type MatchableProfile = {
  skills?: string | null;
  experience?: string | null;
};

type MatchableApplication = {
  coverLetter?: string | null;
};

type MatchableService = {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  deliveryTime?: string | null;
};

type MatchableClientSignals = {
  skills?: string | null;
  experience?: string | null;
  industry?: string | null;
  description?: string | null;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'with',
  'you',
  'your',
]);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const unique = <T>(items: T[]) => Array.from(new Set(items));

const tokenize = (value?: string | null) => {
  if (!value) return [];

  return unique(
    value
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s/-]/g, ' ')
      .split(/[\s/.-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
};

const tokenizeSet = (value?: string | null) => new Set(tokenize(value));

const splitSkillPhrases = (skills?: string | null) => {
  if (!skills) return [];

  return unique(
    skills
      .split(/[,\n;|]+/)
      .map((phrase) => phrase.trim())
      .filter(Boolean)
  );
};

const formatReasonTerms = (terms: string[]) =>
  terms
    .slice(0, 3)
    .map((term) => term.trim())
    .filter(Boolean)
    .join(', ');

const matchPhraseToText = (phrase: string, text: string, tokenPool: Set<string>) => {
  const normalizedText = text.toLowerCase();
  const phraseTokens = tokenize(phrase);

  if (phraseTokens.length === 0) {
    return false;
  }

  if (normalizedText.includes(phrase.toLowerCase())) {
    return true;
  }

  const overlapCount = phraseTokens.filter((token) => tokenPool.has(token)).length;
  return overlapCount >= Math.max(1, Math.ceil(phraseTokens.length * 0.6));
};

const intersectTerms = (left: Iterable<string>, right: Set<string>) =>
  unique(Array.from(left).filter((token) => right.has(token)));

const sortReasons = (reasons: string[]) => reasons.filter(Boolean).slice(0, 3);

export const scoreJobForSeeker = (profile: MatchableProfile | null | undefined, job: MatchableJob) => {
  const jobText = [job.title, job.description, job.category, job.type, job.location]
    .filter(Boolean)
    .join(' ');
  const jobTokens = tokenizeSet(jobText);
  const profileSkills = splitSkillPhrases(profile?.skills);
  const matchedSkills = profileSkills.filter((skill) => matchPhraseToText(skill, jobText, jobTokens));
  const experienceTokens = tokenize(profile?.experience);
  const sharedExperienceTerms = intersectTerms(experienceTokens, jobTokens);
  const profileTokens = tokenize([profile?.skills, profile?.experience].filter(Boolean).join(' '));
  const categorySignals = tokenize([job.category, job.title, job.type].filter(Boolean).join(' '));
  const categoryMatches = intersectTerms(profileTokens, new Set(categorySignals));

  const skillScore = (Math.min(matchedSkills.length, 4) / 4) * 46;
  const experienceScore = (Math.min(sharedExperienceTerms.length, 6) / 6) * 22;
  const categoryScore = categoryMatches.length > 0 ? 16 : 0;
  const remoteScore = job.location?.toLowerCase().includes('remote') ? 6 : 0;
  const profileBoost = profile?.skills || profile?.experience ? 8 : 0;

  const reasons = sortReasons([
    matchedSkills.length > 0
      ? `Skill overlap: ${formatReasonTerms(matchedSkills)}`
      : '',
    sharedExperienceTerms.length > 0
      ? `Experience aligns with ${formatReasonTerms(sharedExperienceTerms)}`
      : '',
    categoryMatches.length > 0
      ? `Category fit for ${job.category || job.title || 'this role'}`
      : '',
    remoteScore > 0 ? 'Remote-friendly role' : '',
    !profile?.skills && !profile?.experience
      ? 'Add more profile detail to sharpen your recommendations'
      : '',
  ]);

  return {
    matchScore: clamp(
      Math.round(12 + skillScore + experienceScore + categoryScore + remoteScore + profileBoost),
      18,
      98
    ),
    matchReasons: reasons,
  };
};

export const scoreApplicantForJob = (
  job: MatchableJob,
  profile: MatchableProfile | null | undefined,
  application?: MatchableApplication | null
) => {
  const jobText = [job.title, job.description, job.category, job.type, job.location]
    .filter(Boolean)
    .join(' ');
  const jobTokens = tokenizeSet(jobText);
  const profileSkills = splitSkillPhrases(profile?.skills);
  const matchedSkills = profileSkills.filter((skill) => matchPhraseToText(skill, jobText, jobTokens));
  const candidateSignalText = [profile?.experience, profile?.skills, application?.coverLetter]
    .filter(Boolean)
    .join(' ');
  const candidateTokens = tokenize(candidateSignalText);
  const sharedCandidateTerms = intersectTerms(candidateTokens, jobTokens);
  const coverLetterTokens = tokenize(application?.coverLetter);
  const coverLetterMatches = intersectTerms(coverLetterTokens, jobTokens);
  const titleSignals = tokenize([job.title, job.category, job.type].filter(Boolean).join(' '));
  const titleMatches = intersectTerms(candidateTokens, new Set(titleSignals));

  const skillScore = (Math.min(matchedSkills.length, 4) / 4) * 42;
  const experienceScore = (Math.min(sharedCandidateTerms.length, 6) / 6) * 24;
  const titleScore = titleMatches.length > 0 ? 16 : 0;
  const coverLetterScore = coverLetterMatches.length >= 2 ? 12 : application?.coverLetter ? 6 : 0;
  const completenessBoost = profile?.skills || profile?.experience ? 6 : 0;

  const reasons = sortReasons([
    matchedSkills.length > 0
      ? `Skills matched: ${formatReasonTerms(matchedSkills)}`
      : '',
    sharedCandidateTerms.length > 0
      ? `Experience signals: ${formatReasonTerms(sharedCandidateTerms)}`
      : '',
    coverLetterMatches.length >= 2
      ? `Cover letter mirrors ${formatReasonTerms(coverLetterMatches)}`
      : application?.coverLetter
        ? 'Provided a tailored cover letter'
        : '',
    titleMatches.length > 0
      ? `Role alignment: ${formatReasonTerms(titleMatches)}`
      : '',
  ]);

  return {
    fitScore: clamp(
      Math.round(18 + skillScore + experienceScore + titleScore + coverLetterScore + completenessBoost),
      22,
      99
    ),
    fitReasons: reasons,
  };
};

export const scoreServiceForClient = (
  client: MatchableClientSignals | null | undefined,
  service: MatchableService,
) => {
  const serviceText = [service.title, service.description, service.category, service.deliveryTime]
    .filter(Boolean)
    .join(' ');
  const serviceTokens = tokenizeSet(serviceText);
  const clientSkills = splitSkillPhrases(client?.skills);
  const matchedSkills = clientSkills.filter((skill) => matchPhraseToText(skill, serviceText, serviceTokens));
  const clientSignalText = [client?.skills, client?.experience, client?.industry, client?.description]
    .filter(Boolean)
    .join(' ');
  const clientTokens = tokenize(clientSignalText);
  const sharedSignals = intersectTerms(clientTokens, serviceTokens);
  const categorySignals = tokenize([service.category, service.title].filter(Boolean).join(' '));
  const clientCategoryTokens = tokenize([client?.industry, client?.description].filter(Boolean).join(' '));
  const categoryMatches = intersectTerms(clientCategoryTokens, new Set(categorySignals));

  const skillScore = (Math.min(matchedSkills.length, 4) / 4) * 40;
  const signalScore = (Math.min(sharedSignals.length, 6) / 6) * 26;
  const categoryScore = categoryMatches.length > 0 ? 16 : 0;
  const completenessBoost = clientSignalText ? 10 : 0;

  const reasons = sortReasons([
    matchedSkills.length > 0
      ? `Service fit: ${formatReasonTerms(matchedSkills)}`
      : '',
    sharedSignals.length > 0
      ? `Context overlap: ${formatReasonTerms(sharedSignals)}`
      : '',
    categoryMatches.length > 0
      ? `Category alignment for ${service.category || service.title || 'this service'}`
      : '',
    !clientSignalText
      ? 'Add more profile detail to sharpen service recommendations'
      : '',
  ]);

  return {
    matchScore: clamp(
      Math.round(16 + skillScore + signalScore + categoryScore + completenessBoost),
      20,
      97,
    ),
    matchReasons: reasons,
  };
};
