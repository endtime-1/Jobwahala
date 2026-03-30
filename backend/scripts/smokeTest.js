const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const backendRoot = path.resolve(__dirname, '..');
const tempDir = path.join(backendRoot, '.tmp');

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine a free port'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });

    server.on('error', reject);
  });

const requestJson = async (baseUrl, pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  return { status: response.status, json };
};

const requestBinary = async (baseUrl, pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, buffer };
};

const openRealtimeStream = async (baseUrl, token) => {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/realtime/stream`, {
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  });

  assert.equal(response.status, 200, 'Realtime stream should connect successfully');
  assert.ok(response.body, 'Realtime stream should expose a readable body');

  const reader = response.body.getReader();
  const queuedEvents = [];
  let buffer = '';

  const parseBlocks = (chunk) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    let boundaryIndex = buffer.indexOf('\n\n');

    while (boundaryIndex >= 0) {
      const rawBlock = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);

      if (rawBlock) {
        const lines = rawBlock.split('\n');
        const eventName = lines
          .find((line) => line.startsWith('event:'))
          ?.slice('event:'.length)
          .trim();
        const dataLine = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice('data:'.length).trim())
          .join('\n');

        if (eventName) {
          let payload = {};
          if (dataLine) {
            try {
              payload = JSON.parse(dataLine);
            } catch {
              payload = { raw: dataLine };
            }
          }

          queuedEvents.push({
            event: eventName,
            payload,
          });
        }
      }

      boundaryIndex = buffer.indexOf('\n\n');
    }
  };

  const readUntilEvent = async (eventName, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const queuedMatch = queuedEvents.findIndex((event) => event.event === eventName);
      if (queuedMatch >= 0) {
        return queuedEvents.splice(queuedMatch, 1)[0];
      }

      const remainingMs = Math.max(deadline - Date.now(), 1);
      const chunk = await Promise.race([
        reader.read(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out waiting for realtime event ${eventName}`)), remainingMs),
        ),
      ]);

      if (chunk.done) {
        throw new Error(`Realtime stream closed before ${eventName} arrived`);
      }

      parseBlocks(Buffer.from(chunk.value).toString('utf8'));
    }

    throw new Error(`Timed out waiting for realtime event ${eventName}`);
  };

  return {
    readUntilEvent,
    close: () => controller.abort(),
  };
};

