/**
 * The one list of skills, shared by courses, jobs and profiles.
 *
 * Courses are tagged with these. A job's required skills are found by looking for them (or their usual spellings)
 * in the job's title, category and description. `src/content/skills.ts` on the website must be an exact copy of
 * this file: a backend test fails if the two ever differ.
 */
export type Skill = { slug: string; name: string; aliases?: string[] };

export const SKILLS: Skill[] = [
  { slug: 'excel', name: 'Microsoft Excel', aliases: ['excel', 'spreadsheet', 'spreadsheets'] },
  { slug: 'word', name: 'Microsoft Word', aliases: ['ms word', 'microsoft word'] },
  { slug: 'powerpoint', name: 'PowerPoint', aliases: ['powerpoint', 'presentation skills'] },
  { slug: 'data-analysis', name: 'Data analysis', aliases: ['data analysis', 'data analytics', 'data analyst', 'power bi', 'tableau'] },
  { slug: 'sql', name: 'SQL', aliases: ['sql', 'mysql', 'postgresql', 'databases'] },
  { slug: 'python', name: 'Python', aliases: ['python'] },
  { slug: 'javascript', name: 'JavaScript', aliases: ['javascript', 'typescript', 'node.js', 'nodejs'] },
  { slug: 'web-development', name: 'Web development', aliases: ['web development', 'web developer', 'frontend', 'front-end', 'backend', 'back-end', 'react', 'html', 'css', 'wordpress'] },
  { slug: 'mobile-development', name: 'Mobile app development', aliases: ['mobile app', 'android', 'ios', 'flutter', 'react native'] },
  { slug: 'cybersecurity', name: 'Cybersecurity', aliases: ['cybersecurity', 'cyber security', 'information security', 'network security'] },
  { slug: 'networking', name: 'Computer networking', aliases: ['networking', 'cisco', 'ccna', 'it support', 'helpdesk', 'help desk'] },
  { slug: 'cloud-computing', name: 'Cloud computing', aliases: ['aws', 'azure', 'cloud computing', 'devops'] },
  { slug: 'ux-design', name: 'UI/UX design', aliases: ['ux', 'ui design', 'ui/ux', 'user experience', 'figma'] },
  { slug: 'graphic-design', name: 'Graphic design', aliases: ['graphic design', 'photoshop', 'illustrator', 'canva', 'coreldraw'] },
  { slug: 'video-editing', name: 'Video editing', aliases: ['video editing', 'video editor', 'premiere', 'after effects'] },
  { slug: 'photography', name: 'Photography', aliases: ['photography', 'photographer'] },
  { slug: 'digital-marketing', name: 'Digital marketing', aliases: ['digital marketing', 'seo', 'google ads', 'facebook ads', 'online marketing', 'email marketing'] },
  { slug: 'social-media', name: 'Social media management', aliases: ['social media', 'community manager', 'content creation'] },
  { slug: 'copywriting', name: 'Copywriting', aliases: ['copywriting', 'copywriter', 'content writing', 'content writer'] },
  { slug: 'sales', name: 'Sales', aliases: ['sales', 'business development', 'selling'] },
  { slug: 'customer-service', name: 'Customer service', aliases: ['customer service', 'customer support', 'customer care', 'call centre', 'call center'] },
  { slug: 'communication', name: 'Communication skills', aliases: ['communication skills', 'public speaking', 'business communication'] },
  { slug: 'leadership', name: 'Leadership and management', aliases: ['leadership', 'team management', 'people management', 'supervisor'] },
  { slug: 'project-management', name: 'Project management', aliases: ['project management', 'project manager', 'pmp', 'prince2', 'agile', 'scrum'] },
  { slug: 'accounting', name: 'Accounting', aliases: ['accounting', 'accountant', 'bookkeeping', 'quickbooks', 'sage', 'tally', 'payroll'] },
  { slug: 'finance', name: 'Finance', aliases: ['finance', 'financial analysis', 'financial modelling', 'investment', 'treasury'] },
  { slug: 'banking', name: 'Banking', aliases: ['banking', 'teller', 'loan officer', 'credit analysis', 'microfinance'] },
  { slug: 'auditing', name: 'Auditing and tax', aliases: ['audit', 'auditing', 'taxation', 'tax compliance', 'acca', 'ican'] },
  { slug: 'human-resources', name: 'Human resources', aliases: ['human resources', 'hr management', 'recruitment', 'recruiter', 'talent acquisition'] },
  { slug: 'administration', name: 'Office administration', aliases: ['office administration', 'administrative assistant', 'secretarial', 'secretary', 'receptionist', 'front desk'] },
  { slug: 'entrepreneurship', name: 'Entrepreneurship', aliases: ['entrepreneurship', 'start a business', 'business planning', 'business plan'] },
  { slug: 'procurement', name: 'Procurement and supply chain', aliases: ['procurement', 'supply chain', 'purchasing', 'logistics management', 'warehouse management', 'inventory'] },
  { slug: 'logistics', name: 'Logistics', aliases: ['logistics', 'freight', 'shipping', 'clearing and forwarding'] },
  { slug: 'driving', name: 'Professional driving', aliases: ['driving licence', 'driving license', 'professional driver', 'driver'] },
  { slug: 'hospitality', name: 'Hospitality', aliases: ['hospitality', 'hotel management', 'front office', 'housekeeping', 'guest relations'] },
  { slug: 'catering', name: 'Catering and cooking', aliases: ['catering', 'cooking', 'chef', 'culinary', 'baking', 'pastry'] },
  { slug: 'event-planning', name: 'Event planning', aliases: ['event planning', 'event management', 'event coordinator'] },
  { slug: 'teaching', name: 'Teaching', aliases: ['teaching', 'teacher', 'lesson planning', 'tutoring', 'tutor', 'early childhood'] },
  { slug: 'nursing', name: 'Nursing and patient care', aliases: ['nursing', 'nurse', 'patient care', 'caregiver', 'midwifery'] },
  { slug: 'first-aid', name: 'First aid and safety', aliases: ['first aid', 'health and safety', 'occupational safety', 'hse', 'fire safety'] },
  { slug: 'pharmacy', name: 'Pharmacy', aliases: ['pharmacy', 'pharmacist', 'dispensing'] },
  { slug: 'public-health', name: 'Public health', aliases: ['public health', 'community health', 'epidemiology'] },
  { slug: 'agriculture', name: 'Agriculture and farming', aliases: ['agriculture', 'farming', 'agribusiness', 'crop production', 'poultry', 'livestock'] },
  { slug: 'electrical', name: 'Electrical installation', aliases: ['electrical installation', 'electrician', 'wiring', 'solar installation', 'solar'] },
  { slug: 'plumbing', name: 'Plumbing', aliases: ['plumbing', 'plumber', 'pipe fitting'] },
  { slug: 'construction', name: 'Construction and building', aliases: ['construction', 'masonry', 'carpentry', 'bricklaying', 'quantity surveying', 'site supervisor'] },
  { slug: 'welding', name: 'Welding and fabrication', aliases: ['welding', 'welder', 'fabrication'] },
  { slug: 'mechanics', name: 'Auto mechanics', aliases: ['auto mechanic', 'mechanic', 'automotive', 'vehicle maintenance'] },
  { slug: 'engineering', name: 'Engineering', aliases: ['engineering', 'engineer', 'autocad', 'solidworks', 'cad'] },
  { slug: 'fashion', name: 'Fashion and tailoring', aliases: ['fashion design', 'tailoring', 'sewing', 'dressmaking', 'seamstress'] },
  { slug: 'beauty', name: 'Beauty and hairdressing', aliases: ['hairdressing', 'makeup', 'cosmetology', 'barbering', 'beautician'] },
  { slug: 'security', name: 'Security services', aliases: ['security guard', 'security officer', 'security services'] },
  { slug: 'law', name: 'Legal skills', aliases: ['legal', 'paralegal', 'law', 'compliance', 'contracts'] },
  { slug: 'journalism', name: 'Journalism and media', aliases: ['journalism', 'journalist', 'broadcasting', 'presenter', 'radio'] },
  { slug: 'translation', name: 'Languages and translation', aliases: ['french', 'translation', 'interpreter', 'english proficiency', 'ielts'] },
  { slug: 'artificial-intelligence', name: 'AI and machine learning', aliases: ['artificial intelligence', 'machine learning', 'ai tools', 'chatgpt', 'data science'] },
  { slug: 'research', name: 'Research and reporting', aliases: ['research', 'report writing', 'monitoring and evaluation', 'm&e'] },
  { slug: 'ngo', name: 'NGO and development work', aliases: ['ngo', 'community development', 'grant writing', 'fundraising', 'proposal writing'] },
];

const bySlug = new Map(SKILLS.map((skill) => [skill.slug, skill]));

export const isSkillSlug = (slug: string) => bySlug.has(slug);
export const skillName = (slug: string) => bySlug.get(slug)?.name ?? slug;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The skills a piece of text asks for or mentions: whole words or phrases, any case. */
export const skillsInText = (text: string | null | undefined): string[] => {
  const haystack = (text ?? '').toLowerCase();
  if (!haystack.trim()) return [];

  return SKILLS.filter((skill) =>
    [skill.name.toLowerCase(), ...(skill.aliases ?? [])].some((term) =>
      new RegExp(`(?<![a-z0-9])${escapeRegex(term.toLowerCase())}(?![a-z0-9])`).test(haystack),
    ),
  ).map((skill) => skill.slug);
};
