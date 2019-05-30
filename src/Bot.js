const readline = require('readline');
const utils = require('./utils');
const Candle = require('./Candle');
const Chart = require('./Chart');
const IchimokuStrategy = require('./IchimokuStrategy');

module.exports = class Bot {
    constructor() {
        this.gameSettings = {
            timebank: null,
            time_per_move: null,
            player_names: null,
            your_bot: null,
            candle_interval: null,
            candle_format: null,
            candles_total: null,
            candles_given: null,
            initial_stack: null,
        };

        this.state = {
            date: null,
            charts: {},
            stacks: {},
        };

        this.strategy = new IchimokuStrategy();
    }

    run() {
        this.io = readline.createInterface(process.stdin, process.stdout);
        this.io.on('line', this.handleLine.bind(this));
        this.io.on('close', this.handleIOClose.bind(this));
    }

    handleLine(data) {
        if (data.length === 0) {
            return;
        }

        const lines = data.trim().split('\n');

        while (0 < lines.length) {
            const line = lines.shift().trim();
            const lineParts = line.split(' ');

            if (lineParts.length === 0) {
                return;
            }

            const command = utils.toCamelCase(lineParts.shift());

            if (this[command] instanceof Function) {
                const response = this[command](lineParts);

                if (response && 0 < response.length) {
                    process.stdout.write(response + '\n');
                }
            } else {
                process.stderr.write(
                    'Unable to execute command: ' + command + ', with data: ' + lineParts + '\n'
                );
            }
        }
    }

    handleIOClose() {
        process.exit(0);
    }

    settings(data) {
        const key = data[0];
        const value = data[1];

        switch (key) {
            case 'candle_format':
                this.gameSettings.candle_format = value.split(',');
                break;
            case 'timebank':
            case 'time_per_move':
            case 'candle_interval':
            case 'candles_total':
            case 'candles_given':
            case 'initial_stack':
                this.gameSettings[key] = Number.parseInt(value);
                break;
            default:
                this.gameSettings[key] = value;
        }
    }

    update(data) {
        const command = data.shift();

        if (command === 'game') {
            this.updateGame(data);
            return;
        }
    }

    updateGame(data) {
        switch (data[0]) {
            case 'next_candles':
                this.updateChart(data[1]);
                break;
            case 'stacks':
                this.updateStacks(data[1]);
                break;
            default:
                console.error(`Cannot parse game data input with key ${data[0]}`);
        }
    }

    updateChart(data) {
        const chartStrings = data.split(';');
        let dateUpdated = false;

        for (const candleString of chartStrings) {
            let candle = new Candle(this.gameSettings.candle_format, candleString);
            if (!this.state.charts.hasOwnProperty(candle.pair)) {
                this.state.charts[candle.pair] = new Chart();
            }
            this.state.charts[candle.pair].addCandle(candle);

            if (!dateUpdated) {
                this.state.date = candle.date;
                dateUpdated = true;
            }
            if (candle.pair == "USDT_ETH") {
                this.strategy.process(this.state, "USDT_ETH");
            }
        }
    }

    updateStacks(data) {
        const stackStrings = data.split(',');
        for (const stackString of stackStrings) {
            const parts = stackString.split(':');
            if (!this.state.stacks.hasOwnProperty(parts[0])) {
                this.state.stacks[parts[0]] = {};
            }
            this.state.stacks[parts[0]] = Number.parseFloat(parts[1]);
        }
    }

    action(data) {
        if (data[0] === 'order') {
            this.state.timebank = parseInt(data[1], 10);
            return this.strategy.execute(this.gameSettings, this.state);
        }
    }
};
