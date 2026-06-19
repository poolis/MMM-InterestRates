Module.register("MMM-InterestRates", {
  defaults: {
    apiKey: "",
    updateInterval: 60 * 60 * 1000,
    animationSpeed: 1000,
    rates: [
      {
        seriesId: "DFF",
        label: "Federal Funds Effective Rate"
      },
      {
        seriesId: "PRIME",
        label: "Prime Rate"
      }
    ],
    decimals: 2,
    showTrendDelta: true,
    showLastUpdated: true,
    title: "Interest Rates"
  },

  start: function () {
    this.loaded = false;
    this.error = null;
    this.lastUpdated = null;
    this.ratesData = [];

    this.sendSocketNotification("INIT_CONFIG", {
      identifier: this.identifier,
      config: this.config
    });
  },

  getStyles: function () {
    return ["MMM-InterestRates.css"];
  },

  socketNotificationReceived: function (notification, payload) {
    if (!payload || payload.identifier !== this.identifier) {
      return;
    }

    if (notification === "RATES_UPDATE") {
      this.error = null;
      this.loaded = true;
      this.lastUpdated = payload.fetchedAt || null;
      this.ratesData = payload.rates || [];
      this.updateDom(this.config.animationSpeed);
      return;
    }

    if (notification === "RATES_ERROR") {
      this.loaded = true;
      this.error = payload.message || "Unable to fetch rates.";
      this.updateDom(this.config.animationSpeed);
    }
  },

  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = "mmm-interest-rates";

    if (!this.loaded) {
      wrapper.classList.add("dimmed", "light", "small");
      wrapper.innerText = "Loading rates...";
      return wrapper;
    }

    if (this.error) {
      wrapper.classList.add("bright", "small");
      wrapper.innerText = this.error;
      return wrapper;
    }

    if (!Array.isArray(this.ratesData) || this.ratesData.length === 0) {
      wrapper.classList.add("dimmed", "light", "small");
      wrapper.innerText = "No rate data available.";
      return wrapper;
    }

    if (this.config.title) {
      var title = document.createElement("div");
      title.className = "mmm-interest-rates__title small bright";
      title.innerText = this.config.title;
      wrapper.appendChild(title);
    }

    var table = document.createElement("table");
    table.className = "mmm-interest-rates__table small";

    this.ratesData.forEach(function (rate) {
      var row = document.createElement("tr");
      row.className = "mmm-interest-rates__row";

      var labelCell = document.createElement("td");
      labelCell.className = "mmm-interest-rates__label light";
      labelCell.innerText = rate.label || rate.seriesId || "Rate";

      var valueCell = document.createElement("td");
      valueCell.className = "mmm-interest-rates__value";

      if (rate.error) {
        valueCell.classList.add("dimmed");
        valueCell.innerText = "--";
      } else {
        valueCell.classList.add("mmm-interest-rates__trend-" + (rate.trend || "unknown"));
        valueCell.innerText = this.formatRate(rate.value);

        if (this.config.showTrendDelta && typeof rate.delta === "number") {
          var deltaSpan = document.createElement("span");
          deltaSpan.className = "mmm-interest-rates__delta xsmall dimmed";
          deltaSpan.innerText = " (" + this.formatSignedDelta(rate.delta) + ")";
          valueCell.appendChild(deltaSpan);
        }
      }

      row.appendChild(labelCell);
      row.appendChild(valueCell);
      table.appendChild(row);
    }, this);

    wrapper.appendChild(table);

    if (this.config.showLastUpdated && this.lastUpdated) {
      var updated = document.createElement("div");
      updated.className = "mmm-interest-rates__updated xsmall dimmed";
      updated.innerText = "Updated: " + this.formatTimestamp(this.lastUpdated);
      wrapper.appendChild(updated);
    }

    return wrapper;
  },

  formatRate: function (value) {
    if (typeof value !== "number" || !isFinite(value)) {
      return "--";
    }

    return value.toFixed(this.config.decimals) + "%";
  },

  formatSignedDelta: function (delta) {
    if (typeof delta !== "number" || !isFinite(delta)) {
      return "0.00";
    }

    var sign = delta > 0 ? "+" : "";
    return sign + delta.toFixed(this.config.decimals);
  },

  formatTimestamp: function (isoString) {
    var date = new Date(isoString);

    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }

    return date.toLocaleString();
  }
});
