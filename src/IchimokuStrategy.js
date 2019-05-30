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
        this.periods.longPeriod = this.period * 84;
        this.periods.middlePeriod = this.period * 42;
        this.periods.shortPeriod = this.period * 15;
    }

    setLines(state) {
        this.lines.short.push((this.prices.shortLow + this.prices.shortHigh) / 2);
        this.lines.middle.push((this.prices.middleLow + this.prices.middleHigh) / 2);
        this.lines.longA[state.date.getTime() + this.periods.middlePeriod] = (this.lines.short.slice(-1)[0] + this.lines.middle.slice(-1)[0]) / 2;
        this.lines.longB[state.date.getTime() + this.periods.middlePeriod] = (this.prices.longLow + this.prices.longHigh) / 2;
    }

    setPrices(state, chart) {
        this.low.push(state.charts[chart].getCandleAt(state.date).low);
        this.high.push(state.charts[chart].getCandleAt(state.date).high);

        this.prices.shortLow = Math.min(...this.low.slice(-15));
        this.prices.middleLow = Math.min(...this.low.slice(-42));
        this.prices.longLow = Math.min(...this.low.slice(-84));
        this.prices.shortHigh = Math.max(...this.high.slice(-15));
        this.prices.middleHigh = Math.max(...this.high.slice(-42));
        this.prices.longHigh = Math.max(...this.high.slice(-84));
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

        if (closePrice < this.lines.longA[date] && closePrice < this.lines.longB[date]) {
            if (action == "buy")
                return 'pass';
            else
                return action;
        } else if ((closePrice >= this.lines.longA[date] && closePrice <= this.lines.longB[date]) ||
        (closePrice <= this.lines.longA[date] && closePrice >= this.lines.longB[date])) {
            return action;
        } else if (closePrice > this.lines.longA[date] && closePrice > this.lines.longB[date]) {
            if (action == "sell")
                return 'pass';
            else
                return action;
        }
        return 'pass';
    }

    strategy(state, chart) {
        if (this.lines.short.slice(-1)[0] > this.lines.middle.slice(-1)[0]) {
            if (this.lines.short.slice(-5)[0] <= this.lines.middle.slice(-5)[0]) {
                return this.defineAction(state, chart, "buy");
            }
        } else {
            if (this.lines.middle.slice(-5)[0] <= this.lines.short.slice(-5)[0]) {
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
        let amount = 100 / lastClosePrice;
        console.error(amount);

        if (strat == 'pass') {
            return 'pass';
        }
        if (strat == "buy" && dollars < 100) {
            return 'pass';
        }
        if (strat == 'sell') {
            if (eth == 0 || (eth * lastClosePrice) < 100)
                return 'pass';
        }
        const order = new Order(strat, 'USDT_ETH', amount);

        return order.toString();
    }
};