// services/CurrencyService.js - NOWY PLIK
const axios = require("axios");

class CurrencyService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60 * 60 * 1000; // 1 hour
    this.apiKey = process.env.EXCHANGE_RATE_API_KEY;
    this.baseUrl = "https://api.exchangerate-api.com/v4/latest";
  }

  async getExchangeRate(from, to) {
    if (from === to) return 1;

    const cacheKey = `${from}_${to}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.rate;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/${from}`, {
        timeout: 5000,
      });

      const rate = response.data.rates[to];
      if (!rate) {
        throw new Error(`Exchange rate not found for ${from} to ${to}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        rate,
        timestamp: Date.now(),
      });

      return rate;
    } catch (error) {
      console.error("Exchange rate fetch error:", error);

      // Return cached rate if available, even if expired
      if (cached) {
        return cached.rate;
      }

      throw new Error(`Failed to get exchange rate from ${from} to ${to}`);
    }
  }

  async convertAmount(amount, from, to) {
    const rate = await this.getExchangeRate(from, to);
    return amount * rate;
  }

  async convertPortfolioValues(portfolios, targetCurrency) {
    const results = [];

    for (const portfolio of portfolios) {
      const converted = { ...portfolio };

      if (portfolio.currency !== targetCurrency) {
        const rate = await this.getExchangeRate(
          portfolio.currency,
          targetCurrency
        );
        converted.stats.totalValue *= rate;
        converted.stats.totalPL *= rate;
        converted.convertedCurrency = targetCurrency;
        converted.exchangeRate = rate;
      }

      results.push(converted);
    }

    return results;
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }
}

module.exports = new CurrencyService();
