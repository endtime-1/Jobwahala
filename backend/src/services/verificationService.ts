import { IDApi, JOB_TYPE } from 'smile-identity-core';
import env from '../config/env';
import logger from '../config/logger';

export type GhanaCardVerificationParams = {
  idNumber: string;
  firstName: string;
  lastName: string;
  dob: string; // ISO format YYYY-MM-DD
  userId: string;
};

class VerificationService {
  private partnerId: string;
  private apiKey: string;
  private sidServer: string;

  constructor() {
    this.partnerId = env.smileIdPartnerId;
    this.apiKey = env.smileIdApiKey;
    this.sidServer = env.smileIdServer === '1' ? '1' : '0'; // '1' for production, '0' for sandbox
  }

  /**
   * Verify a Ghana Card using Smile ID Enhanced KYC.
   */
  async verifyGhanaCard(params: GhanaCardVerificationParams) {
    const { idNumber, firstName, lastName, dob, userId } = params;

    const connection = new IDApi(this.partnerId, this.apiKey, this.sidServer);
    const jobId = `job-${userId}-${Date.now()}`;
    
    const partnerParams = {
      user_id: userId,
      job_id: jobId,
      job_type: JOB_TYPE.ENHANCED_KYC,
    };

    const idInfo = {
      country: 'GH',
      id_type: 'GHANA_CARD',
      id_number: idNumber,
      first_name: firstName,
      last_name: lastName,
      dob: dob,
    };

    try {
      logger.info('submitting_ghana_card_verification', { userId, jobId, idType: 'GHANA_CARD' });
      
      const response = await connection.submit_job<any>(partnerParams, idInfo);

      // ResultCode 1012 in Enhanced KYC synchronous responses usually means successfully queried
      if (response && (response.ResultCode === '1012' || response.ResultCode === 1012)) {
        return {
          success: true,
          status: response.ResultText || 'Verification successful',
          jobId,
          result: response,
        };
      }

      return {
        success: false,
        status: response.ResultText || 'Verification failed',
        jobId,
        result: response,
      };
    } catch (error) {
      logger.error('ghana_card_verification_error', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Check the status of a previously submitted job.
   */
  async getJobStatus(userId: string, jobId: string, jobType: number = JOB_TYPE.ENHANCED_KYC) {
    const connection = new IDApi(this.partnerId, this.apiKey, this.sidServer);
    
    try {
      const partnerParams = {
        user_id: userId,
        job_id: jobId,
        job_type: jobType,
      };
      const response = await connection.pollJobStatus(partnerParams);
      return response;
    } catch (error) {
      logger.error('get_job_status_error', { 
        userId, 
        jobId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
}

export const verificationService = new VerificationService();
