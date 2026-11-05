import { API_UNAVAILABLE_MESSAGE, markApiHealthy, markApiUnreachable } from './apiStatus';

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '/api';

const fetch: typeof globalThis.fetch = async (input, init) => {
  try {
    const response = await globalThis.fetch(input, init);
    markApiHealthy();
    return response;
  } catch (error) {
    markApiUnreachable();

    if (error instanceof Error) {
      throw new Error(API_UNAVAILABLE_MESSAGE);
    }

    throw new Error(API_UNAVAILABLE_MESSAGE);
  }
};

const getToken = () => localStorage.getItem('jobwahala_token');

const headers = (withAuth = false): HeadersInit => {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const token = getToken();
    if (token) (h as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return h;
};

const handleResponse = async (res: Response) => {
  const text = await res.text();
  let data: any = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    // Keep the extra hints the server sends (how long to wait, how many tries are left).
    throw Object.assign(new Error(data.message || 'Something went wrong'), {
      retryAfterSeconds: data.retryAfterSeconds as number | undefined,
      attemptsLeft: data.attemptsLeft as number | undefined,
    });
  }
  return data;
};

// Auth
export const apiRegister = (email: string, password: string, role: string, captchaToken?: string) =>
  fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password, role, ...(captchaToken ? { captchaToken } : {}) }),
  }).then(handleResponse);

export const apiLogin = (email: string, password: string) =>
  fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  }).then(handleResponse);

export const apiSendPhoneCode = (phone: string, purpose: 'LOGIN' | 'SIGNUP', captchaToken?: string) =>
  fetch(`${BASE_URL}/auth/phone/send-code`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone, purpose, ...(captchaToken ? { captchaToken } : {}) }),
  }).then(handleResponse);

export const apiLoginWithPhone = (phone: string, code: string) =>
  fetch(`${BASE_URL}/auth/phone/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone, code }),
  }).then(handleResponse);

export const apiSignupWithPhone = (phone: string, code: string, role: string) =>
  fetch(`${BASE_URL}/auth/phone/signup`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone, code, role }),
  }).then(handleResponse);

export const apiSendAddPhoneCode = (phone: string) =>
  fetch(`${BASE_URL}/users/phone/send-code`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ phone }),
  }).then(handleResponse);

export const apiConfirmAddPhone = (phone: string, code: string) =>
  fetch(`${BASE_URL}/users/phone/confirm`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ phone, code }),
  }).then(handleResponse);

export const apiDownloadMyData = async (): Promise<{ blob: Blob; filename: string }> => {
  const res = await fetch(`${BASE_URL}/users/me/export`, { headers: headers(true) });
  if (!res.ok) {
    await handleResponse(res); // throws with the server's message
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || 'jobwahala-my-data.json';
  return { blob: await res.blob(), filename };
};

export const apiGetDeletionPreview = () =>
  fetch(`${BASE_URL}/users/me/deletion-preview`, { headers: headers(true) }).then(handleResponse);

export const apiSendDeletionCode = () =>
  fetch(`${BASE_URL}/users/me/delete-code`, { method: 'POST', headers: headers(true) }).then(handleResponse);

export const apiDeleteMyAccount = (data: { confirm: 'DELETE'; password?: string; code?: string; acknowledgeCompany?: boolean }) =>
  fetch(`${BASE_URL}/users/me/delete`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGetMe = () =>
  fetch(`${BASE_URL}/auth/me`, { headers: headers(true) }).then(handleResponse);

export const apiVerifyEmail = (token: string) =>
  fetch(`${BASE_URL}/auth/verify-email`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ token }),
  }).then(handleResponse);

export const apiResendVerification = (email: string) =>
  fetch(`${BASE_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email }),
  }).then(handleResponse);

export const apiForgotPassword = (email: string) =>
  fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email }),
  }).then(handleResponse);

