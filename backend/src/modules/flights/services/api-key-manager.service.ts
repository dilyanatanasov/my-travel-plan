import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ApiKeyState {
  key: string;
  isExhausted: boolean;
  exhaustedAt?: Date;
  requestCount: number;
}

@Injectable()
export class ApiKeyManagerService {
  private readonly logger = new Logger(ApiKeyManagerService.name);
  private readonly rapidApiHost = 'kiwi-com-cheap-flights.p.rapidapi.com';
  private keys: ApiKeyState[] = [];
  private currentKeyIndex = 0;

  constructor(private readonly configService: ConfigService) {
    this.initializeKeys();
  }

  private initializeKeys(): void {
    // Load keys from environment - support comma-separated list
    const keysString = this.configService.get<string>('RAPIDAPI_KEYS', '');
    const singleKey = this.configService.get<string>('RAPIDAPI_KEY', '');

    const allKeys: string[] = [];

    // Add keys from RAPIDAPI_KEYS (comma-separated)
    if (keysString) {
      const parsed = keysString.split(',').map((k) => k.trim()).filter((k) => k);
      allKeys.push(...parsed);
    }

    // Add single key if not already in the list
    if (singleKey && !allKeys.includes(singleKey)) {
      allKeys.push(singleKey);
    }

    // Initialize key states
    this.keys = allKeys.map((key) => ({
      key,
      isExhausted: false,
      requestCount: 0,
    }));

    this.logger.log(`Initialized ${this.keys.length} API key(s) for rotation`);
  }

  /**
   * Get the current active API key
   */
  getCurrentKey(): string | null {
    if (this.keys.length === 0) {
      return null;
    }

    // Find first non-exhausted key starting from current index
    for (let i = 0; i < this.keys.length; i++) {
      const index = (this.currentKeyIndex + i) % this.keys.length;
      const keyState = this.keys[index];

      // Check if key was exhausted more than 1 hour ago - reset it
      if (keyState.isExhausted && keyState.exhaustedAt) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (keyState.exhaustedAt < hourAgo) {
          this.logger.log(`Resetting key ${index + 1} after 1 hour cooldown`);
          keyState.isExhausted = false;
          keyState.exhaustedAt = undefined;
        }
      }

      if (!keyState.isExhausted) {
        this.currentKeyIndex = index;
        return keyState.key;
      }
    }

    // All keys exhausted
    this.logger.warn('All API keys are exhausted!');
    return null;
  }

  /**
   * Get the RapidAPI host
   */
  getHost(): string {
    return this.rapidApiHost;
  }

  /**
   * Mark the current key as exhausted and rotate to next
   */
  markCurrentKeyExhausted(): void {
    if (this.keys.length === 0) return;

    const keyState = this.keys[this.currentKeyIndex];
    keyState.isExhausted = true;
    keyState.exhaustedAt = new Date();

    this.logger.warn(
      `API key ${this.currentKeyIndex + 1}/${this.keys.length} exhausted after ${keyState.requestCount} requests`,
    );

    // Try to rotate to next key
    const nextKey = this.getCurrentKey();
    if (nextKey) {
      this.logger.log(`Rotated to API key ${this.currentKeyIndex + 1}/${this.keys.length}`);
    }
  }

  /**
   * Record a successful request
   */
  recordRequest(): void {
    if (this.keys.length === 0) return;
    this.keys[this.currentKeyIndex].requestCount++;
  }

  /**
   * Check if response indicates quota exhaustion
   */
  isQuotaError(status: number, responseText: string): boolean {
    // RapidAPI typically returns 429 for rate limit or quota exceeded
    if (status === 429) return true;

    // Also check for quota-related messages
    const lowerText = responseText.toLowerCase();
    return (
      lowerText.includes('quota') ||
      lowerText.includes('rate limit') ||
      lowerText.includes('exceeded') ||
      lowerText.includes('limit reached')
    );
  }

  /**
   * Check if any key is available
   */
  hasAvailableKey(): boolean {
    return this.getCurrentKey() !== null;
  }

  /**
   * Get status of all keys for debugging
   */
  getStatus(): { total: number; available: number; exhausted: number; currentIndex: number } {
    const exhausted = this.keys.filter((k) => k.isExhausted).length;
    return {
      total: this.keys.length,
      available: this.keys.length - exhausted,
      exhausted,
      currentIndex: this.currentKeyIndex,
    };
  }

  /**
   * Make an API request with automatic key rotation on quota errors
   */
  async fetchWithRotation(url: string, options: RequestInit = {}): Promise<Response> {
    const maxRetries = this.keys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = this.getCurrentKey();

      if (!apiKey) {
        throw new Error('No API keys available - all keys exhausted');
      }

      const headers = {
        ...options.headers,
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': this.rapidApiHost,
      };

      try {
        const response = await fetch(url, { ...options, headers });

        // Check for quota error
        if (!response.ok) {
          const responseText = await response.text();

          if (this.isQuotaError(response.status, responseText)) {
            this.logger.warn(`Quota error on key ${this.currentKeyIndex + 1}: ${responseText.substring(0, 100)}`);
            this.markCurrentKeyExhausted();
            continue; // Try next key
          }

          // Non-quota error - return as-is for caller to handle
          // Need to create a new response since we consumed the body
          return new Response(responseText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }

        // Success!
        this.recordRequest();
        return response;
      } catch (error) {
        lastError = error as Error;
        this.logger.error(`Request failed on key ${this.currentKeyIndex + 1}: ${(error as Error).message}`);
      }
    }

    throw lastError || new Error('All API keys exhausted');
  }
}
