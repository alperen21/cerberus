/**
 * Google CrUX API Integration for Cerberus
 * Handles high-reputation domain identification based on Chrome User Experience metrics
 */

class CruxIntegration {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
    this.rateLimit = {
      requestsPerMinute: 150,
      requestInterval: 60000 / 150, // ~400ms between requests
      lastRequestTime: 0
    };
  }

  /**
   * Batch analyze multiple domains for reputation scoring
   */
  async analyzeDomainsBatch(domains) {
    const results = [];

    for (const domain of domains) {
      try {
        await this.enforceRateLimit();

        const metrics = await this.getDomainMetrics(domain);
        const reputation = this.calculateReputationScore(metrics);

        results.push({
          domain,
          reputation,
          metrics,
          timestamp: Date.now()
        });

        console.log(`Analyzed ${domain}: reputation score ${reputation.score}/100`);
      } catch (error) {
        console.warn(`Failed to analyze ${domain}:`, error.message);
        results.push({
          domain,
          reputation: { score: 0, reason: error.message },
          metrics: null,
          timestamp: Date.now()
        });
      }
    }

    return results;
  }

  /**
   * Get comprehensive metrics for a domain across multiple form factors
   */
  async getDomainMetrics(domain) {
    const formFactors = ['DESKTOP', 'PHONE'];
    const metrics = {};

    for (const formFactor of formFactors) {
      try {
        const data = await this.queryRecord(domain, formFactor);
        metrics[formFactor.toLowerCase()] = data;
      } catch (error) {
        console.warn(`Failed to get ${formFactor} metrics for ${domain}:`, error.message);
        metrics[formFactor.toLowerCase()] = null;
      }
    }

    return metrics;
  }

  /**
   * Query CrUX API for specific domain and form factor
   */
  async queryRecord(domain, formFactor = 'DESKTOP') {
    const requestBody = {
      origin: `https://${domain}`,
      formFactor,
      metrics: [
        'largest_contentful_paint',
        'first_contentful_paint',
        'interaction_to_next_paint',
        'cumulative_layout_shift',
        'experimental_time_to_first_byte'
      ]
    };

    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`CrUX API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    if (!data.record) {
      throw new Error('No data available for this domain');
    }

    return data.record;
  }

  /**
   * Calculate reputation score based on CrUX metrics
   * Higher scores indicate better reputation (0-100 scale)
   */
  calculateReputationScore(metricsData) {
    let totalScore = 0;
    let scoreCount = 0;
    const details = {};

    // Weight different form factors
    const formFactorWeights = {
      desktop: 0.4,
      phone: 0.6 // Mobile performance is more critical
    };

    for (const [formFactor, data] of Object.entries(metricsData)) {
      if (!data || !data.metrics) continue;

      const factorScore = this.calculateFormFactorScore(data.metrics);
      const weight = formFactorWeights[formFactor] || 0.5;

      totalScore += factorScore.score * weight;
      scoreCount += weight;
      details[formFactor] = factorScore;
    }

    const finalScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

    return {
      score: finalScore,
      isHighReputation: finalScore >= 70, // Threshold for high reputation
      details,
      recommendation: this.getRecommendation(finalScore)
    };
  }

  /**
   * Calculate score for specific form factor metrics
   */
  calculateFormFactorScore(metrics) {
    const scores = {};
    let totalScore = 0;
    let metricCount = 0;

    // Largest Contentful Paint (LCP) scoring
    if (metrics.largest_contentful_paint) {
      const lcp = metrics.largest_contentful_paint.percentiles?.p75;
      if (lcp !== undefined) {
        scores.lcp = this.scoreLCP(lcp);
        totalScore += scores.lcp * 0.3; // 30% weight
        metricCount += 0.3;
      }
    }

    // First Contentful Paint (FCP) scoring
    if (metrics.first_contentful_paint) {
      const fcp = metrics.first_contentful_paint.percentiles?.p75;
      if (fcp !== undefined) {
        scores.fcp = this.scoreFCP(fcp);
        totalScore += scores.fcp * 0.2; // 20% weight
        metricCount += 0.2;
      }
    }

    // Interaction to Next Paint (INP) scoring
    if (metrics.interaction_to_next_paint) {
      const inp = metrics.interaction_to_next_paint.percentiles?.p75;
      if (inp !== undefined) {
        scores.inp = this.scoreINP(inp);
        totalScore += scores.inp * 0.3; // 30% weight
        metricCount += 0.3;
      }
    }

    // Cumulative Layout Shift (CLS) scoring
    if (metrics.cumulative_layout_shift) {
      const cls = metrics.cumulative_layout_shift.percentiles?.p75;
      if (cls !== undefined) {
        scores.cls = this.scoreCLS(cls);
        totalScore += scores.cls * 0.2; // 20% weight
        metricCount += 0.2;
      }
    }

    return {
      score: metricCount > 0 ? Math.round(totalScore / metricCount) : 0,
      breakdown: scores
    };
  }

  /**
   * Score Largest Contentful Paint (LCP)
   * Good: ≤ 2.5s, Needs Improvement: 2.5-4.0s, Poor: > 4.0s
   */
  scoreLCP(lcp) {
    if (lcp <= 2500) return 100;
    if (lcp <= 4000) return Math.round(100 - ((lcp - 2500) / 1500) * 50);
    return Math.max(0, Math.round(50 - ((lcp - 4000) / 4000) * 50));
  }

  /**
   * Score First Contentful Paint (FCP)
   * Good: ≤ 1.8s, Needs Improvement: 1.8-3.0s, Poor: > 3.0s
   */
  scoreFCP(fcp) {
    if (fcp <= 1800) return 100;
    if (fcp <= 3000) return Math.round(100 - ((fcp - 1800) / 1200) * 50);
    return Math.max(0, Math.round(50 - ((fcp - 3000) / 3000) * 50));
  }

  /**
   * Score Interaction to Next Paint (INP)
   * Good: ≤ 200ms, Needs Improvement: 200-500ms, Poor: > 500ms
   */
  scoreINP(inp) {
    if (inp <= 200) return 100;
    if (inp <= 500) return Math.round(100 - ((inp - 200) / 300) * 50);
    return Math.max(0, Math.round(50 - ((inp - 500) / 500) * 50));
  }

  /**
   * Score Cumulative Layout Shift (CLS)
   * Good: ≤ 0.1, Needs Improvement: 0.1-0.25, Poor: > 0.25
   */
  scoreCLS(cls) {
    if (cls <= 0.1) return 100;
    if (cls <= 0.25) return Math.round(100 - ((cls - 0.1) / 0.15) * 50);
    return Math.max(0, Math.round(50 - ((cls - 0.25) / 0.25) * 50));
  }

  /**
   * Get recommendation based on reputation score
   */
  getRecommendation(score) {
    if (score >= 85) return 'Excellent - Highly trusted domain';
    if (score >= 70) return 'Good - Safe to whitelist';
    if (score >= 50) return 'Fair - Consider additional verification';
    if (score >= 30) return 'Poor - Exercise caution';
    return 'Very Poor - Not recommended for whitelist';
  }

  /**
   * Enforce rate limiting for CrUX API
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimit.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimit.requestInterval) {
      const waitTime = this.rateLimit.requestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.rateLimit.lastRequestTime = Date.now();
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey() {
    try {
      await this.queryRecord('google.com', 'DESKTOP');
      return { valid: true, message: 'API key is valid' };
    } catch (error) {
      return {
        valid: false,
        message: `API key validation failed: ${error.message}`
      };
    }
  }

  /**
   * Get popular domains for initial reputation analysis
   */
  getPopularDomainsForAnalysis() {
    return [
      // High-traffic legitimate sites for baseline
      'reddit.com', 'stackoverflow.com', 'medium.com', 'github.com',
      'wikipedia.org', 'npmjs.com', 'docker.com', 'atlassian.com',
      'salesforce.com', 'adobe.com', 'nvidia.com', 'intel.com',
      'mongodb.com', 'postgresql.org', 'mysql.com', 'cloudflare.com',
      'wordpress.com', 'blogger.com', 'tumblr.com', 'squarespace.com',
      'wix.com', 'shopify.com', 'bigcommerce.com', 'magento.com',
      'stripe.com', 'square.com', 'twilio.com', 'sendgrid.com',
      'mailchimp.com', 'constantcontact.com', 'hubspot.com',
      'zendesk.com', 'freshdesk.com', 'intercom.com'
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CruxIntegration;
} else if (typeof window !== 'undefined') {
  window.CruxIntegration = CruxIntegration;
}