export const apiResetPassword = (token: string, password: string) =>
  fetch(`${BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ token, password }),
  }).then(handleResponse);

// Platform (public)
export const apiGetPlatformConfig = () =>
  fetch(`${BASE_URL}/platform/config`, { headers: headers() }).then(handleResponse);

export const apiGetPlatformStats = () =>
  fetch(`${BASE_URL}/platform/stats`, { headers: headers() }).then(handleResponse);

// Companies
export const apiGetCompany = (id: string) =>
  fetch(`${BASE_URL}/companies/${id}`, { headers: headers() }).then(handleResponse);

export const apiGetHiringCompanies = () =>
  fetch(`${BASE_URL}/companies`, { headers: headers() }).then(handleResponse);

// Job alerts (saved searches)
export const apiGetSavedSearches = () =>
  fetch(`${BASE_URL}/saved-searches`, { headers: headers(true) }).then(handleResponse);

export const apiCreateSavedSearch = (data: { query?: string; location?: string; jobType?: string; emailAlerts?: boolean }) =>
  fetch(`${BASE_URL}/saved-searches`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiUpdateSavedSearch = (id: string, data: { emailAlerts: boolean }) =>
  fetch(`${BASE_URL}/saved-searches/${id}`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiDeleteSavedSearch = (id: string) =>
  fetch(`${BASE_URL}/saved-searches/${id}`, { method: 'DELETE', headers: headers(true) }).then(handleResponse);

// Public interest list (no account needed)
export const apiCreateInterestSignup = (data: { email?: string; phone?: string; source: string; website?: string; captchaToken?: string }) =>
  fetch(`${BASE_URL}/interest`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  }).then(handleResponse);

// Saved jobs
export const apiGetSavedJobs = () => fetch(`${BASE_URL}/saved-jobs`, { headers: headers(true) }).then(handleResponse);

export const apiGetSavedJobIds = () => fetch(`${BASE_URL}/saved-jobs/ids`, { headers: headers(true) }).then(handleResponse);

export const apiSaveJob = (jobId: string) =>
  fetch(`${BASE_URL}/saved-jobs/${encodeURIComponent(jobId)}`, { method: 'POST', headers: headers(true) }).then(handleResponse);

export const apiUnsaveJob = (jobId: string) =>
  fetch(`${BASE_URL}/saved-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE', headers: headers(true) }).then(handleResponse);

// Jobs
export const apiGetJobs = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetch(`${BASE_URL}/jobs${query}`, { headers: headers() }).then(handleResponse);
};

export const apiGetJobById = (id: string) =>
  fetch(`${BASE_URL}/jobs/${id}`, { headers: headers() }).then(handleResponse);

export const apiGetMyJobApplication = (id: string) =>
  fetch(`${BASE_URL}/jobs/${id}/my-application`, {
    headers: headers(true),
  }).then(handleResponse);

export const apiGetJobApplicationCoaching = (id: string) =>
  fetch(`${BASE_URL}/jobs/${id}/application-coaching`, {
    headers: headers(true),
  }).then(handleResponse);

export const apiCompareJobs = (jobIds: string[]) =>
  fetch(`${BASE_URL}/jobs/compare`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ jobIds }),
  }).then(handleResponse);

export const apiCreateJob = (data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGenerateJobDraft = (data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/jobs/draft`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiUpdateJobStatus = (id: string, status: string) =>
  fetch(`${BASE_URL}/jobs/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiUpdateJob = (id: string, data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/jobs/${id}`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiDuplicateJob = (id: string) =>
  fetch(`${BASE_URL}/jobs/${id}/duplicate`, { method: 'POST', headers: headers(true) }).then(handleResponse);

export const apiExtendJob = (id: string, days?: number) =>
  fetch(`${BASE_URL}/jobs/${id}/extend`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(days ? { days } : {}),
  }).then(handleResponse);

export const apiGetMyApplications = () =>
  fetch(`${BASE_URL}/applications/mine`, { headers: headers(true) }).then(handleResponse);

export const apiGetJobApplicants = (jobId: string) =>
  fetch(`${BASE_URL}/jobs/${jobId}/applicants`, {
    headers: headers(true),
  }).then(handleResponse);

export const apiGenerateJobShortlistSummary = (
  jobId: string,
  data?: {
    focus?: string;
  },
) =>
  fetch(`${BASE_URL}/jobs/${jobId}/shortlist-summary`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data || {}),
  }).then(handleResponse);

export const apiGenerateJobApplicantComparison = (
  jobId: string,
  data?: {
    focus?: string;
  },
) =>
  fetch(`${BASE_URL}/jobs/${jobId}/applicant-comparison`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data || {}),
  }).then(handleResponse);

export const apiGenerateApplicantDecisionBrief = (
  applicationId: string,
  data?: {
    focus?: string;
  },
) =>
  fetch(`${BASE_URL}/jobs/applications/${applicationId}/decision-brief`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data || {}),
  }).then(handleResponse);

export const apiUpdateApplicationStatus = (applicationId: string, status: string) =>
  fetch(`${BASE_URL}/jobs/applications/${applicationId}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiDeleteApplication = (applicationId: string) =>
  fetch(`${BASE_URL}/jobs/applications/${applicationId}`, {
    method: 'DELETE',
    headers: headers(true),
  }).then(handleResponse);

export const apiApplyForJob = (jobId: string, coverLetter: string, cv?: 'UPLOADED' | 'BUILDER' | 'NONE') =>
  fetch(`${BASE_URL}/jobs/${jobId}/apply`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ coverLetter, ...(cv ? { cv } : {}) }),
  }).then(handleResponse);

