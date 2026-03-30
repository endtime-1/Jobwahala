import { useEffect, useMemo, useRef, useState } from 'react'
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { Sparkles, Download, Copy, RefreshCw, Layout, FileText, User, Briefcase, GraduationCap, Plus, Trash2, Wand2, History } from 'lucide-react'
import { apiGetCVById, apiGetMyCVs, apiGetProfileOptimization, apiSaveCVGeneration } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatRelativeTime } from '../lib/display'

type ExperienceEntry = {
  company: string
  role: string
  period: string
  description: string
}

type EducationEntry = {
  school: string
  degree: string
  year: string
}

type ProjectEntry = {
  name: string
  role: string
  stack: string
  link: string
  description: string
}

type CertificationEntry = {
  name: string
  issuer: string
  year: string
  link: string
}

type GeneratedData = {
  summary: string
  optimizedExp: string[]
  suggestedSkills: string[]
}

type CvHistoryRecord = {
  id: string
  prompt?: string | null
  content: string
  createdAt: string
}

type ProfileOptimization = {
  score: number
  headline: string
  strengths: string[]
  improvements: string[]
  suggestedSummary: string
  suggestedSkills: string[]
  nextCvPrompt: string
  targetRoles: string[]
}

type CvTemplate = 'executive' | 'studio' | 'compact'

const emptyExperience = { company: '', role: '', period: '', description: '' }
const emptyEducation = { school: '', degree: '', year: '' }
const emptyProject = { name: '', role: '', stack: '', link: '', description: '' }
const emptyCertification = { name: '', issuer: '', year: '', link: '' }

const cvTemplateOptions: Array<{
  id: CvTemplate
  label: string
  description: string
}> = [
  {
    id: 'executive',
    label: 'Executive',
    description: 'Bold leadership-style header with roomy spacing.',
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Creative modern layout with softer contrast and richer chips.',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Dense recruiter-friendly layout for fast scanning.',
  },
]

const profileScoreFallback = (formData: {
  fullName: string
  headline: string
  summary: string
  skills: string
  achievements: string
  languages: string
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  certifications: CertificationEntry[]
}) => {
  let score = 20
  if (formData.fullName.trim()) score += 15
  if (formData.headline.trim()) score += 10
  if (formData.summary.trim().length >= 80) score += 20
  if (formData.skills.split(',').map((item) => item.trim()).filter(Boolean).length >= 3) score += 20
  if (formData.experience.some((entry) => entry.description.trim().length >= 60)) score += 25
  if (formData.projects.some((entry) => entry.name.trim() && entry.description.trim().length >= 40)) score += 5
  if (formData.certifications.some((entry) => entry.name.trim())) score += 3
  if (formData.achievements.trim().length >= 40) score += 4
  if (formData.languages.split(',').map((item) => item.trim()).filter(Boolean).length >= 2) score += 3
  return Math.min(100, score)
}

const formatGeneratedDocument = (content: string) => {
  if (!content.trim()) {
    return ''
  }

  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

const buildLocalCvMarkdown = (
  formData: {
    fullName: string
    headline: string
    email: string
    phone: string
    location: string
    website: string
    linkedin: string
    portfolio: string
    achievements: string
    languages: string
    education: EducationEntry[]
    experience: ExperienceEntry[]
    projects: ProjectEntry[]
    certifications: CertificationEntry[]
    skills: string
  },
  nextGenerated: GeneratedData,
) => {
  const experienceSection = formData.experience
    .filter((entry) => entry.company || entry.role || entry.period || entry.description)
    .map((entry, index) => {
      const optimizedDescription = nextGenerated.optimizedExp[index] || entry.description || 'Experience details pending.'
      return [
        `### ${entry.role || 'Professional role'}`,
        `${entry.company || 'Company'}${entry.period ? ` | ${entry.period}` : ''}`,
        '',
        optimizedDescription,
      ].join('\n')
    })
    .join('\n\n')

  const educationSection = formData.education
    .filter((entry) => entry.school || entry.degree || entry.year)
    .map((entry) =>
      [`- ${entry.degree || 'Degree'}${entry.school ? `, ${entry.school}` : ''}${entry.year ? ` (${entry.year})` : ''}`].join(
        '\n',
      ),
    )
    .join('\n')

  const projectSection = formData.projects
    .filter((entry) => entry.name || entry.role || entry.stack || entry.link || entry.description)
    .map((entry) =>
      [
        `### ${entry.name || 'Project'}`,
        [entry.role, entry.stack].filter(Boolean).join(' | ') || 'Project details',
        entry.link ? `Link: ${entry.link}` : '',
        '',
        entry.description || 'Project impact details pending.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')

  const certificationSection = formData.certifications
    .filter((entry) => entry.name || entry.issuer || entry.year || entry.link)
    .map((entry) =>
      [
        `- ${entry.name || 'Certification'}`,
        [entry.issuer, entry.year].filter(Boolean).join(' | '),
        entry.link || '',
      ]
        .filter(Boolean)
        .join(' / '),
    )
    .join('\n')

  const skills = Array.from(
    new Set([
      ...formData.skills
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      ...nextGenerated.suggestedSkills,
    ]),
  )

  const achievements = formData.achievements
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  const languages = formData.languages
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const links = [formData.portfolio, formData.linkedin, formData.website].filter(Boolean)

  return [
    `# ${formData.fullName || 'Professional Profile'}`,
    formData.headline ? `Headline: ${formData.headline}` : '',
    [formData.email, formData.phone, formData.location].filter(Boolean).join(' | '),
    links.length ? `Links: ${links.join(' | ')}` : '',
    '',
    '## Summary',
    nextGenerated.summary,
    '',
    '## Core Skills',
    skills.map((skill) => `- ${skill}`).join('\n') || '- Skills pending.',
    '',
    '## Selected Achievements',
    achievements.map((item) => `- ${item}`).join('\n') || '- Achievements pending.',
    '',
    '## Experience',
    experienceSection || '- Experience details pending.',
    '',
    '## Projects',
    projectSection || '- Project details pending.',
    '',
    '## Education',
    educationSection || '- Education details pending.',
    '',
    '## Certifications',
    certificationSection || '- Certifications pending.',
    '',
    '## Languages',
    languages.map((item) => `- ${item}`).join('\n') || '- Languages pending.',
  ].join('\n')
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getSafeCvFileName = (name: string) =>
  (name || 'jobwahala-cv')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'jobwahala-cv'

const getCvTemplateTheme = (template: CvTemplate) => {
  if (template === 'studio') {
    return {
      shellClassName: 'rounded-[2.5rem] border border-primary/10 bg-white shadow-premium-2xl overflow-hidden',
      headerClassName: 'bg-[radial-gradient(circle_at_top_left,_rgba(58,99,245,0.95),_rgba(15,23,42,0.98)_60%)] p-16 text-white text-center',
      sectionSpacingClassName: 'p-16 space-y-14',
      sectionCardClassName: 'space-y-3 rounded-[1.8rem] border border-primary/10 bg-primary/5 p-5',
      chipClassName: 'rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/85',
    }
  }

  if (template === 'compact') {
    return {
      shellClassName: 'rounded-[2rem] border border-surface-border bg-white shadow-premium-xl overflow-hidden',
      headerClassName: 'bg-surface-alt p-12 text-center text-text-main border-b border-surface-border',
      sectionSpacingClassName: 'p-10 space-y-10',
      sectionCardClassName: 'space-y-3 rounded-[1.2rem] border border-surface-border bg-surface-alt/20 p-4',
      chipClassName: 'rounded-full border border-surface-border bg-surface-alt/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-text-main',
    }
  }

  return {
    shellClassName: 'rounded-[2.5rem] border border-surface-border bg-white shadow-premium-2xl overflow-hidden',
    headerClassName: 'bg-text-main p-16 text-white text-center',
    sectionSpacingClassName: 'p-16 space-y-16',
    sectionCardClassName: 'space-y-3 rounded-[1.6rem] border border-surface-border bg-surface-alt/20 p-5',
    chipClassName: 'rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80',
  }
}

const convertMarkdownToPrintHtml = (content: string) => {
  const lines = content.split('\n')
  const html: string[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    html.push(`<ul>${listBuffer.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)
    listBuffer = []
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim()

    if (!line) {
      flushList()
      return
    }

    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2))
      return
    }

    flushList()

    if (line.startsWith('### ')) {
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`)
      return
    }

    if (line.startsWith('## ')) {
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`)
      return
    }

    if (line.startsWith('# ')) {
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`)
      return
    }

    html.push(`<p>${escapeHtml(line)}</p>`)
  })

  flushList()
  return html.join('')
}

