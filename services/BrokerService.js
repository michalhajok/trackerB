// services/BrokerService.js - NOWY PLIK
const XTBAdapter = require("./brokers/XTBAdapter");
// const PKOAdapter = require("./brokers/PKOAdapter");
// const BinanceAdapter = require("./brokers/BinanceAdapter");
// const BybitAdapter = require("./brokers/BybitAdapter");
// const INGAdapter = require("./brokers/INGAdapter");

class BrokerService {
  constructor() {
    this.adapters = new Map([
      ["XTB", new XTBAdapter()],
      // ["PKO", new PKOAdapter()],
      // ["BINANCE", new BinanceAdapter()],
      // ["BYBIT", new BybitAdapter()],
      // ["ING", new INGAdapter()],
    ]);
  }

  getAdapter(broker) {
    const adapter = this.adapters.get(broker);
    if (!adapter) {
      throw new Error(`Broker ${broker} is not supported`);
    }
    return adapter;
  }

  async syncPortfolio(portfolioId) {
    const Portfolio = require("../models/Portfolio");
    const Position = require("../models/Position");

    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    const adapter = this.getAdapter(portfolio.broker);

    try {
      // Get positions from broker
      const brokerPositions = await adapter.getPositions(
        portfolio.brokerConfig
      );

      // Normalize and sync positions
      const syncResults = [];

      for (const brokerPosition of brokerPositions) {
        const normalizedPosition = adapter.normalizePosition(brokerPosition);

        // Find existing position or create new
        let position = await Position.findOne({
          portfolioId: portfolio._id,
          "brokerData.brokerPositionId": brokerPosition.id,
        });

        if (position) {
          // Update existing position
          Object.assign(position, normalizedPosition);
          position.brokerData.lastSyncAt = new Date();
          position.brokerData.syncStatus = "synced";
        } else {
          // Create new position
          position = new Position({
            ...normalizedPosition,
            portfolioId: portfolio._id,
            userId: portfolio.userId,
            brokerData: {
              broker: portfolio.broker,
              brokerPositionId: brokerPosition.id,
              brokerSymbol: brokerPosition.symbol,
              brokerAccountId: portfolio.brokerConfig.accountId,
              originalData: brokerPosition,
              lastSyncAt: new Date(),
              syncStatus: "synced",
            },
          });
        }

        await position.save();
        syncResults.push(position);
      }

      return {
        success: true,
        syncedPositions: syncResults.length,
        positions: syncResults,
      };
    } catch (error) {
      throw new Error(`Sync failed: ${error.message}`);
    }
  }

  async testConnection(broker, credentials) {
    const adapter = this.getAdapter(broker);
    return await adapter.testConnection(credentials);
  }

  async getAccountInfo(broker, credentials) {
    const adapter = this.getAdapter(broker);
    return await adapter.getAccountInfo(credentials);
  }
}

module.exports = new BrokerService();
