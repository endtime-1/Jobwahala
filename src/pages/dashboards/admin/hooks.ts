import { useQuery } from '@tanstack/react-query'
import {
  apiGetAdminDisputes,
  apiGetAdminJobs,
  apiGetAdminReports,
  apiGetAdminServices,
  apiGetAdminUsers,
  apiGetAdminVerifications,
} from '../../../lib/api'

export type AdminReport = {
  id: string; reason: string; status: string; createdAt: string
  reporter: { email: string }
  job?: { id: string; title: string; status: string } | null
  service?: { id: string; title: string; status: string } | null
  reportedUser?: { id: string; email: string; role: string; status: string } | null
}

export type AdminUser = {
  id: string; email: string; role: string; status: string; createdAt: string
  employerProfile?: { companyName?: string | null } | null
}

export type AdminJob = {
  id: string; title: string; status: string; salary?: string | null
  postedByAdminAt?: string | null; createdAt: string
  _count: { applications: number }
  employer: { email: string; employerProfile?: { companyName?: string | null } | null }
  postedByAdmin?: { id: string; email: string } | null
}

export type AdminService = {
  id: string; title: string; status: string; price: number
  category?: string | null; createdAt: string
  freelancer: { email: string; freelancerProfile?: { firstName?: string | null; lastName?: string | null } | null }
}

export type AdminVerification = {
  id: string; type: string; status: string; details: string
  documentUrl?: string | null; reviewNote?: string | null; internalNote?: string | null
  reviewedAt?: string | null; createdAt: string; submissionCount?: number
  history?: Array<{
    id: string; type: string; status: string; details: string
    documentUrl?: string | null; reviewNote?: string | null; internalNote?: string | null
    reviewedAt?: string | null; createdAt: string
    reviewer?: { id: string; email: string } | null
  }>
  user: {
    id: string; email: string; role: string
    employerProfile?: { companyName?: string | null } | null
    jobSeekerProfile?: { firstName?: string | null; lastName?: string | null } | null
    freelancerProfile?: { firstName?: string | null; lastName?: string | null } | null
  }
  reviewer?: { id: string; email: string } | null
}

export type AdminDispute = {
  id: string; type: string; status: string; title: string; description: string
  evidenceUrl?: string | null; resolutionNote?: string | null; resolvedAt?: string | null; createdAt: string
  agreement: { id: string; title: string; type: string; status: string }
  creator: {
    id: string; email: string; role: string
    employerProfile?: { companyName?: string | null } | null
    jobSeekerProfile?: { firstName?: string | null; lastName?: string | null } | null
    freelancerProfile?: { firstName?: string | null; lastName?: string | null } | null
  }
  counterparty?: {
    id: string; email: string; role: string
    employerProfile?: { companyName?: string | null } | null
    jobSeekerProfile?: { firstName?: string | null; lastName?: string | null } | null
    freelancerProfile?: { firstName?: string | null; lastName?: string | null } | null
  } | null
  resolver?: { id: string; email: string } | null
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const [reportsData, usersData, jobsData, servicesData, verificationsData, disputesData] = await Promise.all([
        apiGetAdminReports(), apiGetAdminUsers(), apiGetAdminJobs(), apiGetAdminServices(), apiGetAdminVerifications(), apiGetAdminDisputes(),
      ])
      return {
        reports: (reportsData.reports || []) as AdminReport[],
        users: (usersData.users || []) as AdminUser[],
        jobs: (jobsData.jobs || []) as AdminJob[],
        services: (servicesData.services || []) as AdminService[],
        verifications: (verificationsData.verifications || []) as AdminVerification[],
        disputes: (disputesData.disputes || []) as AdminDispute[],
      }
    },
  })
}