// My CV files
export const apiGetMyCvFiles = () => fetch(`${BASE_URL}/users/cv`, { headers: headers(true) }).then(handleResponse);

export const apiSetUploadedCv = (data: { url: string; fileName: string }) =>
  fetch(`${BASE_URL}/users/cv/uploaded`, { method: 'PUT', headers: headers(true), body: JSON.stringify(data) }).then(handleResponse);

export const apiClearUploadedCv = () =>
  fetch(`${BASE_URL}/users/cv/uploaded`, { method: 'DELETE', headers: headers(true) }).then(handleResponse);

export const apiSetBuilderCv = (data: { url: string; fileName: string }) =>
  fetch(`${BASE_URL}/users/cv/builder`, { method: 'PUT', headers: headers(true), body: JSON.stringify(data) }).then(handleResponse);

export const apiClearBuilderCv = () =>
  fetch(`${BASE_URL}/users/cv/builder`, { method: 'DELETE', headers: headers(true) }).then(handleResponse);

// Freelance Services
export const apiGetServices = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetch(`${BASE_URL}/services${query}`, { headers: headers() }).then(handleResponse);
};

export const apiGetRecommendedServices = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetch(`${BASE_URL}/services/recommendations${query}`, {
    headers: headers(true),
  }).then(handleResponse);
};

export const apiGetFreelancerProfile = (id: string) =>
  fetch(`${BASE_URL}/services/freelancer/${id}`, { headers: headers() }).then(handleResponse);

export const apiGetFreelancerComparison = (id: string) =>
  fetch(`${BASE_URL}/services/freelancer/${id}/comparison`, {
    headers: headers(true),
  }).then(handleResponse);

export const apiCompareMarketplaceFreelancers = (freelancerIds: string[]) =>
  fetch(`${BASE_URL}/services/compare`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ freelancerIds }),
  }).then(handleResponse);

export const apiCreateService = (data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/services`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGenerateServiceDraft = (data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/services/draft`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiUpdateService = (id: string, data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/services/${id}`, {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiUpdateOwnedServiceStatus = (id: string, status: string) =>
  fetch(`${BASE_URL}/services/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiDeleteService = (id: string) =>
  fetch(`${BASE_URL}/services/${id}`, {
    method: 'DELETE',
    headers: headers(true),
  }).then(handleResponse);

export const apiCreateServiceRequest = (serviceId: string, data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/services/${serviceId}/requests`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGetServiceRequestCoaching = (serviceId: string) =>
  fetch(`${BASE_URL}/services/${serviceId}/request-coaching`, {
    headers: headers(true),
  }).then(handleResponse);

export const apiGetReceivedServiceRequests = () =>
  fetch(`${BASE_URL}/services/requests/received`, {
    headers: headers(true),
  }).then(handleResponse);

export const apiGetSentServiceRequests = () =>
  fetch(`${BASE_URL}/services/requests/sent`, {
    headers: headers(true),
  }).then(handleResponse);

export const apiUpdateServiceRequestStatus = (requestId: string, status: string) =>
  fetch(`${BASE_URL}/services/requests/${requestId}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiDeleteServiceRequest = (requestId: string) =>
  fetch(`${BASE_URL}/services/requests/${requestId}`, {
    method: 'DELETE',
    headers: headers(true),
  }).then(handleResponse);

// Messaging
export const apiGetConversations = () =>
  fetch(`${BASE_URL}/messages`, { headers: headers(true) }).then(handleResponse);

export const apiGetConversationSidebar = () =>
  fetch(`${BASE_URL}/messages/sidebar`, { headers: headers(true) }).then(handleResponse);

export const apiGetMessageSummary = () =>
  fetch(`${BASE_URL}/messages/summary`, { headers: headers(true) }).then(handleResponse);

export const apiGetMessages = (conversationId: string) =>
  fetch(`${BASE_URL}/messages/${conversationId}`, { headers: headers(true) }).then(handleResponse);

export const apiGetMessageDelta = (conversationId: string, after: string) =>
  fetch(
    `${BASE_URL}/messages/${conversationId}/delta?${new URLSearchParams({ after }).toString()}`,
    { headers: headers(true) },
  ).then(handleResponse);

export type MessageAttachmentPayload = {
  url: string;
  name: string;
  contentType: string;
  sizeBytes: number;
}

export const apiSendMessage = (
  receiverId: string,
  content: string,
  attachment?: MessageAttachmentPayload,
) =>
  fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({
      receiverId,
      content,
      ...(attachment
        ? {
            attachmentUrl: attachment.url,
            attachmentName: attachment.name,
            attachmentContentType: attachment.contentType,
            attachmentSizeBytes: attachment.sizeBytes,
          }
        : {}),
    }),
  }).then(handleResponse);

export const apiMarkMessagesRead = (conversationId: string) =>
  fetch(`${BASE_URL}/messages/${conversationId}/read`, {
    method: 'PATCH',
    headers: headers(true),
  }).then(handleResponse);

// Notifications
export const apiGetNotificationSummary = () =>
  fetch(`${BASE_URL}/notifications/summary`, { headers: headers(true) }).then(handleResponse);

export const apiGetMyNotifications = (limit?: number) => {
  const query = limit ? `?limit=${limit}` : '';
  return fetch(`${BASE_URL}/notifications${query}`, { headers: headers(true) }).then(handleResponse);
};

export const apiMarkNotificationRead = (id: string) =>
  fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: headers(true),
  }).then(handleResponse);

