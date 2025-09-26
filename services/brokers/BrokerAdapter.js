// services/brokers/BrokerAdapter.js - NOWY PLIK
class BrokerAdapter {
  constructor(brokerName) {
    this.brokerName = brokerName;
    this.supportedOperations = [];
  }

  // Abstract methods - must be implemented by subclasses
  async authenticate(credentials) {
    throw new Error("authenticate() must be implemented");
  }

  async getPositions(brokerConfig) {
    throw new Error("getPositions() must be implemented");
  }

  async getAccountInfo(credentials) {
    throw new Error("getAccountInfo() must be implemented");
  }

  async testConnection(credentials) {
    throw new Error("testConnection() must be implemented");
  }

  normalizePosition(brokerPosition) {
    throw new Error("normalizePosition() must be implemented");
  }

  // Optional methods
  async getTransactions(brokerConfig, dateRange) {
    throw new Error("getTransactions() not implemented for this broker");
  }

  async placeOrder(brokerConfig, orderData) {
    throw new Error("placeOrder() not implemented for this broker");
  }

  async getMarketData(symbol) {
    throw new Error("getMarketData() not implemented for this broker");
  }

  // Utility methods
  formatError(error) {
    return {
      broker: this.brokerName,
      message: error.message,
      code: error.code || "UNKNOWN",
      timestamp: new Date(),
    };
  }

  validateCredentials(credentials) {
    const required = this.getRequiredCredentials();
    const missing = required.filter((field) => !credentials[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required credentials: ${missing.join(", ")}`);
    }
  }

  getRequiredCredentials() {
    return []; // Override in subclasses
  }
}

module.exports = BrokerAdapter;
