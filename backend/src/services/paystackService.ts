import axios from 'axios';
import env from '../config/env';
import logger from '../config/logger';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    customer: {
      email: string;
    };
  };
}

class PaystackService {
  private secretKey: string;

  constructor() {
    this.secretKey = env.paystackSecretKey;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Initialize a transaction and get the checkout URL.
   */
  async initializeTransaction(params: {
    email: string;
    amount: number; // in minor units (e.g. pesewas or cents)
    currency?: string; // e.g. GHS, USD
    reference: string;
    callback_url?: string;
    metadata?: any;
  }) {
    try {
      const response = await axios.post<PaystackInitializeResponse>(
        `${PAYSTACK_BASE_URL}/transaction/initialize`,
        params,
        { headers: this.headers }
      );
      return response.data;
    } catch (error: any) {
      logger.error('paystack_initialize_error', { error: error.response?.data || error.message });
      throw error;
    }
  }

  /**
   * Verify a transaction by reference.
   */
  async verifyTransaction(reference: string) {
    try {
      const response = await axios.get<PaystackVerifyResponse>(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error: any) {
      logger.error('paystack_verify_error', { error: error.response?.data || error.message });
      throw error;
    }
  }

  /**
   * Create a transfer recipient for automated payouts.
   */
  async createTransferRecipient(params: {
    type: 'mobile_money' | 'ghipss';
    name: string;
    account_number: string;
    bank_code: string;
    currency: string;
  }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transferrecipient`,
        params,
        { headers: this.headers }
      );
      return response.data;
    } catch (error: any) {
      logger.error('paystack_create_recipient_error', { error: error.response?.data || error.message });
      throw error;
    }
  }

  /**
   * List all banks supported in a country.
   */
  async listBanks(country: string = 'ghana') {
    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/bank?country=${country}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error: any) {
      logger.error('paystack_list_banks_error', { error: error.response?.data || error.message });
      throw error;
    }
  }

  /**
   * Initiate a transfer/payout to a freelancer.
   */
  async initiateTransfer(params: {
    source: 'balance';
    amount: number; // in minor units
    currency?: string; // GHS, USD
    recipient: string; // recipient_code
    reason?: string;
    reference?: string;
  }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transfer`,
        params,
        { headers: this.headers }
      );
      return response.data;
    } catch (error: any) {
      logger.error('paystack_initiate_transfer_error', { error: error.response?.data || error.message });
      throw error;
    }
  }
}

export const paystackService = new PaystackService();