export const apiMarkAllNotificationsRead = () =>
  fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: headers(true),
  }).then(handleResponse);

// CV Generator
export const apiSaveCVGeneration = (prompt: string, content?: string) =>
  fetch(`${BASE_URL}/cv`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(content ? { prompt, content } : { prompt }),
  }).then(handleResponse);

export const apiGetMyCVs = () =>
  fetch(`${BASE_URL}/cv`, { headers: headers(true) }).then(handleResponse);

export const apiGetCVById = (id: string) =>
  fetch(`${BASE_URL}/cv/${id}`, { headers: headers(true) }).then(handleResponse);

// Agreements
export const apiGetMyAgreements = () =>
  fetch(`${BASE_URL}/agreements`, { headers: headers(true) }).then(handleResponse);

export const apiCompareAgreements = (agreementIds: string[]) =>
  fetch(`${BASE_URL}/agreements/compare`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ agreementIds }),
  }).then(handleResponse);

export const apiGenerateAgreementDecisionBrief = (
  id: string,
  data?: {
    focus?: string;
  },
) =>
  fetch(`${BASE_URL}/agreements/${id}/decision-brief`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data || {}),
  }).then(handleResponse);

// Proposals
export const apiGetMyProposals = () =>
  fetch(`${BASE_URL}/proposals`, { headers: headers(true) }).then(handleResponse);

export const apiCompareProposals = (proposalIds: string[]) =>
  fetch(`${BASE_URL}/proposals/compare`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ proposalIds }),
  }).then(handleResponse);

export const apiGenerateProposalDecisionBrief = (
  id: string,
  data?: {
    focus?: string;
  },
) =>
  fetch(`${BASE_URL}/proposals/${id}/decision-brief`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data || {}),
  }).then(handleResponse);

export const apiGetProposalById = (id: string) =>
  fetch(`${BASE_URL}/proposals/${id}`, { headers: headers(true) }).then(handleResponse);

