import type { PaymentActionItem, ApplicantDecisionBriefRecord, AgreementDecisionBriefRecord } from './types'

export const initialJobForm = {
  title: '',
  description: '',
  location: '',
  type: 'Full-time',
  salary: '',
  category: '',
}

export const applicationStatuses = ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW', 'REJECTED', 'HIRED']

export const getApplicationBadgeClass = (status: string) => {
  if (status === 'HIRED' || status === 'ACCEPTED') return 'bg-success text-white'
  if (status === 'REJECTED' || status === 'DECLINED' || status === 'CANCELLED') return 'bg-error text-white'
  if (status === 'INTERVIEW' || status === 'COMPLETED') return 'bg-secondary text-white'
  if (status === 'SHORTLISTED') return 'bg-accent text-white'
  return 'bg-primary text-white'
}

export const getPaymentActionBadgeClass = (action: PaymentActionItem['action']) => {
  return action === 'MARK_PAID' ? 'bg-success text-white' : 'bg-primary text-white'
}

export const getProposalBadgeClass = (status: string) => {
  if (status === 'ACCEPTED') return 'bg-success text-white'
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED') return 'bg-error text-white'
  if (status === 'COUNTERED') return 'bg-accent text-white'
  return 'bg-primary text-white'
}

export const getAgreementDecisionBadgeClass = (
  recommendation: AgreementDecisionBriefRecord['recommendation'],
) => {
  if (recommendation === 'COMPLETE') return 'bg-success text-white'
  if (recommendation === 'ESCALATE') return 'bg-error text-white'
  return 'bg-secondary text-white'
}

export const getApplicantDecisionBadgeClass = (
  recommendation: ApplicantDecisionBriefRecord['recommendation'],
) => {
  if (recommendation === 'HIRE') return 'bg-success text-white'
  if (recommendation === 'SEND_PROPOSAL') return 'bg-primary text-white'
  if (recommendation === 'INTERVIEW') return 'bg-secondary text-white'
  if (recommendation === 'SHORTLIST') return 'bg-accent text-white'
  return 'bg-surface-alt text-text-main'
}

export const getFitScoreBadgeClass = (score?: number) => {
  if (!score) return 'bg-surface-alt text-text-main'
  if (score >= 85) return 'bg-success text-white'
  if (score >= 70) return 'bg-primary text-white'
  if (score >= 55) return 'bg-secondary text-white'
  return 'bg-accent text-white'
}

export const getDisputeBadgeClass = (status: string) => {
  if (status === 'RESOLVED') return 'bg-success text-white'
  if (status === 'DISMISSED') return 'bg-surface-alt text-text-main'
  if (status === 'UNDER_REVIEW') return 'bg-secondary text-white'
  return 'bg-error text-white'
}
