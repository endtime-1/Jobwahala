// ── AI Service barrel ─────────────────────────────────────────────────
// Re-exports every public symbol from the original monolithic aiService
// so consumers can import from '@/services/ai' or keep using 'aiService'.
//
// Phase 3 splits the monolith's 2,680 lines into domain-focused modules.
// For now, we re-export from the original file to maintain backward
// compatibility while the split is underway incrementally.

export {
  // CV
  generateCVFromPrompt,
  // Proposals
  generateProposalDraft,
  generateProposalComparisonSummary,
  generateProposalDecisionBrief,
  // Agreements
  generateAgreementComparisonSummary,
  generateAgreementDecisionBrief,
  // Employer / Job
  generateEmployerShortlistSummary,
  generateEmployerApplicantComparisonSummary,
  generateEmployerApplicantDecisionBrief,
  generateJobApplicationCoaching,
  generateJobPostOptimization,
  generateSeekerJobComparisonSummary,
  // Seeker
  generateSeekerProfileOptimization,
  // Service / Freelancer
  generateServiceOptimization,
  generateServiceRequestCoaching,
  generateServiceComparisonSummary,
  generateMarketplaceFreelancerComparisonSummary,
} from '../aiService'

// Types
export type {
  ProposalDraftContext,
  GeneratedProposalDraft,
  ProposalComparisonOptionContext,
  ProposalComparisonContext,
  ProposalDecisionBriefContext,
  GeneratedProposalDecisionBrief,
  AgreementComparisonOptionContext,
  AgreementComparisonContext,
  AgreementDecisionBriefContext,
  GeneratedAgreementDecisionBrief,
  ShortlistCandidateContext,
  SeekerProfileOptimizationContext,
  GeneratedSeekerProfileOptimization,
  JobApplicationCoachingContext,
  GeneratedJobApplicationCoaching,
  EmployerApplicantDecisionBriefContext,
  GeneratedEmployerApplicantDecisionBrief,
  SeekerJobComparisonOptionContext,
  SeekerJobComparisonContext,
  ServiceOptimizationContext,
  GeneratedServiceOptimization,
  JobPostOptimizationContext,
  GeneratedJobPostOptimization,
  ServiceRequestCoachingContext,
  GeneratedServiceRequestCoaching,
  ServiceComparisonOptionContext,
  ServiceComparisonSummaryContext,
  MarketplaceFreelancerComparisonContext,
} from '../aiService'
