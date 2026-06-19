var NodeHelper = require("node_helper");
var https = require("https");

module.exports = NodeHelper.create({
  start: function () {
    this.instances = {};
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification !== "INIT_CONFIG" || !payload || !payload.identifier) {
      return;
    }

    var identifier = payload.identifier;
    var config = payload.config || {};

    this.registerInstance(identifier, config);
    this.fetchAndBroadcast(identifier);
  },

  registerInstance: function (identifier, config) {
    var existing = this.instances[identifier];
    if (existing && existing.timer) {
      clearInterval(existing.timer);
    }

    var interval = Number(config.updateInterval) > 0 ? Number(config.updateInterval) : 60 * 60 * 1000;

    var instance = {
      config: config,
      inFlight: false,
      timer: null
    };

    instance.timer = setInterval(function () {
      this.fetchAndBroadcast(identifier);
    }.bind(this), interval);

    this.instances[identifier] = instance;
  },

  fetchAndBroadcast: async function (identifier) {
    var instance = this.instances[identifier];
    if (!instance) {
      return;
    }

    if (instance.inFlight) {
      return;
    }

    var config = instance.config || {};
    var apiKey = config.apiKey;
    var rates = Array.isArray(config.rates) ? config.rates : [];

    if (!apiKey) {
      this.sendSocketNotification("RATES_ERROR", {
        identifier: identifier,
        message: "FRED API key is missing. Add apiKey in the module config."
      });
      return;
    }

    if (rates.length === 0) {
      this.sendSocketNotification("RATES_ERROR", {
        identifier: identifier,
        message: "No rates configured. Add at least one seriesId in rates."
      });
      return;
    }

    instance.inFlight = true;

    try {
      var normalizedRates = await Promise.all(rates.map(function (rateConfig) {
        return this.fetchSeries(apiKey, rateConfig || {});
      }, this));

      this.sendSocketNotification("RATES_UPDATE", {
        identifier: identifier,
        fetchedAt: new Date().toISOString(),
        rates: normalizedRates
      });
    } catch (error) {
      this.sendSocketNotification("RATES_ERROR", {
        identifier: identifier,
        message: "Failed to retrieve rates from FRED. " + error.message
      });
    } finally {
      instance.inFlight = false;
    }
  },

  fetchSeries: async function (apiKey, rateConfig) {
    var seriesId = String(rateConfig.seriesId || "").trim();
    var label = String(rateConfig.label || seriesId || "Unknown series").trim();

    if (!seriesId) {
      return {
        seriesId: "",
        label: label,
        error: "Missing seriesId in configuration.",
        trend: "unknown"
      };
    }

    try {
      var response = await this.fetchFredObservations(apiKey, seriesId);
      var pair = this.extractLatestPair(response && response.observations ? response.observations : []);

      if (!pair.latest) {
        return {
          seriesId: seriesId,
          label: label,
          error: "No numeric observations available.",
          trend: "unknown"
        };
      }

      var trendData = this.calculateTrend(pair.latest, pair.previous);

      return {
        seriesId: seriesId,
        label: label,
        value: pair.latest.value,
        latestDate: pair.latest.date,
        previousDate: pair.previous ? pair.previous.date : null,
        delta: trendData.delta,
        trend: trendData.trend
      };
    } catch (error) {
      return {
        seriesId: seriesId,
        label: label,
        error: error.message,
        trend: "unknown"
      };
    }
  },

  fetchFredObservations: function (apiKey, seriesId) {
    var params = new URLSearchParams({
      api_key: apiKey,
      series_id: seriesId,
      file_type: "json",
      sort_order: "desc",
      limit: "20"
    });

    var url = "https://api.stlouisfed.org/fred/series/observations?" + params.toString();

    return this.httpGetJson(url).then(function (body) {
      if (body && body.error_code) {
        throw new Error("FRED error " + body.error_code + ": " + body.error_message);
      }
      return body;
    });
  },

  httpGetJson: function (url) {
    return new Promise(function (resolve, reject) {
      https.get(url, function (response) {
        var raw = "";

        response.on("data", function (chunk) {
          raw += chunk;
        });

        response.on("end", function () {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error("HTTP " + response.statusCode));
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error("Invalid JSON returned by FRED."));
          }
        });
      }).on("error", function (error) {
        reject(error);
      });
    });
  },

  extractLatestPair: function (observations) {
    var valid = [];

    for (var i = 0; i < observations.length; i += 1) {
      var observation = observations[i];
      var value = Number.parseFloat(observation && observation.value);

      if (!Number.isFinite(value)) {
        continue;
      }

      valid.push({
        date: observation.date,
        value: value
      });

      if (valid.length === 2) {
        break;
      }
    }

    return {
      latest: valid[0] || null,
      previous: valid[1] || null
    };
  },

  calculateTrend: function (latest, previous) {
    if (!latest || !previous) {
      return {
        trend: "unknown",
        delta: null
      };
    }

    var delta = latest.value - previous.value;
    var epsilon = 1e-9;

    if (delta > epsilon) {
      return {
        trend: "up",
        delta: delta
      };
    }

    if (delta < -epsilon) {
      return {
        trend: "down",
        delta: delta
      };
    }

    return {
      trend: "flat",
      delta: 0
    };
  },

  stop: function () {
    Object.keys(this.instances).forEach(function (identifier) {
      if (this.instances[identifier] && this.instances[identifier].timer) {
        clearInterval(this.instances[identifier].timer);
      }
    }, this);

    this.instances = {};
  }
});
