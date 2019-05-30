module.exports = class Chart {
    constructor() {
        this.candles = {};
    }

    addCandle(candle) {
        this.candles[candle.date.getTime()] = candle;
    }

    getCandleAt(date) {
        return this.candles[date.getTime()];
    }
};