const getUploadAbsolutePath = (fileUrl) => {
  const pathname = fileUrl.startsWith('http')
    ? new URL(fileUrl).pathname
    : fileUrl;
  const relativePath = pathname.replace(/^\/api\/uploads\//, '');

  return path.join(backendRoot, 'uploads', ...relativePath.split('/'));
};

async function main() {
  await fsp.mkdir(tempDir, { recursive: true });

  const port = await getFreePort();
  const dbFileName = `smoke-${Date.now()}.db`;
  const dbRelativePath = `./.tmp/${dbFileName}`;
  const dbPath = path.join(tempDir, dbFileName);
  const databaseUrl = `file:${dbRelativePath}`;
  const templateDbPath = path.join(backendRoot, 'dev.db');
  const env = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    JWT_SECRET: 'smoke-test-secret',
  };

  await fsp.copyFile(templateDbPath, dbPath);

  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = env.JWT_SECRET;
  process.env.PORT = String(port);

  const prisma = require('../dist/config/prisma').default;
  const app = require('../dist/app').default;
  let server;
  const uploadedFilePaths = [];
  const realtimeClosers = [];

  const trackUploadedFile = (fileUrl) => {
    uploadedFilePaths.push(getUploadAbsolutePath(fileUrl));
  };

  const uploadEvidence = async ({
    baseUrl,
    token,
    category,
    fileName,
    contentType,
    rawContent,
  }) => {
    const uploadResponse = await requestJson(baseUrl, '/api/uploads/evidence', {
      method: 'POST',
      token,
      body: {
        category,
        fileName,
        contentType,
        dataBase64: Buffer.from(rawContent).toString('base64'),
      },
    });

    assert.equal(uploadResponse.status, 201, `${category} evidence upload should succeed`);
    trackUploadedFile(uploadResponse.json.file.url);

    return uploadResponse;
  };

  const cleanup = async () => {
    await prisma.$disconnect();
    await Promise.allSettled(
      realtimeClosers.map((closeStream) =>
        Promise.resolve().then(() => closeStream()).catch(() => undefined),
      ),
    );

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve(undefined);
        });
      });
    }

    await Promise.allSettled([
      fsp.rm(dbPath, { force: true }),
      fsp.rm(`${dbPath}-wal`, { force: true }),
      fsp.rm(`${dbPath}-shm`, { force: true }),
      ...uploadedFilePaths.map((filePath) => fsp.rm(filePath, { force: true })),
    ]);
  };

  try {
    await prisma.$transaction([
      prisma.agreementEvent.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.agreementMilestone.deleteMany(),
      prisma.agreementDispute.deleteMany(),
      prisma.agreement.deleteMany(),
      prisma.proposalRevision.deleteMany(),
      prisma.proposal.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.report.deleteMany(),
      prisma.message.deleteMany(),
      prisma.conversation.deleteMany(),
      prisma.cVGeneration.deleteMany(),
      prisma.serviceRequest.deleteMany(),
      prisma.application.deleteMany(),
      prisma.freelanceService.deleteMany(),
      prisma.job.deleteMany(),
      prisma.jobSeekerProfile.deleteMany(),
      prisma.employerProfile.deleteMany(),
      prisma.freelancerProfile.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    const baseUrl = `http://127.0.0.1:${port}`;
    server = await new Promise((resolve, reject) => {
      const nextServer = app.listen(port, () => resolve(nextServer));
      nextServer.on('error', reject);
    });

    const adminRegister = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'blocked-admin@example.com',
        password: 'AdminPass123!',
        role: 'ADMIN',
      },
    });
    assert.equal(adminRegister.status, 400, 'Public ADMIN registration must be rejected');

    const seekerRegister = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'seeker@example.com',
        password: 'SeekerPass123!',
        role: 'SEEKER',
      },
    });
    assert.equal(seekerRegister.status, 201, 'Seeker registration should succeed');

    const seekerLogin = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        email: 'seeker@example.com',
        password: 'SeekerPass123!',
      },
    });
    assert.equal(seekerLogin.status, 200, 'Seeker login should succeed');
    const seekerToken = seekerLogin.json.token;

    await prisma.user.update({
      where: { email: 'seeker@example.com' },
      data: { status: 'SUSPENDED' },
    });

    const suspendedLogin = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        email: 'seeker@example.com',
        password: 'SeekerPass123!',
      },
    });
    assert.equal(suspendedLogin.status, 403, 'Suspended users must be blocked from login');

    const suspendedProfile = await requestJson(baseUrl, '/api/users/profile', {
      token: seekerToken,
    });
    assert.equal(suspendedProfile.status, 403, 'Suspended users must be blocked from protected routes');

    const freelancerRegister = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'freelancer@example.com',
        password: 'FreelancerPass123!',
        role: 'FREELANCER',
      },
    });
    assert.equal(freelancerRegister.status, 201, 'Freelancer registration should succeed');

    const freelancerToken = freelancerRegister.json.token;
    const freelancerId = freelancerRegister.json.user.id;
    const freelancerVerificationEvidenceUpload = await uploadEvidence({
      baseUrl,
      token: freelancerToken,
      category: 'verification',
      fileName: 'freelancer-portfolio.pdf',
      contentType: 'application/pdf',
      rawContent: '%PDF-1.4 freelancer portfolio evidence',
    });
    const freelancerVerificationDocumentUrl = new URL(
      freelancerVerificationEvidenceUpload.json.file.url,
      baseUrl,
    ).toString();
    const freelancerVerificationEvidenceFile = await requestBinary(
      baseUrl,
      freelancerVerificationEvidenceUpload.json.file.url,
    );
    assert.equal(
      freelancerVerificationEvidenceFile.status,
      200,
      'Uploaded verification evidence should be publicly retrievable from the app path',
    );
    assert.equal(
      freelancerVerificationEvidenceFile.buffer.byteLength > 0,
      true,
      'Uploaded verification evidence should return a non-empty file payload',
    );

    const freelancerVerificationRequest = await requestJson(baseUrl, '/api/users/verification', {
      method: 'POST',
      token: freelancerToken,
      body: {
        details: 'Portfolio available at https://portfolio.example.com with client work and references for professional review.',
        documentUrl: freelancerVerificationDocumentUrl,
      },
    });
    assert.equal(freelancerVerificationRequest.status, 201, 'Freelancers should be able to request professional verification');

    const duplicateFreelancerVerificationRequest = await requestJson(baseUrl, '/api/users/verification', {
      method: 'POST',
      token: freelancerToken,
      body: {
        details: 'A second pending professional verification request should be blocked.',
        documentUrl: freelancerVerificationDocumentUrl,
      },
    });
    assert.equal(
      duplicateFreelancerVerificationRequest.status,
      409,
      'Duplicate pending verification requests must be rejected',
    );

    const serviceDraft = await requestJson(baseUrl, '/api/services/draft', {
      method: 'POST',
      token: freelancerToken,
      body: {
        title: 'Landing Page Design',
        description: 'Responsive landing page design package',
        price: '250',
        deliveryTime: '5 days',
        category: 'Design',
        focus: 'Launch-ready service positioning for startup clients.',
      },
    });
    assert.equal(serviceDraft.status, 200, 'Freelancers should be able to generate AI service drafts');
    assert.equal(
      typeof serviceDraft.json.draft?.title,
      'string',
      'AI service drafts should return a title',
    );
    assert.equal(
      typeof serviceDraft.json.draft?.pricingNote,
      'string',
      'AI service drafts should return pricing guidance',
    );

    const createService = await requestJson(baseUrl, '/api/services', {
      method: 'POST',
      token: freelancerToken,
      body: {
        title: 'Landing Page Design',
        description: 'Responsive landing page design package',
        price: 250,
        deliveryTime: '5 days',
        category: 'Design',
      },
    });
    assert.equal(createService.status, 201, 'Service creation should succeed');

    const serviceId = createService.json.service.id;

    const invalidServiceUpdate = await requestJson(baseUrl, `/api/services/${serviceId}`, {
      method: 'PUT',
      token: freelancerToken,
      body: {
        title: 'Updated Service',
        freelancerId: 'malicious-overwrite',
      },
    });
    assert.equal(invalidServiceUpdate.status, 400, 'Unknown service fields must be rejected');

    const alternativeFreelancerRegister = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'alt-freelancer@example.com',
        password: 'AltFreelancerPass123!',
        role: 'FREELANCER',
      },
    });
    assert.equal(alternativeFreelancerRegister.status, 201, 'Alternative freelancer registration should succeed');
    const alternativeFreelancerId = alternativeFreelancerRegister.json.user.id;
    const alternativeFreelancerToken = alternativeFreelancerRegister.json.token;

    const alternativeService = await requestJson(baseUrl, '/api/services', {
      method: 'POST',
      token: alternativeFreelancerToken,
      body: {
        title: 'Mobile UI Sprint',
        description: 'Focused mobile interface sprint for product teams.',
        price: 220,
        deliveryTime: '10 days',
        category: 'Design',
      },
    });
    assert.equal(alternativeService.status, 201, 'Alternative freelancer should be able to publish a service');

    const serviceClientRegister = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'service-client@example.com',
        password: 'ServiceClientPass123!',
        role: 'SEEKER',
      },
    });
    assert.equal(serviceClientRegister.status, 201, 'Service client registration should succeed');
    const serviceClientId = serviceClientRegister.json.user.id;
    const serviceClientToken = serviceClientRegister.json.token;

    await prisma.jobSeekerProfile.update({
      where: { userId: serviceClientId },
      data: {
        firstName: 'Ama',
        lastName: 'Boateng',
        skills: 'Landing pages, marketing, product launches',
        experience: 'Growth-focused launch planning and campaign execution',
      },
    });

    const serviceRecommendations = await requestJson(baseUrl, '/api/services/recommendations', {
      token: serviceClientToken,
    });
    assert.equal(serviceRecommendations.status, 200, 'Clients should be able to load personalized marketplace recommendations');
    assert.equal(serviceRecommendations.json.personalized, true, 'Recommendation feed should identify itself as personalized');
    assert.equal(
      typeof serviceRecommendations.json.services[0].matchScore,
      'number',
      'Recommended services should include a numeric fit score',
    );
    assert.equal(
      serviceRecommendations.json.services[0].matchReasons.length > 0,
      true,
      'Recommended services should include fit reasons',
    );

    const freelancerComparison = await requestJson(
      baseUrl,
      `/api/services/freelancer/${freelancerId}/comparison`,
      {
        token: serviceClientToken,
      },
    );
    assert.equal(freelancerComparison.status, 200, 'Clients should be able to load freelancer comparison insights');
    assert.equal(
      typeof freelancerComparison.json.comparison.headline,
      'string',
      'Freelancer comparison should include an AI comparison headline',
    );
    assert.equal(
      freelancerComparison.json.comparison.viewedServiceMatches[0].serviceId,
      serviceId,
      'Freelancer comparison should include scored services for the viewed freelancer',
    );
    assert.equal(
      freelancerComparison.json.comparison.alternatives.length > 0,
      true,
      'Freelancer comparison should surface alternative services when the market has other matches',
    );

    const marketplaceComparison = await requestJson(baseUrl, '/api/services/compare', {
      method: 'POST',
      token: serviceClientToken,
      body: {
        freelancerIds: [freelancerId, alternativeFreelancerId],
      },
    });
    assert.equal(marketplaceComparison.status, 200, 'Clients should be able to compare selected freelancer options');
    assert.equal(
      typeof marketplaceComparison.json.comparison.summary,
      'string',
      'Marketplace comparison should include an AI summary',
    );
    assert.equal(
      marketplaceComparison.json.comparison.options.length,
      2,
      'Marketplace comparison should return the selected freelancer options',
    );
    assert.equal(
      marketplaceComparison.json.comparison.options[0].topService.matchScore >= marketplaceComparison.json.comparison.options[1].topService.matchScore,
      true,
      'Marketplace comparison options should be ranked by fit score',
    );

    const serviceRequestCoaching = await requestJson(baseUrl, `/api/services/${serviceId}/request-coaching`, {
      token: serviceClientToken,
    });
    assert.equal(serviceRequestCoaching.status, 200, 'Clients should be able to load service request coaching');
    assert.equal(
      typeof serviceRequestCoaching.json.coaching.headline,
      'string',
      'Service request coaching should include a headline',
    );
    assert.equal(
      typeof serviceRequestCoaching.json.coaching.suggestedMessage,
      'string',
      'Service request coaching should include a suggested message',
    );

    const createServiceRequest = await requestJson(baseUrl, `/api/services/${serviceId}/requests`, {
      method: 'POST',
      token: serviceClientToken,
      body: {
        message: 'Need a conversion-focused landing page for a product launch.',
        budget: 'GHS 3,000',
        timeline: '2 weeks',
      },
    });
    assert.equal(createServiceRequest.status, 201, 'Creating a service request should succeed');
    const serviceRequestId = createServiceRequest.json.serviceRequest.id;

    const duplicateServiceRequest = await requestJson(baseUrl, `/api/services/${serviceId}/requests`, {
      method: 'POST',
      token: serviceClientToken,
      body: {
        message: 'Trying to send a second pending request should fail.',
        budget: 'GHS 3,500',
        timeline: '10 days',
      },
    });
    assert.equal(
      duplicateServiceRequest.status,
      400,
      'Duplicate pending service requests must be rejected',
    );

    const receivedRequestsBeforeAccept = await requestJson(baseUrl, '/api/services/requests/received', {
      token: freelancerToken,
    });
    assert.equal(receivedRequestsBeforeAccept.status, 200, 'Freelancer should be able to load received service requests');
    assert.equal(receivedRequestsBeforeAccept.json.requests.length, 1, 'Freelancer should see the pending service request');
    assert.equal(
      receivedRequestsBeforeAccept.json.requests[0].status,
      'PENDING',
      'New service requests must start as PENDING',
    );

    const serviceProposalDraft = await requestJson(
      baseUrl,
      `/api/proposals/service/${serviceRequestId}/draft`,
      {
        method: 'POST',
        token: freelancerToken,
        body: {
          title: 'Landing Page Design Proposal',
          amount: 'GHS 3,000',
          timeline: '2 weeks',
        },
      },
    );
    assert.equal(serviceProposalDraft.status, 200, 'Freelancers should be able to generate service proposal drafts');
    assert.equal(
      typeof serviceProposalDraft.json.draft.summary,
      'string',
      'Service proposal draft generation should return a summary',
    );
    assert.equal(
      serviceProposalDraft.json.draft.amount,
      'GHS 3,000',
      'Service proposal drafts should preserve amount hints',
    );

    const createServiceProposal = await requestJson(
      baseUrl,
      `/api/proposals/service/${serviceRequestId}`,
      {
        method: 'POST',
        token: freelancerToken,
        body: {
          title: 'Landing Page Design Proposal',
          summary: 'Design and deliver a conversion-focused landing page with responsive layouts and launch support.',
          amount: 'GHS 3,000',
          timeline: '2 weeks',
          message: 'Initial terms based on your project brief.',
        },
      },
    );
    assert.equal(createServiceProposal.status, 201, 'Freelancers should be able to send service proposals');
    const serviceProposalId = createServiceProposal.json.proposal.id;

    const duplicateServiceProposal = await requestJson(
      baseUrl,
      `/api/proposals/service/${serviceRequestId}`,
      {
        method: 'POST',
        token: freelancerToken,
        body: {
          title: 'Duplicate Proposal',
          summary: 'Trying to open a second active proposal should fail.',
        },
      },
    );
    assert.equal(
      duplicateServiceProposal.status,
      409,
      'Only one active proposal thread should exist per service request',
    );

    const serviceClientNotificationsAfterProposal = await requestJson(baseUrl, '/api/notifications', {
      token: serviceClientToken,
    });
    assert.equal(serviceClientNotificationsAfterProposal.status, 200, 'Service clients should be able to load notifications');
    assert.equal(
      serviceClientNotificationsAfterProposal.json.unreadCount,
      1,
      'Receiving a new service proposal should create one unread notification',
    );
    assert.equal(
      serviceClientNotificationsAfterProposal.json.notifications[0].type,
      'PROPOSAL_CREATED',
      'New service proposals should create proposal notifications',
    );

    const serviceClientNotificationSummaryAfterProposal = await requestJson(
      baseUrl,
      '/api/notifications/summary',
      {
        token: serviceClientToken,
      },
    );
    assert.equal(
      serviceClientNotificationSummaryAfterProposal.status,
      200,
      'Service clients should be able to load notification summary counts',
    );
    assert.equal(
      serviceClientNotificationSummaryAfterProposal.json.unreadCount,
      serviceClientNotificationsAfterProposal.json.unreadCount,
      'Notification summary counts should match the full notification feed',
    );

    const serviceClientDashboardWithProposal = await requestJson(baseUrl, '/api/users/dashboard', {
      token: serviceClientToken,
    });
    assert.equal(serviceClientDashboardWithProposal.status, 200, 'Service client dashboard should load proposal actions');
    assert.equal(
      serviceClientDashboardWithProposal.json.pendingProposalActions,
      1,
      'Recipients should see one pending proposal action when a service proposal arrives',
    );

    const counterServiceProposal = await requestJson(baseUrl, `/api/proposals/${serviceProposalId}/counter`, {
      method: 'POST',
      token: serviceClientToken,
      body: {
        summary: 'Deliver the landing page plus launch assets with a tighter revision scope.',
        amount: 'GHS 2,800',
        timeline: '12 days',
        message: 'Countering with a slightly lower budget and faster turnaround.',
      },
    });
    assert.equal(counterServiceProposal.status, 200, 'Recipients should be able to counter service proposals');
    assert.equal(counterServiceProposal.json.proposal.status, 'COUNTERED', 'Countering should persist proposal status');

    const freelancerNotificationsAfterCounter = await requestJson(baseUrl, '/api/notifications', {
      token: freelancerToken,
    });
    assert.equal(freelancerNotificationsAfterCounter.status, 200, 'Freelancers should be able to load notifications');
    assert.equal(
      freelancerNotificationsAfterCounter.json.notifications.some(
        (notification) => notification.type === 'PROPOSAL_COUNTERED',
      ),
      true,
      'Countering a proposal should notify the other participant',
    );

    const freelancerDashboardWithCounter = await requestJson(baseUrl, '/api/users/dashboard', {
      token: freelancerToken,
    });
    assert.equal(freelancerDashboardWithCounter.status, 200, 'Freelancer dashboard should load proposal counters');
    assert.equal(
      freelancerDashboardWithCounter.json.pendingProposalActions,
      1,
      'Countered service proposals should create one action for the freelancer',
    );

    const acceptServiceProposal = await requestJson(baseUrl, `/api/proposals/${serviceProposalId}/status`, {
      method: 'PATCH',
      token: freelancerToken,
      body: {
        status: 'ACCEPTED',
      },
    });
    assert.equal(acceptServiceProposal.status, 200, 'Accepting a countered service proposal should succeed');

    const receivedRequestsAfterAccept = await requestJson(baseUrl, '/api/services/requests/received', {
      token: freelancerToken,
    });
    assert.equal(receivedRequestsAfterAccept.status, 200, 'Freelancer requests should still load after acceptance');
    assert.equal(receivedRequestsAfterAccept.json.requests[0].status, 'ACCEPTED', 'Accepted requests must persist');
    assert.equal(
      Boolean(receivedRequestsAfterAccept.json.requests[0].agreement),
      true,
      'Accepted service requests must expose their linked agreement',
    );

    const serviceClientAgreements = await requestJson(baseUrl, '/api/agreements', {
      token: serviceClientToken,
    });
    assert.equal(serviceClientAgreements.status, 200, 'Service client agreements should load after request acceptance');
    assert.equal(serviceClientAgreements.json.agreements.length, 1, 'Service client should see one agreement');
    assert.equal(
      serviceClientAgreements.json.agreements[0].type,
      'SERVICE',
      'Accepted service requests must create a service agreement',
    );
    assert.equal(
      serviceClientAgreements.json.agreements[0].serviceRequest.status,
      'ACCEPTED',
      'Service agreement payload must reflect the accepted request',
    );
    assert.equal(
      serviceClientAgreements.json.agreements[0].freelancer.email,
      'freelancer@example.com',
      'Service agreement payload must include the freelancer counterparty',
    );
    assert.equal(
      serviceClientAgreements.json.agreements[0].events.length > 0,
      true,
      'Service agreement creation should record an activity event',
    );

    const serviceAgreementId = serviceClientAgreements.json.agreements[0].id;

    const createMilestone = await requestJson(baseUrl, `/api/agreements/${serviceAgreementId}/milestones`, {
      method: 'POST',
      token: serviceClientToken,
      body: {
        title: 'Wireframes',
        description: 'Initial wireframes and conversion-focused page structure.',
        amount: 'GHS 1,500',
        dueDate: '2026-04-01T00:00:00.000Z',
      },
    });
    assert.equal(createMilestone.status, 201, 'Agreement milestones should be creatable by participants');
    const milestoneId = createMilestone.json.milestone.id;

    const freelancerNotificationsAfterMilestoneCreate = await requestJson(baseUrl, '/api/notifications', {
      token: freelancerToken,
    });
    assert.equal(
      freelancerNotificationsAfterMilestoneCreate.json.notifications.some(
        (notification) => notification.type === 'MILESTONE_CREATED',
      ),
      true,
      'Adding a milestone should notify the other agreement participant',
    );

    const agreementsAfterMilestoneCreate = await requestJson(baseUrl, '/api/agreements', {
      token: serviceClientToken,
    });
    assert.equal(
      agreementsAfterMilestoneCreate.json.agreements[0].milestones.length,
      1,
      'Agreement payload should include created milestones',
    );
    assert.equal(
      agreementsAfterMilestoneCreate.json.agreements[0].milestones[0].status,
      'PENDING',
      'New milestones must start as PENDING',
    );

    const serviceClientDashboardWithMilestone = await requestJson(baseUrl, '/api/users/dashboard', {
      token: serviceClientToken,
    });
    assert.equal(
      serviceClientDashboardWithMilestone.status,
      200,
      'Service clients should be able to load dashboard agreement pulse data',
    );
    assert.equal(
      serviceClientDashboardWithMilestone.json.activeAgreementCount,
      1,
      'Dashboard agreement pulse should count active agreements',
    );
    assert.equal(
      serviceClientDashboardWithMilestone.json.upcomingMilestones[0].title,
      'Wireframes',
      'Dashboard agreement pulse should surface upcoming milestones',
    );

    const prematureAgreementCompletion = await requestJson(
      baseUrl,
      `/api/agreements/${serviceAgreementId}/status`,
      {
        method: 'PATCH',
        token: serviceClientToken,
        body: {
          status: 'COMPLETED',
        },
      },
    );
    assert.equal(
      prematureAgreementCompletion.status,
      400,
      'Agreements with incomplete milestones must reject completion',
    );

    const milestoneInProgress = await requestJson(
      baseUrl,
      `/api/agreements/${serviceAgreementId}/milestones/${milestoneId}/status`,
      {
        method: 'PATCH',
        token: freelancerToken,
        body: {
          status: 'IN_PROGRESS',
        },
      },
    );
    assert.equal(milestoneInProgress.status, 200, 'Participants should be able to move milestones into progress');

    const milestoneCompleted = await requestJson(
      baseUrl,
      `/api/agreements/${serviceAgreementId}/milestones/${milestoneId}/status`,
      {
        method: 'PATCH',
        token: freelancerToken,
        body: {
          status: 'COMPLETED',
        },
      },
    );
    assert.equal(milestoneCompleted.status, 200, 'Participants should be able to complete milestones');

    const freelancerDashboardWithPaymentRequest = await requestJson(baseUrl, '/api/users/dashboard', {
      token: freelancerToken,
    });
    assert.equal(
      freelancerDashboardWithPaymentRequest.status,
      200,
      'Freelancers should be able to load dashboard payment action data',
    );
    assert.equal(
      freelancerDashboardWithPaymentRequest.json.pendingPaymentActions,
      1,
      'Completed unpaid milestones should create one freelancer payment action',
    );
    assert.equal(
      freelancerDashboardWithPaymentRequest.json.paymentActionItems[0].action,
      'REQUEST_PAYMENT',
      'Freelancer dashboard should prompt the worker to request payment first',
    );

    const requestMilestonePayment = await requestJson(
      baseUrl,
      `/api/agreements/${serviceAgreementId}/milestones/${milestoneId}/payment`,
      {
        method: 'PATCH',
        token: freelancerToken,
        body: {
          status: 'REQUESTED',
        },
      },
    );
    assert.equal(
      requestMilestonePayment.status,
      200,
      'Workers should be able to request payment for completed milestones',
    );

    const clientNotificationsAfterPaymentRequest = await requestJson(baseUrl, '/api/notifications', {
      token: serviceClientToken,
    });
    assert.equal(
      clientNotificationsAfterPaymentRequest.json.notifications.some(
        (notification) => notification.type === 'MILESTONE_PAYMENT_REQUESTED',
      ),
      true,
      'Requesting milestone payment should notify the payer',
    );

    const prematureAgreementCompletionAfterPaymentRequest = await requestJson(
      baseUrl,
      `/api/agreements/${serviceAgreementId}/status`,
      {
        method: 'PATCH',
        token: serviceClientToken,
        body: {
          status: 'COMPLETED',
        },
      },
    );
    assert.equal(
      prematureAgreementCompletionAfterPaymentRequest.status,
      400,
      'Agreements with unpaid milestones must reject completion',
    );

    const serviceClientDashboardWithPaymentApproval = await requestJson(baseUrl, '/api/users/dashboard', {
      token: serviceClientToken,
    });
    assert.equal(
      serviceClientDashboardWithPaymentApproval.status,
      200,
      'Service clients should be able to load dashboard payment approval data',
    );
    assert.equal(
      serviceClientDashboardWithPaymentApproval.json.pendingPaymentActions,
      1,
      'Requested milestone payouts should create one client payment action',
    );
    assert.equal(
      serviceClientDashboardWithPaymentApproval.json.paymentActionItems[0].action,
      'MARK_PAID',
      'Service client dashboard should prompt the payer to mark the milestone as paid',
    );

    const serviceClientSignalsWithPaymentApproval = await requestJson(baseUrl, '/api/users/signals', {
      token: serviceClientToken,
    });
    assert.equal(
      serviceClientSignalsWithPaymentApproval.status,
      200,
      'Service clients should be able to load lightweight workspace signals',
    );
    assert.equal(
      serviceClientSignalsWithPaymentApproval.json.pendingAgreementActions,
      1,
      'Workspace signals should include active agreement-side actions',
    );

    const createPaymentSession = await requestJson(
      baseUrl,
      `/api/agreements/${serviceAgreementId}/milestones/${milestoneId}/payments`,
      {
        method: 'POST',
        token: serviceClientToken,
      },
    );
    assert.equal(createPaymentSession.status, 201, 'Clients should be able to open payment sessions for requested payouts');
    assert.equal(createPaymentSession.json.payment.status, 'PENDING', 'New payment sessions should start in PENDING state');
    const paymentId = createPaymentSession.json.payment.id;

    const agreementsWithPaymentSession = await requestJson(baseUrl, '/api/agreements', {
      token: serviceClientToken,
    });
    assert.equal(
      agreementsWithPaymentSession.json.agreements[0].milestones[0].payments.length,
      1,
      'Agreement payload should include milestone payment history',
    );
    assert.equal(
      agreementsWithPaymentSession.json.agreements[0].milestones[0].payments[0].status,
      'PENDING',
      'Open payment sessions should appear on the milestone record',
    );

    const markMilestonePaid = await requestJson(
      baseUrl,
      `/api/agreements/${serviceAgreementId}/payments/${paymentId}/status`,
      {
        method: 'PATCH',
        token: serviceClientToken,
        body: {
          status: 'SUCCEEDED',
        },
      },
    );
    assert.equal(markMilestonePaid.status, 200, 'Clients should be able to complete sandbox milestone payments');

    const agreementsAfterPayment = await requestJson(baseUrl, '/api/agreements', {
      token: serviceClientToken,
    });
    assert.equal(
      agreementsAfterPayment.json.agreements[0].milestones[0].paymentStatus,
      'PAID',
      'Agreement payload should include paid milestone status',
    );

    const completeServiceAgreement = await requestJson(baseUrl, `/api/agreements/${serviceAgreementId}/status`, {
      method: 'PATCH',
      token: serviceClientToken,
      body: {
        status: 'COMPLETED',
      },
    });
    assert.equal(completeServiceAgreement.status, 200, 'Completing a service agreement should succeed');

    const completedServiceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { status: true },
    });
    assert.equal(
      completedServiceRequest?.status,
      'COMPLETED',
      'Service agreement completion must propagate to the source service request',
    );

    const createServiceReview = await requestJson(baseUrl, `/api/agreements/${serviceAgreementId}/reviews`, {
      method: 'POST',
      token: serviceClientToken,
      body: {
        rating: 5,
        comment: 'Delivered quickly and communicated clearly throughout the project.',
      },
    });
    assert.equal(createServiceReview.status, 201, 'Completed agreements should allow reviews');

    const duplicateServiceReview = await requestJson(baseUrl, `/api/agreements/${serviceAgreementId}/reviews`, {
      method: 'POST',
      token: serviceClientToken,
      body: {
        rating: 4,
        comment: 'Trying to review twice should fail.',
      },
    });
    assert.equal(duplicateServiceReview.status, 409, 'Participants must not be able to review the same agreement twice');

    const freelancerNotificationsAfterReview = await requestJson(baseUrl, '/api/notifications', {
      token: freelancerToken,
    });
    assert.equal(
      freelancerNotificationsAfterReview.json.notifications.some(
        (notification) => notification.type === 'REVIEW_RECEIVED',
      ),
      true,
      'Receiving a review should create a notification for the counterparty',
    );

    const freelancerUser = await prisma.user.findUnique({
      where: { email: 'freelancer@example.com' },
      select: { id: true },
    });
    assert.ok(freelancerUser?.id, 'The freelancer user should exist for public profile assertions');

    const freelancerProfileAfterReview = await requestJson(
      baseUrl,
      `/api/services/freelancer/${freelancerUser.id}`,
    );
    assert.equal(freelancerProfileAfterReview.status, 200, 'Public freelancer profiles should load review data');
    assert.equal(
      freelancerProfileAfterReview.json.reviewSummary.reviewCount,
      1,
      'Freelancer public profiles should expose received review counts',
    );
    assert.equal(
      freelancerProfileAfterReview.json.reviewSummary.averageRating,
      5,
      'Freelancer public profiles should expose average rating',
    );
    assert.equal(
      freelancerProfileAfterReview.json.profile.reviewsReceived[0].rating,
      5,
      'Freelancer public profiles should include recent review entries',
    );

    const mutateClosedServiceRequest = await requestJson(
      baseUrl,
      `/api/services/requests/${serviceRequestId}/status`,
      {
        method: 'PATCH',
        token: freelancerToken,
        body: {
          status: 'DECLINED',
        },
      },
    );
    assert.equal(
      mutateClosedServiceRequest.status,
      400,
      'Closed-agreement service requests must reject later status changes',
    );

    const employerRegister = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'employer@example.com',
        password: 'EmployerPass123!',
        role: 'EMPLOYER',
      },
    });
    assert.equal(employerRegister.status, 201, 'Employer registration should succeed');

    const employerToken = employerRegister.json.token;
    const employerId = employerRegister.json.user.id;

    const employerVerificationRequest = await requestJson(baseUrl, '/api/users/verification', {
      method: 'POST',
      token: employerToken,
      body: {
        details: 'Registered company with active hiring records and a public website for business verification.',
        documentUrl: 'https://jobwahalalabs.example.com',
      },
    });
    assert.equal(employerVerificationRequest.status, 201, 'Employers should be able to request business verification');

    const activeSeekerRegister = await requestJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'active-seeker@example.com',
        password: 'ActiveSeekerPass123!',
        role: 'SEEKER',
      },
    });
    assert.equal(activeSeekerRegister.status, 201, 'Active seeker registration should succeed');

    const activeSeekerToken = activeSeekerRegister.json.token;
    const activeSeekerRealtimeStream = await openRealtimeStream(baseUrl, activeSeekerToken);
    realtimeClosers.push(activeSeekerRealtimeStream.close);
    await activeSeekerRealtimeStream.readUntilEvent('connected');

    const updateActiveSeekerProfile = await requestJson(baseUrl, '/api/users/profile', {
      method: 'PUT',
      token: activeSeekerToken,
      body: {
        firstName: 'Ada',
        lastName: 'Mensah',
        skills: 'React, TypeScript, UI Engineering',
        experience: 'Frontend engineer building React product flows and TypeScript dashboards.',
      },
    });
    assert.equal(updateActiveSeekerProfile.status, 200, 'Active seeker profile update should succeed');

    const seekerOptimization = await requestJson(baseUrl, '/api/users/profile-optimization', {
      token: activeSeekerToken,
    });
    assert.equal(seekerOptimization.status, 200, 'Seekers should be able to load profile optimization guidance');
    assert.equal(
      typeof seekerOptimization.json.optimization.headline,
      'string',
      'Profile optimization should include a coaching headline',
    );
    assert.equal(
      Array.isArray(seekerOptimization.json.optimization.improvements),
      true,
      'Profile optimization should include improvement actions',
    );
    assert.equal(
      Array.isArray(seekerOptimization.json.optimization.suggestedSkills),
      true,
      'Profile optimization should include suggested skills',
    );

    const jobDraft = await requestJson(baseUrl, '/api/jobs/draft', {
      method: 'POST',
      token: employerToken,
      body: {
        title: 'Product Designer',
        description: 'Lead design across core marketplace flows and conversion moments.',
        location: 'Remote',
        type: 'Contract',
        salary: '$3,000/month',
        category: 'Design',
        focus: 'High-ownership role for growth-stage delivery.',
      },
    });
    assert.equal(jobDraft.status, 200, 'Employers should be able to generate AI job drafts');
    assert.equal(
      typeof jobDraft.json.draft?.title,
      'string',
      'AI job drafts should return a title',
    );
    assert.equal(
      typeof jobDraft.json.draft?.hiringNote,
      'string',
      'AI job drafts should return hiring guidance',
    );

    const createJob = await requestJson(baseUrl, '/api/jobs', {
      method: 'POST',
      token: employerToken,
      body: {
        title: 'Frontend Engineer',
        description: 'Build React product features',
        location: 'Remote',
        type: 'Full-time',
        salary: '5000',
        category: 'Engineering',
      },
    });
    assert.equal(createJob.status, 201, 'Job creation should succeed');

    const jobId = createJob.json.job.id;

    const jobApplicationCoaching = await requestJson(baseUrl, `/api/jobs/${jobId}/application-coaching`, {
      token: activeSeekerToken,
    });
    assert.equal(jobApplicationCoaching.status, 200, 'Seekers should be able to load job application coaching');
    assert.equal(
      typeof jobApplicationCoaching.json.coaching.headline,
      'string',
      'Job application coaching should include a role-specific headline',
    );
    assert.equal(
      typeof jobApplicationCoaching.json.coaching.suggestedCoverLetter,
      'string',
      'Job application coaching should include a suggested cover letter',
    );

    const createRecommendedJob = await requestJson(baseUrl, '/api/jobs', {
      method: 'POST',
      token: employerToken,
      body: {
        title: 'React Platform Engineer',
        description: 'Build React interfaces, TypeScript workflows, and frontend product experiences.',
        location: 'Remote',
        type: 'Full-time',
        salary: '6200',
        category: 'Engineering',
      },
    });
    assert.equal(createRecommendedJob.status, 201, 'Second job creation should succeed for recommendation scoring');
    const recommendedJobId = createRecommendedJob.json.job.id;

    const seekerJobComparison = await requestJson(baseUrl, '/api/jobs/compare', {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        jobIds: [jobId, recommendedJobId],
      },
    });
    assert.equal(seekerJobComparison.status, 200, 'Seekers should be able to compare selected jobs');
    assert.equal(
      typeof seekerJobComparison.json.comparison.summary,
      'string',
      'Job comparison should include an AI comparison summary',
    );
    assert.equal(
      seekerJobComparison.json.comparison.jobs.length,
      2,
      'Job comparison should return the selected roles',
    );
    assert.equal(
      seekerJobComparison.json.comparison.jobs[0].matchScore >= seekerJobComparison.json.comparison.jobs[1].matchScore,
      true,
      'Job comparison options should be ranked by seeker fit score',
    );

    const apply = await requestJson(baseUrl, `/api/jobs/${jobId}/apply`, {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        coverLetter: 'I can ship the UI layer end to end.',
      },
    });
    assert.equal(apply.status, 201, 'Job application should succeed');

    const applicationId = apply.json.application.id;

    const duplicateApply = await requestJson(baseUrl, `/api/jobs/${jobId}/apply`, {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        coverLetter: 'Trying to apply twice should fail.',
      },
    });
    assert.equal(duplicateApply.status, 409, 'Duplicate applications must be rejected');

    const myApplication = await requestJson(baseUrl, `/api/jobs/${jobId}/my-application`, {
      token: activeSeekerToken,
    });
    assert.equal(myApplication.status, 200, 'Seekers should be able to load their application for a job');
    assert.equal(myApplication.json.application.status, 'SUBMITTED', 'New applications must start as SUBMITTED');

    const employerApplicantsAfterApply = await requestJson(baseUrl, `/api/jobs/${jobId}/applicants`, {
      token: employerToken,
    });
    assert.equal(employerApplicantsAfterApply.status, 200, 'Employers should be able to review applicants');
    assert.equal(
      typeof employerApplicantsAfterApply.json.applications[0].fitScore,
      'number',
      'Applicant review payload should include a fit score',
    );
    assert.equal(
      employerApplicantsAfterApply.json.applications[0].fitScore > 0,
      true,
      'Applicant fit score should be positive when seeker profile data matches the role',
    );
    assert.equal(
      employerApplicantsAfterApply.json.applications[0].fitReasons.length > 0,
      true,
      'Applicant review payload should include explainable fit reasons',
    );

    const shortlistSummary = await requestJson(baseUrl, `/api/jobs/${jobId}/shortlist-summary`, {
      method: 'POST',
      token: employerToken,
      body: {
        focus: 'Prioritize React ownership and delivery leadership.',
      },
    });
    assert.equal(shortlistSummary.status, 200, 'Employers should be able to generate shortlist summaries');
    assert.equal(
      typeof shortlistSummary.json.summary,
      'string',
      'Shortlist summary generation should return a text summary',
    );
    assert.equal(
      shortlistSummary.json.summary.length > 0,
      true,
      'Shortlist summary should not be empty',
    );
    assert.equal(
      shortlistSummary.json.candidatesConsidered,
      1,
      'Shortlist summary should report how many candidates were evaluated',
    );

    const applicantComparison = await requestJson(baseUrl, `/api/jobs/${jobId}/applicant-comparison`, {
      method: 'POST',
      token: employerToken,
      body: {
        focus: 'Compare leadership against execution reliability.',
      },
    });
    assert.equal(applicantComparison.status, 200, 'Employers should be able to generate applicant comparison briefs');
    assert.equal(
      typeof applicantComparison.json.summary,
      'string',
      'Applicant comparison generation should return a text summary',
    );
    assert.equal(
      applicantComparison.json.summary.length > 0,
      true,
      'Applicant comparison summary should not be empty',
    );
    assert.equal(
      applicantComparison.json.candidatesConsidered,
      1,
      'Applicant comparison should report how many candidates were evaluated',
    );

    const applicantDecisionBrief = await requestJson(
      baseUrl,
      `/api/jobs/applications/${applicationId}/decision-brief`,
      {
        method: 'POST',
        token: employerToken,
        body: {
          focus: 'Decide whether to move this applicant into concrete proposal terms.',
        },
      },
    );
    assert.equal(
      applicantDecisionBrief.status,
      200,
      'Employers should be able to generate applicant decision briefs',
    );
    assert.equal(
      typeof applicantDecisionBrief.json.brief?.headline,
      'string',
      'Applicant decision generation should return a headline',
    );
    assert.equal(
      typeof applicantDecisionBrief.json.brief?.nextAction,
      'string',
      'Applicant decision generation should return a next action',
    );
    assert.equal(
      ['SHORTLIST', 'INTERVIEW', 'SEND_PROPOSAL', 'HIRE', 'HOLD'].includes(
        applicantDecisionBrief.json.brief?.recommendation,
      ),
      true,
      'Applicant decision generation should return a valid recommendation',
    );

    const jobProposalDraft = await requestJson(baseUrl, `/api/proposals/job/${applicationId}/draft`, {
      method: 'POST',
      token: employerToken,
      body: {
        title: 'Frontend Engineer Offer',
        amount: '5000',
        timeline: 'Immediate start',
      },
    });
    assert.equal(jobProposalDraft.status, 200, 'Employers should be able to generate job proposal drafts');
    assert.equal(
      typeof jobProposalDraft.json.draft.summary,
      'string',
      'Job proposal draft generation should return a summary',
    );
    assert.equal(
      jobProposalDraft.json.draft.timeline,
      'Immediate start',
      'Job proposal drafts should preserve timeline hints',
    );

    const createJobProposal = await requestJson(baseUrl, `/api/proposals/job/${applicationId}`, {
      method: 'POST',
      token: employerToken,
      body: {
        title: 'Frontend Engineer Offer',
        summary: 'Join the team to ship React product features, own release quality, and support product delivery.',
        amount: '5000',
        timeline: 'Immediate start',
        message: 'Initial offer terms for the role.',
      },
    });
    assert.equal(createJobProposal.status, 201, 'Employers should be able to send job proposals');
    const jobProposalId = createJobProposal.json.proposal.id;
    const realtimeProposalNotification = await activeSeekerRealtimeStream.readUntilEvent(
      'notifications.refresh',
    );
    assert.equal(
      realtimeProposalNotification.payload.reason,
      'created',
      'Proposal delivery should emit a realtime notification refresh event',
    );
    const realtimeProposalRefresh = await activeSeekerRealtimeStream.readUntilEvent(
      'proposals.refresh',
    );
    assert.equal(
      realtimeProposalRefresh.payload.proposalId,
      jobProposalId,
      'Proposal delivery should emit a realtime proposal refresh event',
    );

    const duplicateJobProposal = await requestJson(baseUrl, `/api/proposals/job/${applicationId}`, {
      method: 'POST',
      token: employerToken,
      body: {
        title: 'Second Offer',
        summary: 'Trying to open a second active proposal should fail.',
      },
    });
    assert.equal(
      duplicateJobProposal.status,
      409,
      'Only one active proposal thread should exist per application',
    );

    const seekerNotificationsAfterJobProposal = await requestJson(baseUrl, '/api/notifications', {
      token: activeSeekerToken,
    });
    assert.equal(seekerNotificationsAfterJobProposal.status, 200, 'Seekers should be able to load notifications');
    assert.equal(
      seekerNotificationsAfterJobProposal.json.unreadCount,
      1,
      'Receiving a new job proposal should create one unread notification',
    );
    assert.equal(
      seekerNotificationsAfterJobProposal.json.notifications[0].type,
      'PROPOSAL_CREATED',
      'New job proposals should create proposal notifications',
    );

    const seekerNotificationSummaryAfterJobProposal = await requestJson(
      baseUrl,
      '/api/notifications/summary',
      {
        token: activeSeekerToken,
      },
    );
    assert.equal(
      seekerNotificationSummaryAfterJobProposal.status,
      200,
      'Seekers should be able to load notification summary counts',
    );
    assert.equal(
      seekerNotificationSummaryAfterJobProposal.json.unreadCount,
      seekerNotificationsAfterJobProposal.json.unreadCount,
      'Notification summary counts should match the full notification feed',
    );

    const markJobProposalNotificationRead = await requestJson(
      baseUrl,
      `/api/notifications/${seekerNotificationsAfterJobProposal.json.notifications[0].id}/read`,
      {
        method: 'PATCH',
        token: activeSeekerToken,
      },
    );
    assert.equal(markJobProposalNotificationRead.status, 200, 'Users should be able to mark notifications as read');
    assert.equal(markJobProposalNotificationRead.json.unreadCount, 0, 'Marking a notification as read should reduce unread count');

    const seekerDashboardWithProposal = await requestJson(baseUrl, '/api/users/dashboard', {
      token: activeSeekerToken,
    });
    assert.equal(seekerDashboardWithProposal.status, 200, 'Seeker dashboard should load proposal actions');
    assert.equal(
      seekerDashboardWithProposal.json.pendingProposalActions,
      1,
      'Recipients should see one pending proposal action when a job proposal arrives',
    );

    const seekerWorkflowSummaryWithProposal = await requestJson(
      baseUrl,
      '/api/users/workflow-summary',
      {
        token: activeSeekerToken,
      },
    );
    assert.equal(
      seekerWorkflowSummaryWithProposal.status,
      200,
      'Seekers should be able to load lightweight workflow summary data',
    );
    assert.equal(
      seekerWorkflowSummaryWithProposal.json.pendingProposalActions,
      1,
      'Workflow summary should include pending proposal actions',
    );

    const seekerOverviewAfterApply = await requestJson(baseUrl, '/api/users/overview', {
      token: activeSeekerToken,
    });
    assert.equal(
      seekerOverviewAfterApply.status,
      200,
      'Seekers should be able to load lightweight dashboard overview data',
    );
    assert.equal(
      seekerOverviewAfterApply.json.applications.length,
      1,
      'Overview should include the active seeker application list',
    );
    assert.equal(
      seekerOverviewAfterApply.json.recommendedJobs.length >= 1,
      true,
      'Overview should keep recommended jobs available after an application is submitted',
    );
    assert.equal(
      seekerOverviewAfterApply.json.recommendedJobs[0].title,
      'React Platform Engineer',
      'Recommendation scoring should prioritize the strongest remaining job match',
    );
    assert.equal(
      typeof seekerOverviewAfterApply.json.recommendedJobs[0].matchScore,
      'number',
      'Recommended jobs should include a match score',
    );
    assert.equal(
      seekerOverviewAfterApply.json.recommendedJobs[0].matchReasons.length > 0,
      true,
      'Recommended jobs should include explainable match reasons',
    );

    const seekerSignalsWithProposal = await requestJson(baseUrl, '/api/users/signals', {
      token: activeSeekerToken,
    });
    assert.equal(
      seekerSignalsWithProposal.status,
      200,
      'Seekers should be able to load lightweight workspace signals',
    );
    assert.equal(
      seekerSignalsWithProposal.json.pendingProposalActions,
      1,
      'Workspace signals should include pending proposal actions',
    );

    const counterJobProposal = await requestJson(baseUrl, `/api/proposals/${jobProposalId}/counter`, {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        summary: 'Ready to take ownership of the UI layer with a short onboarding window before delivery starts.',
        amount: '5500',
        timeline: 'Start within one week',
        message: 'Countering with a slightly higher amount and a defined start window.',
      },
    });
    assert.equal(counterJobProposal.status, 200, 'Seekers should be able to counter job proposals');
    assert.equal(counterJobProposal.json.proposal.status, 'COUNTERED', 'Countering should persist proposal status');

    const employerDashboardWithCounter = await requestJson(baseUrl, '/api/users/dashboard', {
      token: employerToken,
    });
    assert.equal(employerDashboardWithCounter.status, 200, 'Employer dashboard should load proposal counters');
    assert.equal(
      employerDashboardWithCounter.json.pendingProposalActions,
      1,
      'Countered job proposals should create one action for the employer',
    );

    const employerWorkflowSummaryWithCounter = await requestJson(
      baseUrl,
      '/api/users/workflow-summary',
      {
        token: employerToken,
      },
    );
    assert.equal(
      employerWorkflowSummaryWithCounter.status,
      200,
      'Employers should be able to load workflow summary data',
    );
    assert.equal(
      employerWorkflowSummaryWithCounter.json.pendingProposalActions,
      1,
      'Employer workflow summary should include countered proposal actions',
    );

    const acceptJobProposal = await requestJson(baseUrl, `/api/proposals/${jobProposalId}/status`, {
      method: 'PATCH',
      token: employerToken,
      body: {
        status: 'ACCEPTED',
      },
    });
    assert.equal(acceptJobProposal.status, 200, 'Accepting a countered job proposal should succeed');
    const realtimeAgreementRefresh = await activeSeekerRealtimeStream.readUntilEvent(
      'agreements.refresh',
    );
    assert.equal(
      realtimeAgreementRefresh.payload.proposalId,
      jobProposalId,
      'Accepted proposals should emit realtime agreement refresh events',
    );

    const seekerAgreementsAfterHire = await requestJson(baseUrl, '/api/agreements', {
      token: activeSeekerToken,
    });
    assert.equal(seekerAgreementsAfterHire.status, 200, 'Seeker agreements should load after being hired');
    assert.equal(seekerAgreementsAfterHire.json.agreements.length, 1, 'Seeker should see one agreement after hire');
    assert.equal(
      seekerAgreementsAfterHire.json.agreements[0].application.status,
      'HIRED',
      'Seeker agreement payload must reflect the hired application status',
    );
    assert.equal(
      seekerAgreementsAfterHire.json.agreements[0].employer.email,
      'employer@example.com',
      'Seeker agreement payload must include the employer counterparty',
    );
    assert.equal(
      seekerAgreementsAfterHire.json.agreements[0].events.length > 0,
      true,
      'Agreement creation should record at least one activity event',
    );
    assert.equal(
      realtimeAgreementRefresh.payload.agreementId,
      seekerAgreementsAfterHire.json.agreements[0].id,
      'Agreement refresh events should include the created agreement id',
    );

    const seekerOverviewAfterHire = await requestJson(baseUrl, '/api/users/overview', {
      token: activeSeekerToken,
    });
    assert.equal(
      seekerOverviewAfterHire.status,
      200,
      'Seekers should still be able to load overview data after hire',
    );
    assert.equal(
      seekerOverviewAfterHire.json.applications[0].agreement.id,
      seekerAgreementsAfterHire.json.agreements[0].id,
      'Overview should reflect agreement linkage after a proposal is accepted',
    );

    const applyForRecommendedJob = await requestJson(baseUrl, `/api/jobs/${recommendedJobId}/apply`, {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        coverLetter: 'I can also lead the React platform role with frontend architecture ownership.',
      },
    });
    assert.equal(
      applyForRecommendedJob.status,
      201,
      'Seekers should still be able to apply for a second recommended job',
    );
    const recommendedApplicationId = applyForRecommendedJob.json.application.id;

    const createRecommendedJobProposal = await requestJson(
      baseUrl,
      `/api/proposals/job/${recommendedApplicationId}`,
      {
        method: 'POST',
        token: employerToken,
        body: {
          title: 'React Platform Engineer Offer',
          summary: 'Lead the React platform roadmap, tighten delivery standards, and own shared frontend quality.',
          amount: '6200',
          timeline: 'Start within two weeks',
          message: 'Second proposal for the platform-focused opening.',
        },
      },
    );
    assert.equal(
      createRecommendedJobProposal.status,
      201,
      'Employers should be able to send a second proposal for a different application',
    );
    const secondJobProposalId = createRecommendedJobProposal.json.proposal.id;

    const proposalComparison = await requestJson(baseUrl, '/api/proposals/compare', {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        proposalIds: [jobProposalId, secondJobProposalId],
      },
    });
    assert.equal(
      proposalComparison.status,
      200,
      'Proposal participants should be able to compare selected proposals',
    );
    assert.equal(
      typeof proposalComparison.json.comparison.summary,
      'string',
      'Proposal comparison should return an AI comparison summary',
    );
    assert.equal(
      proposalComparison.json.comparison.proposals.length,
      2,
      'Proposal comparison should return the selected proposals',
    );
    assert.equal(
      proposalComparison.json.comparison.proposals[0].id,
      jobProposalId,
      'Proposal comparison should preserve the selected proposal order',
    );
    assert.equal(
      proposalComparison.json.comparison.proposals[1].source.title,
      'React Platform Engineer',
      'Proposal comparison should include source context for compared proposals',
    );

    const proposalDecisionBrief = await requestJson(
      baseUrl,
      `/api/proposals/${secondJobProposalId}/decision-brief`,
      {
        method: 'POST',
        token: activeSeekerToken,
        body: {},
      },
    );
    assert.equal(
      proposalDecisionBrief.status,
      200,
      'Proposal recipients should be able to generate a decision brief for active terms',
    );
    assert.equal(
      ['ACCEPT', 'COUNTER', 'REJECT'].includes(proposalDecisionBrief.json.brief.recommendation),
      true,
      'Proposal decision briefs should return a valid recommendation',
    );
    assert.equal(
      typeof proposalDecisionBrief.json.brief.summary,
      'string',
      'Proposal decision briefs should return a usable summary',
    );
    assert.equal(
      typeof proposalDecisionBrief.json.brief.suggestedMessage,
      'string',
      'Proposal decision briefs should include a suggested reply message',
    );

    const firstMessage = await requestJson(baseUrl, '/api/messages', {
      method: 'POST',
      token: employerToken,
      body: {
        receiverId: activeSeekerRegister.json.user.id,
        content: 'Congratulations, let us discuss next steps.',
      },
    });
    assert.equal(firstMessage.status, 201, 'Sending the first direct message should succeed');
    const conversationId = firstMessage.json.message.conversationId;
    const realtimeMessageRefresh = await activeSeekerRealtimeStream.readUntilEvent(
      'messages.refresh',
    );
    assert.equal(
      realtimeMessageRefresh.payload.conversationId,
      conversationId,
      'New direct messages should emit realtime conversation refresh events',
    );

    const messageAttachmentUpload = await uploadEvidence({
      baseUrl,
      token: employerToken,
      category: 'message',
      fileName: 'launch-brief.pdf',
      contentType: 'application/pdf',
      rawContent: '%PDF-1.4 launch brief attachment for direct messaging',
    });
    const messageAttachmentUrl = new URL(
      messageAttachmentUpload.json.file.url,
      baseUrl,
    ).toString();
    const uploadedMessageAttachment = await requestBinary(
      baseUrl,
      messageAttachmentUpload.json.file.url,
    );
    assert.equal(
      uploadedMessageAttachment.status,
      200,
      'Uploaded message attachments should be publicly retrievable from the app path',
    );

    const attachmentMessage = await requestJson(baseUrl, '/api/messages', {
      method: 'POST',
      token: employerToken,
      body: {
        receiverId: activeSeekerRegister.json.user.id,
        content: '',
        attachmentUrl: messageAttachmentUrl,
        attachmentName: messageAttachmentUpload.json.file.originalFileName,
        attachmentContentType: messageAttachmentUpload.json.file.contentType,
        attachmentSizeBytes: messageAttachmentUpload.json.file.sizeBytes,
      },
    });
    assert.equal(attachmentMessage.status, 201, 'Attachment-only messages should succeed');

    const realtimeAttachmentRefresh = await activeSeekerRealtimeStream.readUntilEvent(
      'messages.refresh',
    );
    assert.equal(
      realtimeAttachmentRefresh.payload.conversationId,
      conversationId,
      'Attachment messages should emit realtime conversation refresh events',
    );

    const seekerConversationsBeforeRead = await requestJson(baseUrl, '/api/messages', {
      token: activeSeekerToken,
    });
    assert.equal(seekerConversationsBeforeRead.status, 200, 'Seeker conversations should load');
    const seekerConversation = seekerConversationsBeforeRead.json.conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    assert.equal(Boolean(seekerConversation), true, 'Direct conversation should appear in the seeker inbox');
    assert.equal(
      seekerConversation.unreadCount,
      2,
      'Incoming text and attachment messages should both increment the unread conversation count',
    );

    const seekerMessageSummaryBeforeRead = await requestJson(baseUrl, '/api/messages/summary', {
      token: activeSeekerToken,
    });
    assert.equal(
      seekerMessageSummaryBeforeRead.status,
      200,
      'Participants should be able to load lightweight inbox summary data',
    );
    assert.equal(
      seekerMessageSummaryBeforeRead.json.unreadMessages,
      2,
      'Inbox summary should include unread message totals',
    );
    assert.equal(
      seekerMessageSummaryBeforeRead.json.recentMessages[0].participant.email,
      'employer@example.com',
      'Inbox summary should include the latest conversation participant',
    );

    const seekerConversationSidebarBeforeRead = await requestJson(baseUrl, '/api/messages/sidebar', {
      token: activeSeekerToken,
    });
    assert.equal(
      seekerConversationSidebarBeforeRead.status,
      200,
      'Participants should be able to load lightweight inbox sidebar data',
    );
    assert.equal(
      seekerConversationSidebarBeforeRead.json.conversations[0].participant.email,
      'employer@example.com',
      'Inbox sidebar should include the conversation participant',
    );
    assert.equal(
      seekerConversationSidebarBeforeRead.json.conversations[0].unreadCount,
      2,
      'Inbox sidebar should preserve unread counts per conversation',
    );

    const seekerMessageDelta = await requestJson(
      baseUrl,
      `/api/messages/${conversationId}/delta?after=${encodeURIComponent(firstMessage.json.message.createdAt)}`,
      {
        token: activeSeekerToken,
      },
    );
    assert.equal(
      seekerMessageDelta.status,
      200,
      'Participants should be able to load incremental thread updates',
    );
    assert.equal(
      seekerMessageDelta.json.messages.some(
        (message) => message.id === attachmentMessage.json.message.id,
      ),
      true,
      'Message delta responses should include newer thread messages',
    );

    const unauthorizedConversationAccess = await requestJson(baseUrl, `/api/messages/${conversationId}`, {
      token: freelancerToken,
    });
    assert.equal(
      unauthorizedConversationAccess.status,
      403,
      'Users outside a conversation must be blocked from reading that thread',
    );

    const seekerMessages = await requestJson(baseUrl, `/api/messages/${conversationId}`, {
      token: activeSeekerToken,
    });
    assert.equal(seekerMessages.status, 200, 'Conversation messages should load for participants');
    assert.equal(seekerMessages.json.messages.length, 2, 'The conversation should include text and attachment messages');
    assert.equal(
      seekerMessages.json.messages[1].attachmentName,
      'launch-brief.pdf',
      'Message payloads should preserve attachment metadata',
    );
    assert.equal(
      seekerMessages.json.messages[1].attachmentUrl,
      messageAttachmentUrl,
      'Message payloads should preserve attachment URLs',
    );

    const markRead = await requestJson(baseUrl, `/api/messages/${conversationId}/read`, {
      method: 'PATCH',
      token: activeSeekerToken,
    });
    assert.equal(markRead.status, 200, 'Participants should be able to mark a conversation as read');

    const seekerConversationsAfterRead = await requestJson(baseUrl, '/api/messages', {
      token: activeSeekerToken,
    });
    assert.equal(seekerConversationsAfterRead.status, 200, 'Seeker conversations should still load after reading');
    const seekerConversationAfterRead = seekerConversationsAfterRead.json.conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    assert.equal(
      seekerConversationAfterRead.unreadCount,
      0,
      'Marking a thread as read must clear the unread conversation count',
    );

    const agreements = await requestJson(baseUrl, '/api/agreements', {
      token: employerToken,
    });
    assert.equal(agreements.status, 200, 'Employer agreements should load');
    assert.equal(agreements.json.agreements.length, 1, 'Hiring should create one agreement');

    const agreementId = agreements.json.agreements[0].id;
    const acceptSecondJobProposal = await requestJson(baseUrl, `/api/proposals/${secondJobProposalId}/status`, {
      method: 'PATCH',
      token: activeSeekerToken,
      body: {
        status: 'ACCEPTED',
      },
    });
    assert.equal(
      acceptSecondJobProposal.status,
      200,
      'Employers should be able to accept the second proposal and create another agreement',
    );
    const secondAgreementId = acceptSecondJobProposal.json.proposal.application.agreement.id;

    const employerAgreementComparison = await requestJson(baseUrl, '/api/agreements/compare', {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        agreementIds: [agreementId, secondAgreementId],
      },
    });
    assert.equal(
      employerAgreementComparison.status,
      200,
      'Agreement participants should be able to compare selected agreements',
    );
    assert.equal(
      typeof employerAgreementComparison.json.comparison.summary,
      'string',
      'Agreement comparison should return an AI comparison summary',
    );
    assert.equal(
      employerAgreementComparison.json.comparison.agreements.length,
      2,
      'Agreement comparison should return the selected agreements',
    );
    assert.equal(
      employerAgreementComparison.json.comparison.agreements[0].id,
      agreementId,
      'Agreement comparison should preserve the selected agreement order',
    );
    assert.equal(
      employerAgreementComparison.json.comparison.agreements[1].source.title,
      'React Platform Engineer',
      'Agreement comparison should include source context for each agreement',
    );

    const agreementDecisionBrief = await requestJson(
      baseUrl,
      `/api/agreements/${agreementId}/decision-brief`,
      {
        method: 'POST',
        token: activeSeekerToken,
        body: {},
      },
    );
    assert.equal(
      agreementDecisionBrief.status,
      200,
      'Agreement participants should be able to generate a decision brief for active agreements',
    );
    assert.equal(
      ['COMPLETE', 'HOLD', 'ESCALATE'].includes(agreementDecisionBrief.json.brief.recommendation),
      true,
      'Agreement decision briefs should return a valid recommendation',
    );
    assert.equal(
      typeof agreementDecisionBrief.json.brief.nextAction,
      'string',
      'Agreement decision briefs should include the next operational step',
    );
    assert.equal(
      typeof agreementDecisionBrief.json.brief.suggestedMessage,
      'string',
      'Agreement decision briefs should include a suggested message',
    );

    const disputeEvidenceUpload = await uploadEvidence({
      baseUrl,
      token: activeSeekerToken,
      category: 'dispute',
      fileName: 'final-payout-proof.pdf',
      contentType: 'application/pdf',
      rawContent: '%PDF-1.4 payout evidence for dispute review',
    });
    const disputeEvidenceUrl = new URL(
      disputeEvidenceUpload.json.file.url,
      baseUrl,
    ).toString();
    const disputeEvidenceFile = await requestBinary(
      baseUrl,
      disputeEvidenceUpload.json.file.url,
    );
    assert.equal(
      disputeEvidenceFile.status,
      200,
      'Uploaded dispute evidence should be publicly retrievable from the app path',
    );
    assert.equal(
      disputeEvidenceFile.buffer.byteLength > 0,
      true,
      'Uploaded dispute evidence should return a non-empty file payload',
    );

    const openDispute = await requestJson(baseUrl, `/api/agreements/${agreementId}/disputes`, {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        type: 'PAYMENT',
        title: 'Final payout timing',
        description: 'Need admin review before the agreement can be closed because the payout timing is contested.',
        evidenceUrl: disputeEvidenceUrl,
      },
    });
    assert.equal(openDispute.status, 201, 'Agreement participants should be able to open a dispute');
    const disputeId = openDispute.json.dispute.id;

    const duplicateDispute = await requestJson(baseUrl, `/api/agreements/${agreementId}/disputes`, {
      method: 'POST',
      token: employerToken,
      body: {
        type: 'PAYMENT',
        title: 'Second dispute should fail',
        description: 'Only one active dispute per agreement should be allowed.',
      },
    });
    assert.equal(duplicateDispute.status, 409, 'Only one active dispute per agreement should be allowed');

    const seekerDashboardWithDispute = await requestJson(baseUrl, '/api/users/dashboard', {
      token: activeSeekerToken,
    });
    assert.equal(seekerDashboardWithDispute.status, 200, 'Seeker dashboard should load dispute actions');
    assert.equal(
      seekerDashboardWithDispute.json.pendingDisputeActions,
      1,
      'Active agreement disputes should appear in dashboard dispute actions',
    );

    const blockedAgreementCompletion = await requestJson(baseUrl, `/api/agreements/${agreementId}/status`, {
      method: 'PATCH',
      token: employerToken,
      body: {
        status: 'COMPLETED',
      },
    });
    assert.equal(
      blockedAgreementCompletion.status,
      400,
      'Agreements with active disputes must reject completion until the dispute is resolved',
    );

    const reportJob = await requestJson(baseUrl, '/api/reports', {
      method: 'POST',
      token: activeSeekerToken,
      body: {
        type: 'job',
        targetId: jobId,
        reason: 'Suspicious listing',
        details: 'The job description looks misleading.',
      },
    });
    assert.equal(reportJob.status, 201, 'Reporting a job should succeed');
    const reportId = reportJob.json.report.id;

    const adminPassword = 'AdminPass123!';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: adminHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    const adminLogin = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@example.com',
        password: adminPassword,
      },
    });
    assert.equal(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.json.token;

    const nonAdminUsersAccess = await requestJson(baseUrl, '/api/admin/users', {
      token: employerToken,
    });
    assert.equal(nonAdminUsersAccess.status, 403, 'Non-admin users must be blocked from admin routes');

    const adminUsers = await requestJson(baseUrl, '/api/admin/users', {
      token: adminToken,
    });
    assert.equal(adminUsers.status, 200, 'Admin users list should load');

    const adminCreatedJob = await requestJson(baseUrl, '/api/admin/jobs', {
      method: 'POST',
      token: adminToken,
      body: {
        employerId,
        title: 'Admin Posted Operations Lead',
        description: 'Own multi-city operations delivery for the employer account.',
        location: 'Hybrid - Accra',
        type: 'Full-time',
        salary: 'GHS 8,000 / month',
        category: 'Operations',
      },
    });
    assert.equal(adminCreatedJob.status, 201, 'Admin should be able to post jobs on behalf of employer companies');
    assert.equal(
      adminCreatedJob.json.job.employer.email,
      employerRegister.json.user.email,
      'Admin-created jobs should belong to the selected employer account',
    );
    assert.equal(
      adminCreatedJob.json.job.postedByAdmin.email,
      'admin@example.com',
      'Admin-created jobs should preserve who posted them on behalf of the company',
    );

    const adminReports = await requestJson(baseUrl, '/api/admin/reports', {
      token: adminToken,
    });
    assert.equal(adminReports.status, 200, 'Admin reports list should load');
    assert.equal(adminReports.json.reports.length, 1, 'Admin should see the submitted report');

    const adminVerifications = await requestJson(baseUrl, '/api/admin/verifications', {
      token: adminToken,
    });
    assert.equal(adminVerifications.status, 200, 'Admin verification queue should load');
    assert.equal(
      adminVerifications.json.verifications.some((verification) => verification.user.id === employerId),
      true,
      'Admin should see employer verification requests',
    );
    assert.equal(
      adminVerifications.json.verifications.some((verification) => verification.user.id === freelancerId),
      true,
      'Admin should see freelancer verification requests',
    );

    const adminDisputes = await requestJson(baseUrl, '/api/admin/disputes', {
      token: adminToken,
    });
    assert.equal(adminDisputes.status, 200, 'Admin disputes queue should load');
    assert.equal(
      adminDisputes.json.disputes.some((dispute) => dispute.id === disputeId),
      true,
      'Admin should see the active agreement dispute',
    );

    const moveDisputeIntoReview = await requestJson(
      baseUrl,
      `/api/admin/disputes/${disputeId}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'UNDER_REVIEW',
        },
      },
    );
    assert.equal(moveDisputeIntoReview.status, 200, 'Admin should be able to move a dispute into review');

    const resolveDispute = await requestJson(
      baseUrl,
      `/api/admin/disputes/${disputeId}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'RESOLVED',
          resolutionNote: 'Payout sequencing clarified and the agreement can proceed to closure.',
        },
      },
    );
    assert.equal(resolveDispute.status, 200, 'Admin should be able to resolve a dispute');

    const approveEmployerVerification = await requestJson(
      baseUrl,
      `/api/admin/verifications/${employerVerificationRequest.json.verification.id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'APPROVED',
        },
      },
    );
    assert.equal(approveEmployerVerification.status, 200, 'Admin should be able to approve employer verification requests');

    const requestMoreFreelancerVerificationInfo = await requestJson(
      baseUrl,
      `/api/admin/verifications/${freelancerVerificationRequest.json.verification.id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'NEEDS_INFO',
          reviewNote: 'Please include a portfolio link that clearly shows client-ready work and your professional identity.',
          internalNote: 'Flag for manual identity cross-check after clearer case studies are submitted.',
        },
      },
    );
    assert.equal(requestMoreFreelancerVerificationInfo.status, 200, 'Admin should be able to request more verification detail');

    const freelancerVerificationNeedsInfoState = await requestJson(baseUrl, '/api/users/verification', {
      token: freelancerToken,
    });
    assert.equal(freelancerVerificationNeedsInfoState.status, 200, 'Freelancers should be able to load verification feedback');
    assert.equal(
      freelancerVerificationNeedsInfoState.json.verificationStatus,
      'NEEDS_INFO',
      'Verification feedback should expose the needs-info status',
    );
    assert.equal(
      freelancerVerificationNeedsInfoState.json.latestVerificationRequest.reviewNote.includes('portfolio link'),
      true,
      'Verification feedback should include the admin review note',
    );
    assert.equal(
      freelancerVerificationNeedsInfoState.json.verificationHistory.length,
      1,
      'Verification history should include the latest reviewed request',
    );
    assert.equal(
      'internalNote' in freelancerVerificationNeedsInfoState.json.latestVerificationRequest,
      false,
      'Internal verification notes must not leak to requester-facing verification payloads',
    );
    assert.equal(
      freelancerVerificationNeedsInfoState.json.latestVerificationRequest.documentUrl,
      freelancerVerificationDocumentUrl,
      'Verification payloads should preserve uploaded evidence URLs',
    );

    const resubmittedFreelancerEvidenceUpload = await uploadEvidence({
      baseUrl,
      token: freelancerToken,
      category: 'verification',
      fileName: 'freelancer-portfolio-refresh.pdf',
      contentType: 'application/pdf',
      rawContent: '%PDF-1.4 updated portfolio case studies',
    });
    const resubmittedFreelancerDocumentUrl = new URL(
      resubmittedFreelancerEvidenceUpload.json.file.url,
      baseUrl,
    ).toString();

    const resubmitFreelancerVerification = await requestJson(baseUrl, '/api/users/verification', {
      method: 'POST',
      token: freelancerToken,
      body: {
        details: 'Updated portfolio link with named case studies, deliverables, and a professional bio for identity matching.',
        documentUrl: resubmittedFreelancerDocumentUrl,
      },
    });
    assert.equal(resubmitFreelancerVerification.status, 201, 'Freelancers should be able to resubmit after more info is requested');

    const adminVerificationsAfterResubmission = await requestJson(baseUrl, '/api/admin/verifications', {
      token: adminToken,
    });
    assert.equal(adminVerificationsAfterResubmission.status, 200, 'Admin verification queue should still load after resubmission');
    const resubmittedFreelancerVerification = adminVerificationsAfterResubmission.json.verifications.find(
      (verification) => verification.id === resubmitFreelancerVerification.json.verification.id,
    );
    assert.equal(Boolean(resubmittedFreelancerVerification), true, 'Admin should see the resubmitted verification request');
    assert.equal(
      resubmittedFreelancerVerification.submissionCount,
      2,
      'Admin should see how many times the user has submitted this verification type',
    );
    assert.equal(
      resubmittedFreelancerVerification.history.length,
      1,
      'Admin should receive prior verification attempts for richer moderation context',
    );
    assert.equal(
      resubmittedFreelancerVerification.history[0].internalNote.includes('manual identity cross-check'),
      true,
      'Admin-only verification history should preserve internal moderation notes',
    );

    const approveFreelancerVerification = await requestJson(
      baseUrl,
      `/api/admin/verifications/${resubmitFreelancerVerification.json.verification.id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'APPROVED',
        },
      },
    );
    assert.equal(approveFreelancerVerification.status, 200, 'Admin should be able to approve the resubmitted freelancer verification request');

    const agreementsAfterResolvedDispute = await requestJson(baseUrl, '/api/agreements', {
      token: employerToken,
    });
    assert.equal(agreementsAfterResolvedDispute.status, 200, 'Agreements should still load after a dispute is resolved');
    const disputedAgreementAfterResolution = agreementsAfterResolvedDispute.json.agreements.find(
      (agreement) => agreement.id === agreementId,
    );
    assert.equal(
      Boolean(disputedAgreementAfterResolution),
      true,
      'The original disputed agreement should still be present after resolution',
    );
    assert.equal(
      disputedAgreementAfterResolution.disputes[0].status,
      'RESOLVED',
      'Resolved disputes should be visible on agreement payloads',
    );

    const completeAgreement = await requestJson(baseUrl, `/api/agreements/${agreementId}/status`, {
      method: 'PATCH',
      token: employerToken,
      body: {
        status: 'COMPLETED',
      },
    });
    assert.equal(completeAgreement.status, 200, 'Agreement completion should succeed after dispute resolution');

    const completedApplication = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true },
    });
    assert.equal(completedApplication?.status, 'COMPLETED', 'Agreement completion must propagate to the application');

    const mutateClosedApplication = await requestJson(baseUrl, `/api/jobs/applications/${applicationId}/status`, {
      method: 'PATCH',
      token: employerToken,
      body: {
        status: 'INTERVIEW',
      },
    });
    assert.equal(
      mutateClosedApplication.status,
      400,
      'Closed-agreement applications must reject later status changes',
    );

    const publicJobWithVerifiedEmployer = await requestJson(baseUrl, `/api/jobs/${jobId}`);
    assert.equal(publicJobWithVerifiedEmployer.status, 200, 'Public job detail should load for active jobs');
    assert.equal(
      publicJobWithVerifiedEmployer.json.job.employer.isVerified,
      true,
      'Approved employers should expose verification on public job details',
    );

    const resolveReport = await requestJson(baseUrl, `/api/admin/reports/${reportId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'RESOLVED',
      },
    });
    assert.equal(resolveReport.status, 200, 'Admin should be able to resolve a report');

    const resolvedReport = await prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true },
    });
    assert.equal(resolvedReport?.status, 'RESOLVED', 'Resolved report status must persist');

    const bulkDismissReports = await requestJson(baseUrl, '/api/admin/reports/bulk-status', {
      method: 'PATCH',
      token: adminToken,
      body: {
        reportIds: [reportId],
        status: 'DISMISSED',
      },
    });
    assert.equal(bulkDismissReports.status, 200, 'Admin should be able to bulk update report statuses');
    assert.equal(bulkDismissReports.json.updatedCount, 1, 'Bulk report moderation should report how many reports changed');

    const flagJob = await requestJson(baseUrl, `/api/admin/jobs/${jobId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'FLAGGED',
      },
    });
    assert.equal(flagJob.status, 200, 'Admin should be able to flag a job');

    const publicJobsAfterFlag = await requestJson(baseUrl, '/api/jobs');
    assert.equal(publicJobsAfterFlag.status, 200, 'Public jobs should still load');
    assert.equal(
      publicJobsAfterFlag.json.jobs.some((job) => job.id === jobId),
      false,
      'Flagged jobs must be hidden from the public jobs feed',
    );

    const bulkSuspendJobs = await requestJson(baseUrl, '/api/admin/jobs/bulk-status', {
      method: 'PATCH',
      token: adminToken,
      body: {
        jobIds: [jobId, adminCreatedJob.json.job.id],
        status: 'SUSPENDED',
      },
    });
    assert.equal(bulkSuspendJobs.status, 200, 'Admin should be able to bulk update job statuses');
    assert.equal(bulkSuspendJobs.json.updatedCount, 2, 'Bulk job moderation should report how many jobs changed');

    const employerVerificationState = await requestJson(baseUrl, '/api/users/verification', {
      token: employerToken,
    });
    assert.equal(
      employerVerificationState.json.isVerified,
      true,
      'Approved employers should see an active verification state',
    );

    const flagService = await requestJson(baseUrl, `/api/admin/services/${serviceId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'FLAGGED',
      },
    });
    assert.equal(flagService.status, 200, 'Admin should be able to flag a service');

    const publicServicesAfterFlag = await requestJson(baseUrl, '/api/services');
    assert.equal(publicServicesAfterFlag.status, 200, 'Public services should still load');
    assert.equal(
      publicServicesAfterFlag.json.services.some((service) => service.id === serviceId),
      false,
      'Flagged services must be hidden from the public services feed',
    );

    const freelancerProfileWithVerification = await requestJson(
      baseUrl,
      `/api/services/freelancer/${freelancerId}`,
    );
    assert.equal(
      freelancerProfileWithVerification.json.profile.isVerified,
      true,
      'Approved freelancers should expose verification on their public profile',
    );

    const bulkSuspendServices = await requestJson(baseUrl, '/api/admin/services/bulk-status', {
      method: 'PATCH',
      token: adminToken,
      body: {
        serviceIds: [serviceId],
        status: 'SUSPENDED',
      },
    });
    assert.equal(bulkSuspendServices.status, 200, 'Admin should be able to bulk update service statuses');
    assert.equal(bulkSuspendServices.json.updatedCount, 1, 'Bulk service moderation should report how many services changed');

    const bulkFlagUsers = await requestJson(baseUrl, '/api/admin/users/bulk-status', {
      method: 'PATCH',
      token: adminToken,
      body: {
        userIds: [activeSeekerRegister.json.user.id],
        status: 'FLAGGED',
      },
    });
    assert.equal(bulkFlagUsers.status, 200, 'Admin should be able to bulk update user statuses');
    assert.equal(bulkFlagUsers.json.updatedCount, 1, 'Bulk user moderation should report how many users changed');

    const suspendUser = await requestJson(baseUrl, `/api/admin/users/${activeSeekerRegister.json.user.id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'SUSPENDED',
      },
    });
    assert.equal(suspendUser.status, 200, 'Admin should be able to suspend a user');

    const suspendedDashboard = await requestJson(baseUrl, '/api/users/dashboard', {
      token: activeSeekerToken,
    });
    assert.equal(
      suspendedDashboard.status,
      403,
      'Users suspended by admin must be blocked from protected routes immediately',
    );

    console.log('Smoke test passed');
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