export const apiCreateJobProposal = (
  applicationId: string,
  data: {
    title: string;
    summary: string;
    amount?: string;
    timeline?: string;
    expiresAt?: string;
    message?: string;
  },
) =>
  fetch(`${BASE_URL}/proposals/job/${applicationId}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGenerateJobProposalDraft = (
  applicationId: string,
  data: {
    title?: string;
    amount?: string;
    timeline?: string;
    focus?: string;
  },
) =>
  fetch(`${BASE_URL}/proposals/job/${applicationId}/draft`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiCreateServiceProposal = (
  requestId: string,
  data: {
    title: string;
    summary: string;
    amount?: string;
    timeline?: string;
    expiresAt?: string;
    message?: string;
  },
) =>
  fetch(`${BASE_URL}/proposals/service/${requestId}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGenerateServiceProposalDraft = (
  requestId: string,
  data: {
    title?: string;
    amount?: string;
    timeline?: string;
    focus?: string;
  },
) =>
  fetch(`${BASE_URL}/proposals/service/${requestId}/draft`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiCounterProposal = (
  id: string,
  data: {
    summary: string;
    amount?: string;
    timeline?: string;
    expiresAt?: string;
    message?: string;
  },
) =>
  fetch(`${BASE_URL}/proposals/${id}/counter`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiUpdateProposalStatus = (id: string, status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED') =>
  fetch(`${BASE_URL}/proposals/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiCreateAgreementMilestone = (
  id: string,
  data: { title: string; description?: string; amount?: string; dueDate?: string },
) =>
  fetch(`${BASE_URL}/agreements/${id}/milestones`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiCreateAgreementReview = (
  id: string,
  data: { rating: number; comment?: string },
) =>
  fetch(`${BASE_URL}/agreements/${id}/reviews`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiCreateAgreementDispute = (
  agreementId: string,
  data: {
    type: string;
    title: string;
    description: string;
    evidenceUrl?: string;
  },
) =>
  fetch(`${BASE_URL}/disputes/agreement/${agreementId}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGetDisputeDetails = (disputeId: string) =>
  fetch(`${BASE_URL}/disputes/${disputeId}`, {
    method: 'GET',
    headers: headers(true),
  }).then(handleResponse);

export const apiAddDisputeMessage = (
  disputeId: string,
  data: { content: string; evidenceUrl?: string },
) =>
  fetch(`${BASE_URL}/disputes/${disputeId}/messages`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiUpdateAgreementMilestoneStatus = (
  id: string,
  milestoneId: string,
  status: string,
) =>
  fetch(`${BASE_URL}/agreements/${id}/milestones/${milestoneId}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiUpdateAgreementMilestonePaymentStatus = (
  id: string,
  milestoneId: string,
  status: string,
) =>
  fetch(`${BASE_URL}/agreements/${id}/milestones/${milestoneId}/payment`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiCreateAgreementMilestonePaymentSession = (id: string, milestoneId: string) =>
  fetch(`${BASE_URL}/agreements/${id}/milestones/${milestoneId}/payments`, {
    method: 'POST',
    headers: headers(true),
  }).then(handleResponse);

export const apiUpdateAgreementPaymentStatus = (
  id: string,
  paymentId: string,
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED',
  failureReason?: string,
) =>
  fetch(`${BASE_URL}/agreements/${id}/payments/${paymentId}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(
      failureReason ? { status, failureReason } : { status },
    ),
  }).then(handleResponse);

export const apiVerifyAgreementPayment = (id: string, paymentId: string) =>
  fetch(`${BASE_URL}/agreements/${id}/payments/${paymentId}/verify`, {
    method: 'POST',
    headers: headers(true),
  }).then(handleResponse);

export const apiInitializeMilestonePayment = (agreementId: string, milestoneId: string) =>
  fetch(`${BASE_URL}/payments/milestones/initialize`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ agreementId, milestoneId }),
  }).then(handleResponse);

// Payouts
export const apiGetBanks = () =>
  fetch(`${BASE_URL}/payouts/banks`, { headers: headers(true) }).then(handleResponse);

export const apiSavePayoutAccount = (data: {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  type?: string;
}) =>
  fetch(`${BASE_URL}/payouts/account`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGetPayoutAccount = () =>
  fetch(`${BASE_URL}/payouts/account`, { headers: headers(true) }).then(handleResponse);

export const apiUpdateAgreementStatus = (id: string, status: string) =>
  fetch(`${BASE_URL}/agreements/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

// Profile
export const apiGetProfile = () =>
  fetch(`${BASE_URL}/users/profile`, { headers: headers(true) }).then(handleResponse);

export const apiGetDashboard = () =>
  fetch(`${BASE_URL}/users/dashboard`, { headers: headers(true) }).then(handleResponse);

export const apiGetDashboardOverview = () =>
  fetch(`${BASE_URL}/users/overview`, { headers: headers(true) }).then(handleResponse);

export const apiGetWorkspaceSignals = () =>
  fetch(`${BASE_URL}/users/signals`, { headers: headers(true) }).then(handleResponse);

export const apiGetDashboardWorkflowSummary = () =>
  fetch(`${BASE_URL}/users/workflow-summary`, { headers: headers(true) }).then(handleResponse);

export const apiGetProfileOptimization = () =>
  fetch(`${BASE_URL}/users/profile-optimization`, { headers: headers(true) }).then(handleResponse);

export const apiGetMyVerification = () =>
  fetch(`${BASE_URL}/users/verification`, { headers: headers(true) }).then(handleResponse);

export const apiCreateVerificationRequest = (data: Record<string, string | undefined>) =>
  fetch(`${BASE_URL}/users/verification`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiRequestVerificationCode = (requestId: string, channel?: 'EMAIL' | 'PHONE') =>
  fetch(`${BASE_URL}/users/verification/${requestId}/code`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(channel ? { channel } : {}),
  }).then(handleResponse);

export const apiConfirmVerificationCode = (requestId: string, code: string) =>
  fetch(`${BASE_URL}/users/verification/${requestId}/confirm`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ code }),
  }).then(handleResponse);

export const apiUpdateProfile = (data: Record<string, unknown>) =>
  fetch(`${BASE_URL}/users/profile`, {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

// Reports
export const apiCreateReport = (type: 'job' | 'service' | 'user', targetId: string, reason: string, details: string, captchaToken?: string) =>
  fetch(`${BASE_URL}/reports`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ type, targetId, reason, details, ...(captchaToken ? { captchaToken } : {}) }),
  }).then(handleResponse);

// Admin
export const apiGetAdminReports = () =>
  fetch(`${BASE_URL}/admin/reports`, { headers: headers(true) }).then(handleResponse);

export const apiUpdateAdminReportStatus = (id: string, status: string) =>
  fetch(`${BASE_URL}/admin/reports/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiUpdateAdminReportsStatusBulk = (reportIds: string[], status: string) =>
  fetch(`${BASE_URL}/admin/reports/bulk-status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ reportIds, status }),
  }).then(handleResponse);

export const apiGetAdminUsers = () =>
  fetch(`${BASE_URL}/admin/users`, { headers: headers(true) }).then(handleResponse);

export const apiGetAdminJobs = () =>
  fetch(`${BASE_URL}/admin/jobs`, { headers: headers(true) }).then(handleResponse);

export const apiCreateAdminJob = (data: {
  employerId: string;
  title: string;
  description: string;
  location?: string;
  type: string;
  salary?: string;
  category?: string;
}) =>
  fetch(`${BASE_URL}/admin/jobs`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiGetAdminServices = () =>
  fetch(`${BASE_URL}/admin/services`, { headers: headers(true) }).then(handleResponse);

export const apiGetAdminVerifications = () =>
  fetch(`${BASE_URL}/admin/verifications`, { headers: headers(true) }).then(handleResponse);

export const apiGetAdminDisputes = () =>
  fetch(`${BASE_URL}/admin/disputes`, { headers: headers(true) }).then(handleResponse);

export const apiUpdateAdminUserStatus = (id: string, status: string) =>
  fetch(`${BASE_URL}/admin/users/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiUpdateAdminUsersStatusBulk = (userIds: string[], status: string) =>
  fetch(`${BASE_URL}/admin/users/bulk-status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ userIds, status }),
  }).then(handleResponse);

export const apiUpdateAdminJobStatus = (id: string, status: string) =>
  fetch(`${BASE_URL}/admin/jobs/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiUpdateAdminJobsStatusBulk = (jobIds: string[], status: string) =>
  fetch(`${BASE_URL}/admin/jobs/bulk-status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ jobIds, status }),
  }).then(handleResponse);

export const apiUpdateAdminServiceStatus = (id: string, status: string) =>
  fetch(`${BASE_URL}/admin/services/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const apiUpdateAdminServicesStatusBulk = (serviceIds: string[], status: string) =>
  fetch(`${BASE_URL}/admin/services/bulk-status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ serviceIds, status }),
  }).then(handleResponse);

export const apiUpdateAdminVerificationStatus = (
  id: string,
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO',
  reviewNote?: string,
  internalNote?: string,
) =>
  fetch(`${BASE_URL}/admin/verifications/${id}/status`, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify({ status, reviewNote, internalNote }),
  }).then(handleResponse);

export const apiResolveDispute = (
  id: string,
  data: {
    status: 'RESOLVED' | 'DISMISSED';
    resolutionNote: string;
  },
) =>
  fetch(`${BASE_URL}/disputes/${id}/resolve`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const apiDeleteAdminUser = (id: string) =>
  fetch(`${BASE_URL}/admin/users/${id}`, {
    method: 'DELETE',
    headers: headers(true),
  }).then(handleResponse);
