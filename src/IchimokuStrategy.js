const Order = require('./Order');

module.exports = class IchimokuStrategy {
    constructor() {
        this.periods = {
            shortPeriod : null,
            middlePeriod : null,
            longPeriod : null,
        };
        this.period = null;
        this.lines = {
            short : [],
            middle : [],
            longA : {},
            longB : {},
        };
        this.low = [];
        this.high = [];
        this.prices = {
            shortLow : null,
            shortHigh : null,
            middleLow : null,
            middleHigh : null,
            longLow : null,
            longHigh : null,
        };
        this.firstDate = null;
        this.begin = false;
        this.trade = false;
    }

    setPeriods(state) {
        this.period = state.date.getTime() - this.firstDate;
        this.periods.longPeriod = this.period * 52;
        this.periods.middlePeriod = this.period * 26;
        this.periods.shortPeriod = this.period * 9;
    }

    setLines(state, chart) {
        this.lines.short.push((this.prices.shortLow + this.prices.shortHigh) / 2);
        this.lines.middle.push((this.prices.middleLow + this.prices.middleHigh) / 2);
        this.lines.longA[state.date.getTime() + this.periods.middlePeriod] = (this.lines.short.slice(-1)[0] + this.lines.middle.slice(-1)[0]) / 2;
        this.lines.longB[state.date.getTime() + this.periods.middlePeriod] = (this.prices.longLow + this.prices.longHigh) / 2;
    }

    setPrices(state, chart) {
        this.low.push(state.charts[chart].getCandleAt(state.date).low);
        this.high.push(state.charts[chart].getCandleAt(state.date).high);

        this.prices.shortLow = Math.min(...this.low.slice(-9));
        this.prices.middleLow = Math.min(...this.low.slice(-26));
        this.prices.longLow = Math.min(...this.low.slice(-52));
        this.prices.shortHigh = Math.max(...this.high.slice(-9));
        this.prices.middleHigh = Math.max(...this.high.slice(-26));
        this.prices.longHigh = Math.max(...this.high.slice(-52));
    }

    process(state, chart) {
        if (this.begin == false) {
            if (this.firstDate != null) {
                this.setPeriods(state);
                this.begin = true;
            } else {
                this.firstDate = state.date.getTime();
            }
        }
        this.setPrices(state, chart);
        if (this.begin == true) {
            this.setLines(state);
        }
    }

    defineAction(state, chart, action) {
        const closePrice = state.charts[chart].getCandleAt(state.date).close;
        const date = state.date.getTime();
        const lag = state.charts[chart].getCandleAt(new Date(date - this.periods.middlePeriod)).close;

        if (closePrice < this.lines.longA[date] && closePrice < this.lines.longB[date]) {
            if (action == "buy" || closePrice > lag)
                return 'pass';
            else
                return {
                    "action" : action,
                    "force" : 500,
                };
        } else if ((closePrice >= this.lines.longA[date] && closePrice <= this.lines.longB[date]) ||
        (closePrice <= this.lines.longA[date] && closePrice >= this.lines.longB[date])) {
            return {
                "action" : action,
                "force" : 200,
            };
        } else if (closePrice > this.lines.longA[date] && closePrice > this.lines.longB[date]) {
            if (action == "sell" || closePrice < lag)
                return 'pass';
            else
                return {
                    "action" : action,
                    "force" : 500,
                };
        }
        return 'pass';
    }

    strategy(state, chart) {
        if (this.lines.short.slice(-1)[0] > this.lines.middle.slice(-1)[0]) {
            if (this.lines.short.slice(-17)[0] <= this.lines.middle.slice(-17)[0]) {
                return this.defineAction(state, chart, "buy");
            }
        } else {
            if (this.lines.middle.slice(-17)[0] <= this.lines.short.slice(-17)[0]) {
                return this.defineAction(state, chart, "sell");
            }
        }
        return 'pass';
    }

    execute(gameSettings, state) {
        if ((state.date.getTime() - this.firstDate) / this.period < 84)
            return 'pass';
        // console.error(this.lines);
        const dollars = state.stacks["USDT"];
        const eth = state.stacks["ETH"];
        const lastClosePrice = state.charts["USDT_ETH"].getCandleAt(state.date).close;
        const strat = this.strategy(state, "USDT_ETH");
        let amount = strat["force"] / lastClosePrice;
        process.stderr.write("Short:" + this.lines.short.slice(-1) + ", middle:" + this.lines.middle.slice(-1) + "\n");

        if (strat == 'pass') {
            return 'pass';
        }
        if (strat["action"] == "buy" && dollars < strat["force"]) {
            return 'pass';
        }
        if (strat["action"] == 'sell' && eth < amount) {
            return 'pass';
        }
        const order = new Order(strat["action"], 'USDT_ETH', amount);

        return order.toString();
    }
};