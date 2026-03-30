import { PrismaClient } from '@prisma/client';

type AgreementEventClient = Pick<PrismaClient, 'agreementEvent'>;

type CreateAgreementEventInput = {
  agreementId: string;
  actorId?: string | null;
  eventType: string;
  message: string;
  fromStatus?: string | null;
  toStatus?: string | null;
};

export const createAgreementEvent = async (
  client: AgreementEventClient,
  { agreementId, actorId, eventType, message, fromStatus, toStatus }: CreateAgreementEventInput
) => {
  return client.agreementEvent.create({
    data: {
      agreementId,
      actorId: actorId || null,
      eventType,
      message,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null
    }
  });
};