const buildCvHtmlDocument = (title: string, content: string, template: CvTemplate) => {
  const theme =
    template === 'studio'
      ? {
          bodyBackground: '#f4f7ff',
          bodyPadding: '32px',
          cardBorder: '#dbe3f0',
          headerBackground: 'radial-gradient(circle at top left, rgba(58,99,245,0.95), rgba(15,23,42,0.98) 60%)',
          headerColor: '#ffffff',
          sectionCardBackground: '#f8fbff',
        }
      : template === 'compact'
        ? {
            bodyBackground: '#f8fafc',
            bodyPadding: '24px',
            cardBorder: '#d7dee8',
            headerBackground: '#eef2f7',
            headerColor: '#0f172a',
            sectionCardBackground: '#f8fafc',
          }
        : {
            bodyBackground: '#f4f7fb',
            bodyPadding: '32px',
            cardBorder: '#dbe3f0',
            headerBackground: '#0f172a',
            headerColor: '#ffffff',
            sectionCardBackground: '#f8fafc',
          }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: ${theme.bodyPadding}; line-height: 1.6; background: ${theme.bodyBackground}; }
      .cv-shell { background: #ffffff; border: 1px solid ${theme.cardBorder}; border-radius: 24px; overflow: hidden; }
      .cv-header { padding: 48px; text-align: center; background: ${theme.headerBackground}; color: ${theme.headerColor}; }
      .cv-body { padding: 48px; }
      .cv-card { background: ${theme.sectionCardBackground}; border: 1px solid ${theme.cardBorder}; border-radius: 18px; padding: 18px; }
      h1 { font-size: 28px; margin: 0 0 18px; }
      h2 { font-size: 13px; letter-spacing: 0.25em; text-transform: uppercase; margin: 30px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #dbe3f0; }
      h3 { font-size: 18px; margin: 22px 0 8px; }
      p { margin: 0 0 12px; white-space: pre-wrap; }
      ul { margin: 0 0 16px 20px; padding: 0; }
      li { margin-bottom: 6px; }
    </style>
  </head>
  <body><div class="cv-shell"><div class="cv-body">${convertMarkdownToPrintHtml(content)}</div></div></body>
</html>`
}

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const downloadBlobFile = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

type ParsedCvBlock =
  | { kind: 'heading2'; text: string; body: string[] }
  | { kind: 'heading3'; text: string; body: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string }

const parseCvMarkdownBlocks = (content: string): ParsedCvBlock[] => {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  const metadataPrefixes = ['Headline:', 'Links:', 'Portfolio:', 'LinkedIn:', 'Website:']

  return blocks.reduce<ParsedCvBlock[]>((acc, block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) return acc

    const firstLine = lines[0]

    if (
      firstLine.startsWith('# ') ||
      lines.every((line) => metadataPrefixes.some((prefix) => line.startsWith(prefix))) ||
      (lines.length <= 2 && lines.every((line) => metadataPrefixes.some((prefix) => line.startsWith(prefix)) || line.includes('|')))
    ) {
      return acc
    }

    if (lines.every((line) => line.startsWith('- '))) {
      acc.push({ kind: 'list', items: lines.map((line) => line.slice(2)) })
      return acc
    }

    if (firstLine.startsWith('## ')) {
      acc.push({ kind: 'heading2', text: firstLine.slice(3), body: lines.slice(1) })
      return acc
    }

    if (firstLine.startsWith('### ')) {
      acc.push({ kind: 'heading3', text: firstLine.slice(4), body: lines.slice(1) })
      return acc
    }

    acc.push({ kind: 'paragraph', text: lines.join(' ') })
    return acc
  }, [])
}

const getDocxTheme = (template: CvTemplate) => {
  if (template === 'studio') {
    return {
      primary: '2563EB',
      secondary: '475569',
      subtle: 'E2E8F0',
      headingSize: 38,
      compact: false,
    }
  }

  if (template === 'compact') {
    return {
      primary: '0F172A',
      secondary: '475569',
      subtle: 'CBD5E1',
      headingSize: 32,
      compact: true,
    }
  }

  return {
    primary: '0F172A',
    secondary: '334155',
    subtle: 'D7DEE8',
    headingSize: 40,
    compact: false,
  }
}

const buildCvDocxDocument = (
  previewHeader: ReturnType<typeof getPreviewHeader>,
  content: string,
  template: CvTemplate,
) => {
  const theme = getDocxTheme(template)
  const blocks = parseCvMarkdownBlocks(content)

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: previewHeader.heading,
          bold: true,
          color: theme.primary,
          size: theme.headingSize,
        }),
      ],
    }),
  ]

  if (previewHeader.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: previewHeader.subtitle,
            bold: true,
            color: theme.secondary,
            size: 22,
          }),
        ],
      }),
    )
  }

  if (previewHeader.contacts.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: previewHeader.contacts.join(' | '),
            color: theme.secondary,
            size: 20,
          }),
        ],
      }),
    )
  }

  if (previewHeader.links.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: previewHeader.links.join(' | '),
            color: '2563EB',
            size: 18,
          }),
        ],
      }),
    )
  }

  children.push(
    new Paragraph({
      border: {
        bottom: {
          color: theme.subtle,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { after: theme.compact ? 160 : 220 },
    }),
  )

  blocks.forEach((block) => {
    if (block.kind === 'heading2') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: theme.compact ? 160 : 220, after: 100 },
          border: {
            bottom: {
              color: theme.subtle,
              style: BorderStyle.SINGLE,
              size: 4,
            },
          },
          children: [new TextRun({ text: block.text, bold: true, color: theme.primary })],
        }),
      )

      block.body.forEach((line) => {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: line, color: '1E293B', size: 22 })],
          }),
        )
      })
      return
    }

    if (block.kind === 'heading3') {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [new TextRun({ text: block.text, bold: true, color: theme.secondary, size: 24 })],
        }),
      )
      block.body.forEach((line) => {
        children.push(
          new Paragraph({
            spacing: { after: 70 },
            indent: { left: 180 },
            children: [new TextRun({ text: line, color: '334155', size: 21 })],
          }),
        )
      })
      return
    }

    if (block.kind === 'list') {
      block.items.forEach((item) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text: item, color: '1E293B', size: 21 })],
          }),
        )
      })
      return
    }

    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: block.text, color: '1E293B', size: 22 })],
      }),
    )
  })

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
}

const renderMarkdownPreview = (
  content: string,
  theme: ReturnType<typeof getCvTemplateTheme>,
) => {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)

    if (lines.length === 0) {
      return null
    }

    const firstLine = lines[0]

    const metadataPrefixes = ['Headline:', 'Links:', 'Portfolio:', 'LinkedIn:', 'Website:']
    if (
      firstLine?.startsWith('# ') ||
      lines.every((line) => metadataPrefixes.some((prefix) => line.startsWith(prefix))) ||
      (lines.length <= 2 && lines.every((line) => metadataPrefixes.some((prefix) => line.startsWith(prefix)) || line.includes('|')))
    ) {
      return null
    }

    if (lines.every((line) => line.startsWith('- '))) {
      return (
        <ul key={`list-${index}`} className="space-y-3 pl-5 text-base font-medium leading-8 text-text-main">
          {lines.map((line, itemIndex) => (
            <li key={`item-${index}-${itemIndex}`}>{line.slice(2)}</li>
          ))}
        </ul>
      )
    }

    if (firstLine.startsWith('# ')) {
      return (
        <section key={`h1-${index}`} className="space-y-4">
          <h2 className="text-3xl font-black tracking-tight text-text-main">{firstLine.slice(2)}</h2>
          {lines.slice(1).length ? (
            <p className="text-base font-medium leading-8 text-text-muted">{lines.slice(1).join(' ')}</p>
          ) : null}
        </section>
      )
    }

    if (firstLine.startsWith('## ')) {
      return (
        <section key={`h2-${index}`} className="space-y-4">
          <h3 className="border-b border-surface-border pb-3 text-[10px] font-black uppercase tracking-[0.3em] text-text-light">
            {firstLine.slice(3)}
          </h3>
          <div className="space-y-3">
            {lines.slice(1).map((line, lineIndex) => (
              <p key={`p-${index}-${lineIndex}`} className="text-base font-medium leading-8 text-text-main">
                {line}
              </p>
            ))}
          </div>
        </section>
      )
    }

    if (firstLine.startsWith('### ')) {
      return (
        <section key={`h3-${index}`} className={theme.sectionCardClassName}>
          <h4 className="text-xl font-black tracking-tight text-text-main">{firstLine.slice(4)}</h4>
          {lines.slice(1).map((line, lineIndex) => (
            <p key={`detail-${index}-${lineIndex}`} className="text-base font-medium leading-8 text-text-muted">
              {line}
            </p>
          ))}
        </section>
      )
    }

    return (
      <p key={`paragraph-${index}`} className="text-base font-medium leading-8 text-text-main">
        {lines.join(' ')}
      </p>
    )
  })
}

const getPreviewHeader = (
  content: string,
  fallback: {
    fullName: string
    headline: string
    email: string
    phone: string
    location: string
    website: string
    linkedin: string
    portfolio: string
  },
) => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const headingLine = lines.find((line) => line.startsWith('# '))
  const heading = headingLine?.slice(2).trim() || fallback.fullName || 'Professional Identity'
  const subtitleLine = lines.find((line) => line.startsWith('Headline:'))
  const linksLine = lines.find((line) => line.startsWith('Links:'))
  const lineAfterHeading = headingLine
    ? lines.slice(lines.indexOf(headingLine) + 1)
    : lines
  const contactLine =
    lineAfterHeading.find((line) => line.includes('|') && !line.startsWith('Links:') && !line.startsWith('Headline:')) ||
    [fallback.email, fallback.phone, fallback.location].filter(Boolean).join(' | ')

  const contacts = contactLine
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)

  const links = (linksLine?.replace(/^Links:\s*/i, '') || [fallback.portfolio, fallback.linkedin, fallback.website].filter(Boolean).join(' | '))
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    heading,
    subtitle: subtitleLine?.replace(/^Headline:\s*/i, '').trim() || fallback.headline || '',
    contacts: contacts.length ? contacts : ['Contact details pending'],
    links,
  }
}

export default function CVGenerator() {
  const { role, user, userEmail } = useAuth()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    linkedin: '',
    portfolio: '',
    summary: '',
    achievements: '',
    languages: '',
    education: [emptyEducation] as EducationEntry[],
    experience: [emptyExperience] as ExperienceEntry[],
    projects: [emptyProject] as ProjectEntry[],
    certifications: [emptyCertification] as CertificationEntry[],
    skills: '',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [generatedContent, setGeneratedContent] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [history, setHistory] = useState<CvHistoryRecord[]>([])
  const [selectedCvId, setSelectedCvId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<CvTemplate>('executive')
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [optimization, setOptimization] = useState<ProfileOptimization | null>(null)
  const [isOptimizationLoading, setIsOptimizationLoading] = useState(false)
  const [optimizationError, setOptimizationError] = useState('')
  const hasPrefilledProfile = useRef(false)

  const loadHistory = async () => {
    if (role !== 'SEEKER') {
      setHistory([])
      return
    }

    setIsHistoryLoading(true)
    setHistoryError('')

    try {
      const data = await apiGetMyCVs()
      setHistory((data.cvs || []) as CvHistoryRecord[])
    } catch (err: any) {
      setHistoryError(err.message || 'Unable to load your CV history right now.')
    } finally {
      setIsHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [role])

  const loadOptimization = async () => {
    if (role !== 'SEEKER') {
      setOptimization(null)
      setOptimizationError('')
      return
    }

    setIsOptimizationLoading(true)
    setOptimizationError('')

    try {
      const data = await apiGetProfileOptimization()
      setOptimization((data.optimization || null) as ProfileOptimization | null)
    } catch (err: any) {
      setOptimization(null)
      setOptimizationError(err.message || 'Unable to load your coaching suggestions right now.')
    } finally {
      setIsOptimizationLoading(false)
    }
  }

  useEffect(() => {
    void loadOptimization()
  }, [role])

  useEffect(() => {
    if (role !== 'SEEKER' || !user || hasPrefilledProfile.current) {
      return
    }

    const fullName = [user.jobSeekerProfile?.firstName, user.jobSeekerProfile?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()

    setFormData((current) => ({
      ...current,
      fullName: current.fullName || fullName,
      headline: current.headline || 'Job Seeker',
      email: current.email || userEmail || user.email || '',
      summary: current.summary || user.jobSeekerProfile?.experience || '',
      skills: current.skills || user.jobSeekerProfile?.skills || '',
    }))

    hasPrefilledProfile.current = true
  }, [role, user, userEmail])

  const mergeSuggestedSkills = () => {
    if (!optimization?.suggestedSkills?.length) return

    const nextSkills = [
      ...formData.skills.split(',').map((item) => item.trim()).filter(Boolean),
      ...optimization.suggestedSkills,
    ]

    const uniqueSkills = nextSkills.filter(
      (skill, index) =>
        nextSkills.findIndex((candidate) => candidate.toLowerCase() === skill.toLowerCase()) === index,
    )

    setFormData((prev) => ({
      ...prev,
      skills: uniqueSkills.join(', '),
    }))
    setSaveStatus('Suggested skills were merged into your CV draft inputs.')
  }

  const applySuggestedSummary = () => {
    if (!optimization?.suggestedSummary) return

    setFormData((prev) => ({
      ...prev,
      summary: optimization.suggestedSummary,
    }))
    setSaveStatus('Suggested summary applied to your CV draft inputs.')
  }

  const addExperience = () => {
    setFormData((prev) => ({
      ...prev,
      experience: [...prev.experience, { ...emptyExperience }],
    }))
  }

  const removeExperience = (index: number) => {
    if (formData.experience.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }))
  }

  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [...prev.education, { ...emptyEducation }],
    }))
  }

  const removeEducation = (index: number) => {
    if (formData.education.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }))
  }

  const addProject = () => {
    setFormData((prev) => ({
      ...prev,
      projects: [...prev.projects, { ...emptyProject }],
    }))
  }

  const removeProject = (index: number) => {
    if (formData.projects.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }))
  }

  const addCertification = () => {
    setFormData((prev) => ({
      ...prev,
      certifications: [...prev.certifications, { ...emptyCertification }],
    }))
  }

  const removeCertification = (index: number) => {
    if (formData.certifications.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }))
  }

  const seekerPrompt = useMemo(() => {
    const experienceLines = formData.experience
      .filter((exp) => exp.company || exp.role || exp.period || exp.description)
      .map((exp, index) => {
        return [
          `Experience ${index + 1}:`,
          `Company: ${exp.company || 'Not provided'}`,
          `Role: ${exp.role || 'Not provided'}`,
          `Period: ${exp.period || 'Not provided'}`,
          `Details: ${exp.description || 'Not provided'}`,
        ].join('\n')
      })
      .join('\n\n')

    const educationLines = formData.education
      .filter((edu) => edu.school || edu.degree || edu.year)
      .map((edu, index) => {
        return [
          `Education ${index + 1}:`,
          `School: ${edu.school || 'Not provided'}`,
          `Degree: ${edu.degree || 'Not provided'}`,
          `Year: ${edu.year || 'Not provided'}`,
        ].join('\n')
      })
      .join('\n\n')

    const projectLines = formData.projects
      .filter((project) => project.name || project.role || project.stack || project.link || project.description)
      .map((project, index) =>
        [
          `Project ${index + 1}:`,
          `Name: ${project.name || 'Not provided'}`,
          `Role: ${project.role || 'Not provided'}`,
          `Stack: ${project.stack || 'Not provided'}`,
          `Link: ${project.link || 'Not provided'}`,
          `Impact: ${project.description || 'Not provided'}`,
        ].join('\n'),
      )
      .join('\n\n')

    const certificationLines = formData.certifications
      .filter((certification) => certification.name || certification.issuer || certification.year || certification.link)
      .map((certification, index) =>
        [
          `Certification ${index + 1}:`,
          `Name: ${certification.name || 'Not provided'}`,
          `Issuer: ${certification.issuer || 'Not provided'}`,
          `Year: ${certification.year || 'Not provided'}`,
          `Link: ${certification.link || 'Not provided'}`,
        ].join('\n'),
      )
      .join('\n\n')

    return [
      `Candidate name: ${formData.fullName || 'Not provided'}`,
      `Professional headline: ${formData.headline || 'Not provided'}`,
      `Email: ${formData.email || 'Not provided'}`,
      `Phone: ${formData.phone || 'Not provided'}`,
      `Location: ${formData.location || 'Not provided'}`,
      `Website: ${formData.website || 'Not provided'}`,
      `LinkedIn: ${formData.linkedin || 'Not provided'}`,
      `Portfolio: ${formData.portfolio || 'Not provided'}`,
      `Professional summary: ${formData.summary || 'Not provided'}`,
      `Achievements: ${formData.achievements || 'Not provided'}`,
      `Languages: ${formData.languages || 'Not provided'}`,
      `Skills: ${formData.skills || 'Not provided'}`,
      '',
      experienceLines || 'No experience details provided.',
      '',
      projectLines || 'No project details provided.',
      '',
      educationLines || 'No education details provided.',
      '',
      certificationLines || 'No certification details provided.',
      '',
      'Generate a modern ATS-friendly CV in Markdown with these sections when data is available: Summary, Core Skills, Selected Achievements, Experience, Projects, Education, Certifications, and Languages. Keep formatting clean, professional, and recruiter-ready.',
    ].join('\n')
  }, [formData])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setSaveStatus('')
    setStep(2)

    try {
      if (role === 'SEEKER') {
        const data = await apiSaveCVGeneration(seekerPrompt)
        const nextCv = data.cv as CvHistoryRecord

        setGeneratedData(null)
        setGeneratedContent(nextCv.content)
        setSelectedCvId(nextCv.id)
        setSaveStatus('Generated by the backend and saved to your CV history.')
        await loadHistory()
      } else {
        const nextGenerated = {
          summary:
            formData.summary ||
            `Strategic and results-driven ${formData.experience[0].role || 'Professional'} with a proven track record of excellence at ${
              formData.experience[0].company || 'top-tier organizations'
            }. Expert in ${formData.skills || 'industry-standard tools'} and dedicated to driving technical innovation and operational efficiency.`,
          optimizedExp: formData.experience.map(
            (exp) =>
              exp.description ||
              `Spearheaded ${exp.role || 'key'} initiatives at ${exp.company || 'the organization'}, resulting in measurable improvements through disciplined execution and cross-functional collaboration.`,
          ),
          suggestedSkills: ['Agile Delivery', 'Strategic Planning', 'Cross-functional Leadership', 'Systems Thinking', 'Stakeholder Communication'],
        }

        setGeneratedData(nextGenerated)
        setGeneratedContent(buildLocalCvMarkdown(formData, nextGenerated))
        setSelectedCvId(null)
        setSaveStatus('Generated locally. Backend AI generation is enabled for seeker accounts.')
      }
    } catch (err: any) {
      setSaveStatus(err.message || 'Unable to generate your CV right now.')
      setStep(1)
      return
    } finally {
      setIsGenerating(false)
    }

    setStep(3)
  }

  const handleDownload = () => {
    const draftContent = previewText.trim()
    if (!draftContent) {
      setSaveStatus('Generate or load a CV draft before exporting it.')
      return
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=1080')
    if (!printWindow) {
      setSaveStatus('Popup access was blocked. Allow popups to export this CV as PDF.')
      return
    }

    const title = previewHeader.heading || formData.fullName || 'JobWahala CV Draft'
    const htmlDocument = buildCvHtmlDocument(title, draftContent, selectedTemplate)

    printWindow.document.write(htmlDocument)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setSaveStatus('Print dialog opened. Use Save as PDF to export your CV.')
  }

  const previewText = formatGeneratedDocument(generatedContent)
  const previewHeader = getPreviewHeader(previewText, formData)
  const selectedTemplateTheme = getCvTemplateTheme(selectedTemplate)

  const handleDownloadMarkdown = () => {
    const draftContent = previewText.trim()
    if (!draftContent) {
      setSaveStatus('Generate or load a CV draft before downloading it.')
      return
    }

    downloadTextFile(`${getSafeCvFileName(previewHeader.heading)}.md`, draftContent, 'text/markdown;charset=utf-8')
    setSaveStatus('Markdown CV downloaded.')
  }

  const handleDownloadHtml = () => {
    const draftContent = previewText.trim()
    if (!draftContent) {
      setSaveStatus('Generate or load a CV draft before downloading it.')
      return
    }

    downloadTextFile(
      `${getSafeCvFileName(previewHeader.heading)}.html`,
      buildCvHtmlDocument(previewHeader.heading || 'JobWahala CV Draft', draftContent, selectedTemplate),
      'text/html;charset=utf-8',
    )
    setSaveStatus('HTML CV downloaded.')
  }

  const handleDownloadWord = () => {
    const draftContent = previewText.trim()
    if (!draftContent) {
      setSaveStatus('Generate or load a CV draft before downloading it.')
      return
    }

    void Packer.toBlob(buildCvDocxDocument(previewHeader, draftContent, selectedTemplate))
      .then((blob) => {
        downloadBlobFile(`${getSafeCvFileName(previewHeader.heading)}.docx`, blob)
        setSaveStatus('DOCX CV downloaded.')
      })
      .catch(() => {
        setSaveStatus('Unable to generate a DOCX file right now.')
      })
  }

  const handleCopy = async () => {
    if (!previewText.trim()) {
      setSaveStatus('Generate or load a CV draft before copying it.')
      return
    }

    await navigator.clipboard.writeText(previewText)
    setSaveStatus('Current CV draft copied to clipboard.')
  }

  const handleLoadHistory = async (record: CvHistoryRecord) => {
    setHistoryLoadingId(record.id)
    setHistoryError('')

    try {
      const data = await apiGetCVById(record.id)
      const nextCv = (data.cv || record) as CvHistoryRecord
      setSelectedCvId(nextCv.id)
      setGeneratedContent(nextCv.content)
      setGeneratedData(null)
      setSaveStatus('Loaded a saved CV draft from your history.')
      setStep(3)
    } catch (err: any) {
      setHistoryError(err.message || 'Unable to load that saved CV draft right now.')
    } finally {
      setHistoryLoadingId(null)
    }
  }

  const handleStartOver = () => {
    setStep(1)
    setGeneratedData(null)
    setGeneratedContent('')
    setSelectedCvId(null)
    setSaveStatus('')
  }

  const renderForm = () => (
    <div className="dashboard-panel animate-in fade-in slide-in-from-bottom-4 space-y-10 p-5 duration-700 no-print sm:p-7 lg:p-8">
      {role === 'SEEKER' ? (
        <div className="rounded-[1.9rem] border border-primary/10 bg-primary/5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="dashboard-kicker mb-3">
                <Sparkles className="h-3.5 w-3.5" /> AI profile coach
              </div>
              <h3 className="text-xl font-black tracking-tight text-text-main">
                {optimization?.headline || 'Sharpen your CV inputs before generating the next draft.'}
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-text-muted">
                {isOptimizationLoading
                  ? 'Loading coaching suggestions from your seeker profile, saved CV drafts, and live match signals.'
                  : optimizationError || optimization?.nextCvPrompt || 'Use the coaching panel to improve your summary, skills, and target-role focus.'}
              </p>
            </div>
            <div className="dashboard-panel min-w-[9rem] px-4 py-4 text-center">
              <p className="text-3xl font-black text-text-main">{optimization?.score ?? profileScoreFallback(formData)}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Coach Score</p>
            </div>
          </div>

          {optimization ? (
            <>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Strengths</h4>
                  <div className="mt-3 space-y-2">
                    {optimization.strengths.slice(0, 2).map((item) => (
                      <p key={item} className="text-sm font-medium leading-relaxed text-text-main">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Upgrades</h4>
                  <div className="mt-3 space-y-2">
                    {optimization.improvements.slice(0, 2).map((item) => (
                      <p key={item} className="text-sm font-medium leading-relaxed text-text-main">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {optimization.targetRoles.length > 0 ? (
                <div className="mt-5">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Target Roles</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {optimization.targetRoles.slice(0, 3).map((roleTitle) => (
                      <span
                        key={roleTitle}
                        className="rounded-full border border-primary/10 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary"
                      >
                        {roleTitle}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={applySuggestedSummary}
                  className="btn btn-primary btn-sm uppercase tracking-widest font-black text-[10px]"
                >
                  Use Suggested Summary
                </button>
                <button
                  type="button"
                  onClick={mergeSuggestedSkills}
                  className="btn btn-outline btn-sm bg-white uppercase tracking-widest font-black text-[10px]"
                >
                  Merge Suggested Skills
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Professional Identity</label>
          <input
            type="text"
            placeholder="Full Name"
            className="h-14 font-bold"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
          <input
            type="text"
            placeholder="Headline (e.g. Frontend Engineer)"
            className="h-14 font-bold"
            value={formData.headline}
            onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email Address"
            className="h-14 font-bold"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <input
            type="text"
            placeholder="Phone Number"
            className="h-14 font-bold"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div className="space-y-6">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Contact Links</label>
          <input
            type="text"
            placeholder="Location (e.g. Accra, Ghana)"
            className="h-14 font-bold"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
          <input
            type="text"
            placeholder="Portfolio URL"
            className="h-14 font-bold"
            value={formData.portfolio}
            onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
          />
          <input
            type="text"
            placeholder="LinkedIn URL"
            className="h-14 font-bold"
            value={formData.linkedin}
            onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
          />
          <input
            type="text"
            placeholder="Website URL"
            className="h-14 font-bold"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light block">Professional Summary</label>
        <textarea
          placeholder="Summarize your professional value, focus areas, and strongest results..."
          className="min-h-[140px] font-bold py-4"
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Selected Achievements</label>
          <textarea
            placeholder="One achievement per line. Example: Increased checkout conversion by 18%."
            className="min-h-[150px] font-bold py-4"
            value={formData.achievements}
            onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
          />
        </div>
        <div className="space-y-6">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-text-light">Skills & Languages</label>
          <textarea
            placeholder="Core skills separated by commas..."
            className="min-h-[110px] font-bold py-4"
            value={formData.skills}
            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
          />
          <input
            type="text"
            placeholder="Languages (e.g. English, Twi, French)"
            className="h-14 font-bold"
            value={formData.languages}
            onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex justify-between items-center border-b border-surface-border pb-4">
          <h3 className="font-black text-lg tracking-tight text-text-main flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-primary" /> Career Trajectory
          </h3>
          <button
            type="button"
            onClick={addExperience}
            className="text-primary font-black text-[10px] uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            <Plus className="h-3 w-3" /> Add Milestone
          </button>
        </div>
        {formData.experience.map((exp, index) => (
          <div key={index} className="relative space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <input
                type="text"
                placeholder="Company"
                className="h-12 text-sm font-bold"
                value={exp.company}
                onChange={(e) => {
                  const next = [...formData.experience]
                  next[index].company = e.target.value
                  setFormData({ ...formData, experience: next })
                }}
              />
              <input
                type="text"
                placeholder="Role"
                className="h-12 text-sm font-bold"
                value={exp.role}
                onChange={(e) => {
                  const next = [...formData.experience]
                  next[index].role = e.target.value
                  setFormData({ ...formData, experience: next })
                }}
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Period"
                  className="h-12 text-sm font-bold flex-grow"
                  value={exp.period}
                  onChange={(e) => {
                    const next = [...formData.experience]
                    next[index].period = e.target.value
                    setFormData({ ...formData, experience: next })
                  }}
                />
                {formData.experience.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeExperience(index)}
                    className="h-12 w-12 flex-shrink-0 rounded-xl bg-error/5 text-error hover:bg-error/10 flex items-center justify-center transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <textarea
              placeholder="What did you do, improve, ship, or lead in this role?"
              className="min-h-[100px] font-bold py-4"
              value={exp.description}
              onChange={(e) => {
                const next = [...formData.experience]
                next[index].description = e.target.value
                setFormData({ ...formData, experience: next })
              }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <h3 className="flex items-center gap-3 text-lg font-black tracking-tight text-text-main">
            <Layout className="h-5 w-5 text-primary" /> Projects
          </h3>
          <button
            type="button"
            onClick={addProject}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary transition-opacity hover:opacity-70"
          >
            <Plus className="h-3 w-3" /> Add Project
          </button>
        </div>
        {formData.projects.map((project, index) => (
          <div key={index} className="space-y-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <input
                type="text"
                placeholder="Project Name"
                className="h-12 text-sm font-bold"
                value={project.name}
                onChange={(e) => {
                  const next = [...formData.projects]
                  next[index].name = e.target.value
                  setFormData({ ...formData, projects: next })
                }}
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Role on Project"
                  className="h-12 flex-grow text-sm font-bold"
                  value={project.role}
                  onChange={(e) => {
                    const next = [...formData.projects]
                    next[index].role = e.target.value
                    setFormData({ ...formData, projects: next })
                  }}
                />
                {formData.projects.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeProject(index)}
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-error/5 text-error transition-all hover:bg-error/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <input
                type="text"
                placeholder="Stack / tools used"
                className="h-12 text-sm font-bold"
                value={project.stack}
                onChange={(e) => {
                  const next = [...formData.projects]
                  next[index].stack = e.target.value
                  setFormData({ ...formData, projects: next })
                }}
              />
              <input
                type="text"
                placeholder="Project Link"
                className="h-12 text-sm font-bold"
                value={project.link}
                onChange={(e) => {
                  const next = [...formData.projects]
                  next[index].link = e.target.value
                  setFormData({ ...formData, projects: next })
                }}
              />
            </div>
            <textarea
              placeholder="Describe the project outcome, your contribution, and impact."
              className="min-h-[110px] font-bold py-4"
              value={project.description}
              onChange={(e) => {
                const next = [...formData.projects]
                next[index].description = e.target.value
                setFormData({ ...formData, projects: next })
              }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-8">
        <div className="flex justify-between items-center border-b border-surface-border pb-4">
          <h3 className="font-black text-lg tracking-tight text-text-main flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-secondary" /> Education
          </h3>
          <button
            type="button"
            onClick={addEducation}
            className="text-secondary font-black text-[10px] uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            <Plus className="h-3 w-3" /> Add Entry
          </button>
        </div>
        {formData.education.map((edu, index) => (
          <div key={index} className="relative">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <input
                type="text"
                placeholder="School"
                className="h-12 text-sm font-bold"
                value={edu.school}
                onChange={(e) => {
                  const next = [...formData.education]
                  next[index].school = e.target.value
                  setFormData({ ...formData, education: next })
                }}
              />
              <input
                type="text"
                placeholder="Degree"
                className="h-12 text-sm font-bold"
                value={edu.degree}
                onChange={(e) => {
                  const next = [...formData.education]
                  next[index].degree = e.target.value
                  setFormData({ ...formData, education: next })
                }}
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Year"
                  className="h-12 text-sm font-bold flex-grow"
                  value={edu.year}
                  onChange={(e) => {
                    const next = [...formData.education]
                    next[index].year = e.target.value
                    setFormData({ ...formData, education: next })
                  }}
                />
                {formData.education.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeEducation(index)}
                    className="h-12 w-12 flex-shrink-0 rounded-xl bg-error/5 text-error hover:bg-error/10 flex items-center justify-center transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <h3 className="flex items-center gap-3 text-lg font-black tracking-tight text-text-main">
            <FileText className="h-5 w-5 text-secondary" /> Certifications
          </h3>
          <button
            type="button"
            onClick={addCertification}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-secondary transition-opacity hover:opacity-70"
          >
            <Plus className="h-3 w-3" /> Add Certification
          </button>
        </div>
        {formData.certifications.map((certification, index) => (
          <div key={index} className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <input
              type="text"
              placeholder="Certification Name"
              className="h-12 text-sm font-bold"
              value={certification.name}
              onChange={(e) => {
                const next = [...formData.certifications]
                next[index].name = e.target.value
                setFormData({ ...formData, certifications: next })
              }}
            />
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Issuer"
                className="h-12 flex-grow text-sm font-bold"
                value={certification.issuer}
                onChange={(e) => {
                  const next = [...formData.certifications]
                  next[index].issuer = e.target.value
                  setFormData({ ...formData, certifications: next })
                }}
              />
              {formData.certifications.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeCertification(index)}
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-error/5 text-error transition-all hover:bg-error/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <input
              type="text"
              placeholder="Year"
              className="h-12 text-sm font-bold"
              value={certification.year}
              onChange={(e) => {
                const next = [...formData.certifications]
                next[index].year = e.target.value
                setFormData({ ...formData, certifications: next })
              }}
            />
            <input
              type="text"
              placeholder="Credential URL"
              className="h-12 text-sm font-bold"
              value={certification.link}
              onChange={(e) => {
                const next = [...formData.certifications]
                next[index].link = e.target.value
                setFormData({ ...formData, certifications: next })
              }}
            />
          </div>
        ))}
      </div>

      <div className="pt-8">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="btn btn-primary btn-lg w-full rounded-2xl shadow-primary/20 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest py-6"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-6 w-6 animate-spin" /> Synthesizing Professional Profile...
            </>
          ) : (
            <>
              <Wand2 className="h-6 w-6" /> Generate AI-Optimized CV
            </>
          )}
        </button>
      </div>
    </div>
  )

  const renderGenerating = () => (
    <div className="max-w-3xl mx-auto">
      <div className="dashboard-panel p-8 text-center no-print sm:p-12">
        <div className="h-16 w-16 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
        <h2 className="text-3xl font-black text-text-main tracking-tight mb-4">Building your CV draft</h2>
        <p className="text-base text-text-muted font-medium leading-relaxed">
          {role === 'SEEKER'
            ? 'The backend is generating and saving a new draft to your CV history.'
            : 'The local CV builder is preparing your preview.'}
        </p>
      </div>
    </div>
  )

  const renderPreview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-8" id="cv-preview">
        <div className={selectedTemplateTheme.shellClassName}>
          <header className={selectedTemplateTheme.headerClassName}>
            <h1 className="mb-4 text-5xl font-black tracking-tighter">{previewHeader.heading}</h1>
            {previewHeader.subtitle ? (
              <p className={`mb-5 text-sm font-black uppercase tracking-[0.3em] ${selectedTemplate === 'compact' ? 'text-text-muted' : 'text-white/80'}`}>
                {previewHeader.subtitle}
              </p>
            ) : null}
            <div className={`flex flex-wrap justify-center gap-6 text-sm font-bold ${selectedTemplate === 'compact' ? 'text-text-muted' : 'text-white/60'}`}>
              {previewHeader.contacts.map((contact, index) => (
                <div key={`${contact}-${index}`} className="flex items-center gap-6">
                  {index > 0 ? <div className={`h-1 w-1 rounded-full ${selectedTemplate === 'compact' ? 'bg-text-light/40' : 'bg-white/20'}`}></div> : null}
                  <span className="tracking-wider uppercase">{contact}</span>
                </div>
              ))}
            </div>
            {previewHeader.links.length ? (
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {previewHeader.links.map((link) => (
                  <span key={link} className={selectedTemplateTheme.chipClassName}>
                    {link}
                  </span>
                ))}
              </div>
            ) : null}
          </header>

          <div className={selectedTemplateTheme.sectionSpacingClassName}>
            <section>
              <div className="mb-8 flex items-center justify-between gap-4 border-b border-surface-border pb-4">
                <h2 className="text-[10px] font-black text-text-light uppercase tracking-[0.3em]">
                  {role === 'SEEKER' ? 'Saved CV Draft' : 'Generated CV Draft'}
                </h2>
                {selectedCvId ? (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Saved draft</span>
                ) : null}
              </div>
              <div className="space-y-8">
                {renderMarkdownPreview(previewText, selectedTemplateTheme)}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="lg:col-span-4 lg:pl-10 no-print">
        <div className="sticky top-28 space-y-8">
          <div className="dashboard-panel p-5 sm:p-6">
            <div className="mb-6 border-b border-surface-border/50 pb-4">
              <h3 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-text-main">
                <Layout className="h-4 w-4" /> Template Switcher
              </h3>
            </div>
            <div className="space-y-3">
              {cvTemplateOptions.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                    selectedTemplate === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-surface-border bg-surface-alt/20 hover:border-primary/30'
                  }`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-text-main">{template.label}</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-text-muted">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-panel relative overflow-hidden bg-surface-alt/30 p-5 sm:p-6">
            <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            <h3 className="font-black text-xs uppercase tracking-[0.2em] text-text-light mb-8 flex items-center gap-3">
              <Download className="h-4 w-4" /> Export Protocol
            </h3>
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleDownload}
                className="btn btn-primary btn-lg w-full rounded-2xl shadow-primary/20 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"
              >
                Print / Save PDF <FileText className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="btn btn-outline btn-lg w-full rounded-2xl bg-white flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"
              >
                Download HTML <Layout className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleDownloadWord}
                className="btn btn-outline btn-lg w-full rounded-2xl bg-white flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"
              >
                Download DOCX <FileText className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="btn btn-outline btn-lg w-full rounded-2xl bg-white flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"
              >
                Download Markdown <Download className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="btn btn-outline btn-lg w-full rounded-2xl bg-white flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"
              >
                Copy Draft <Copy className="h-5 w-5" />
              </button>
            </div>
            {saveStatus ? <p className="mt-4 text-xs font-bold text-text-muted leading-relaxed">{saveStatus}</p> : null}
          </div>

          {role === 'SEEKER' ? (
            <div className="dashboard-panel p-5 sm:p-6">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-surface-border/50">
                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-text-main flex items-center gap-3">
                  <History className="h-4 w-4" /> CV History
                </h3>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-primary"
                >
                  Refresh
                </button>
              </div>

              {isHistoryLoading ? <p className="text-sm font-semibold text-text-light">Loading history...</p> : null}
              {!isHistoryLoading && historyError ? <p className="text-sm font-semibold text-error">{historyError}</p> : null}
              {!isHistoryLoading && !historyError && history.length === 0 ? (
                <p className="text-sm font-semibold text-text-light">No saved CV drafts yet.</p>
              ) : null}

              {!isHistoryLoading && !historyError && history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => void handleLoadHistory(record)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        selectedCvId === record.id
                          ? 'border-primary bg-primary/5'
                          : 'border-surface-border bg-surface-alt/20 hover:border-primary/40'
                      }`}
                    >
                      <p className="text-xs font-black text-text-main leading-relaxed">
                        {record.prompt?.slice(0, 80) || 'Saved CV draft'}
                      </p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-light">
                        {historyLoadingId === record.id ? 'Loading draft...' : formatRelativeTime(record.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleStartOver}
            className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-text-light hover:text-primary transition-all flex items-center justify-center gap-3"
          >
            <RefreshCw className="h-4 w-4" /> Start Over
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="container pt-24 pb-24 md:pt-28 xl:pt-32">
      <section className="dashboard-hero mb-8 px-5 py-6 no-print sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="dashboard-kicker mb-4">
              <Sparkles className="h-3.5 w-3.5" /> AI-powered CV builder
            </div>
            <h1 className="mb-3 text-4xl font-black leading-tight tracking-tighter text-text-main md:text-5xl">
              AI career synthesis for polished, reusable drafts.
            </h1>
            <p className="text-base font-medium tracking-tight text-text-muted md:text-lg">
              Build a reusable CV draft from your profile details, experience, education, and skills, then save or export the result.
            </p>
          </div>

          <div className="dashboard-panel grid min-w-0 grid-cols-3 gap-3 px-5 py-5 sm:min-w-[20rem] sm:px-6">
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{history.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Drafts</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{step}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Step</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-4 text-center shadow-premium-sm">
              <p className="text-2xl font-black text-text-main">{role === 'SEEKER' ? 'AI' : 'LOCAL'}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-text-light">Mode</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex justify-center no-print">
          <div className="dashboard-panel flex items-center gap-3 p-2">
            {[
              { num: 1, icon: <User className="h-3.5 w-3.5" />, label: 'Details' },
              { num: 2, icon: <GraduationCap className="h-3.5 w-3.5" />, label: 'Generate' },
              { num: 3, icon: <Layout className="h-3.5 w-3.5" />, label: 'Preview' },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  step === s.num ? 'bg-text-main text-white shadow-lg' : step > s.num ? 'text-primary' : 'text-text-light'
                }`}
              >
                {s.icon}
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {step === 1 ? renderForm() : null}
        {step === 2 ? renderGenerating() : null}
        {step === 3 ? renderPreview() : null}
      </div>
    </div>
  )
}
