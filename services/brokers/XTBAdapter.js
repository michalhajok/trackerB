// services/brokers/XTBAdapter.js - AKTUALIZACJA ISTNIEJĄCEGO
const BrokerAdapter = require("./BrokerAdapter");

class XTBAdapter extends BrokerAdapter {
  constructor() {
    super("XTB");
    this.supportedOperations = [
      "positions",
      "transactions",
      "realtime",
      "orders",
    ];
  }

  getRequiredCredentials() {
    return ["login", "password"]; // or API key if available
  }

  async getPositions(brokerConfig) {
    // Use existing XTB integration code
    // But adapt to new broker config format
    const { accountId, apiCredentials } = brokerConfig;

    try {
      // Your existing XTB API calls here
      const positions = await this.xtbApi.getPositions();
      return positions;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  normalizePosition(xtbPosition) {
    return {
      symbol: xtbPosition.symbol,
      name: xtbPosition.customComment || xtbPosition.symbol,
      volume: xtbPosition.volume,
      openPrice: xtbPosition.open_price,
      marketPrice: xtbPosition.close_price, // Current market price
      currency: "USD", // XTB typically USD
      type: xtbPosition.cmd === 0 ? "BUY" : "SELL",
      openTime: new Date(xtbPosition.open_time),
      commission: xtbPosition.commission,
      swap: xtbPosition.storage,
      grossPL: xtbPosition.profit,
      status: xtbPosition.close_time ? "closed" : "open",
      closeTime: xtbPosition.close_time
        ? new Date(xtbPosition.close_time)
        : null,
      closePrice: xtbPosition.close_price,
    };
  }

  async testConnection(credentials) {
    try {
      // Test XTB connection
      await this.authenticate(credentials);
      return { success: true, message: "Connection successful" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = XTBAdapter;
