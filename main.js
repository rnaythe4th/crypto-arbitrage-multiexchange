"use strict";

const ccxt = require("../../ccxt.js"),
  asTable = require("as-table"),
  log = require("ololog").configure({ locate: false }),
  fs = require("fs"),
  {} = require("ansicolor").nice,
  verbose = process.argv.includes("--verbose"),
  keysGlobal = "keys.json",
  keysLocal = "keys.local.json",
  keysFile = fs.existsSync(keysLocal)
    ? keysLocal
    : fs.existsSync(keysGlobal)
    ? keysGlobal
    : false,
  config = keysFile ? require("../../" + keysFile) : {},
  { Spot } = require("@binance/connector"),
  crypto = require("crypto"),
  axios = require("axios").default,
  kucoinApiKey = ``,
  kucoinApiSecret = ``,
  kucoinPassphrase = "",
  base_kucoin_url = `https://api.kucoin.com`,
  binanceApiKey =
    "",
  binanceApiSecret =
    "",
  huob_api_key = ``,
  huobi_api_secret = ``,
  huobi_base_url = `https://api.huobi.pro`,
  bitget_base_url = `https://api.bitget.com`;

let printSupportedExchanges = function () {
  log("Supported exchanges:", ccxt.exchanges.join(", ").green);
};

let printUsage = function () {
  log(
    "Usage: node",
    process.argv[1],
    "id1".green,
    "id2".yellow,
    "id3".blue,
    "..."
  );
  printSupportedExchanges();
};

let printExchangeSymbolsAndMarkets = function (exchange) {
  log(getExchangeSymbols(exchange));
  log(getExchangeMarketsTable(exchange));
};

let getExchangeMarketsTable = (exchange) => {
  return asTable.configure({ delimiter: " | " })(Object.values(markets));
};

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let proxies = [
  "", // no proxy by default
  "https://crossorigin.me/",
  "https://cors-anywhere.herokuapp.com/",
];

// функция для сортировки массива объектов по значению конкретного поля каждого объекта
function byField(field) {
  return (a, b) => (a[field] > b[field] ? 1 : -1);
}

// функция для нахождения пересечения массивов без повторения элементов
function getUniqueIntersect(arr1, arr2) {
  let tmpArray = [];
  for (let i = 0; i < arr1.length; i++) {
    for (let j = 0; j < arr2.length; j++) {
      if (arr1[i] === arr2[j] && !~tmpArray.indexOf(arr1[i]))
        tmpArray.push(arr1[i]);
    }
  }
  return tmpArray;
}

// информация о всех монетах бинанса
const loadBinance = async (binanceClient) => {
  let binanceWalletInfo = new Map();
  await binanceClient.coinInfo().then((response) => {
    for (let coinInfo of response.data) {
      binanceWalletInfo.set(coinInfo.coin, coinInfo.networkList);
    }
  });

  return binanceWalletInfo;
};
// https://api.bitget.com/api/spot/v1/wallet/deposit-address?coin=USDT
// https://api.bitget.com/api/spot/v1/public/currencies
// получение инфы по всем монетам от Bitget
async function bitgetLoadCurrencies() {
  let bitgetCurrencies = new Map();
  await axios(`https://api.bitget.com/api/spot/v1/public/currencies`).then(response => {
    for (let element of response.data.data) {
      bitgetCurrencies.set(element.coinName, element.chains)
    }
  });
  return bitgetCurrencies
}

async function okxGetCurrency(coin) {

  const timestamp = new Date().toISOString();
  const method = "GET";
  const requestPath = `/api/v5/asset/currencies?ccy=${coin}`;


  const prehash = timestamp + method + requestPath;

  const sign = crypto
  .createHmac("sha256", Buffer.from(okx_secret_key, "utf8"))
  .update(prehash)
  .digest("base64");

  const headers = {
      "OK-ACCESS-KEY": okx_api_key,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": okx_passphrase,
  }

  return await axios({
      url: okx_base_url + requestPath,
      type: method,
      headers: headers,
      dataType: "json",
  }).then(response => response.data.data
  )
};

// получение инфы о сетях по монете от Huobi
async function huobiGetNetworks(coin) {
  return await axios(
    `https://api.huobi.pro/v2/reference/currencies?currency=${coin}`
  ).then((response) => {
    if (response.status == 200) {
      return response.data.data[0];
    } else console.log(`Error getting ${coin} data from Huobi`);
  });
}

// GET-запрос к kucoin
async function kucoinGetRequest(endPoint) {
  const now = Date.now();
  // {timestamp+method+endpoint+body}
  const str_to_sign = now.toString + `GET` + endPoint;

  const hmacsignature = crypto
    .createHmac("sha256", Buffer.from(kucoinApiSecret, "utf8"))
    .update(str_to_sign)
    .digest("base64");

  const hmacpassphrase = crypto
    .createHmac("sha256", Buffer.from(kucoinApiSecret, "utf8"))
    .update(kucoinPassphrase)
    .digest("base64");

  const headers = {
    "KC-API-SIGN": hmacsignature,
    "KC-API-TIMESTAMP": now,
    "KC-API-KEY": kucoinApiKey,
    "KC-API-PASSPHRASE": hmacpassphrase,
    "KC-API-KEY-VERSION": "2",
  };
  return await axios({
    type: "get",
    url: base_kucoin_url + endPoint,
    headers: headers,
    dataType: "json",
  }).then((response) => {
    if (response.status == 200) {
      return response.data.data;
    } else {
      console.log(`Failed to get kucoin data, code: ${response.data.code}`);
    }
  });
}

function checkSqueeze(orderbook, direction, money) {
  let summ = 0;
  let i = 0;
  switch (direction) {
    case "ask":
      for (i = 0; summ < money; i++) {
        // на случай если книга ордеров слишком короткая или её вообще нет
        // проверка длины массива асков, чтобы цикл не вышел за её пределы
        if (orderbook.asks.length < i + 1 || orderbook.asks.length == 0) {
          summ = 99999999999; // значит ликвидности не хватило, бескончено большой сквиз (хотя это не всегда так, т.к. биржи могут прислать короткую книгу ордеров)
        } else {
          summ = summ + orderbook.asks[i][0] * orderbook.asks[i][1];
        }
      }
      // проверка наличия элементов в массиве асков
      return orderbook.asks.length == 0
        ? 99999
        : orderbook.asks.length < i
        ? (orderbook.asks[i - 2][0] - orderbook.asks[0][0]) /
          orderbook.asks[0][0]
        : orderbook.asks.length == i
        ? summ
        : (orderbook.asks[i][0] - orderbook.asks[0][0]) / orderbook.asks[0][0];
    case "bid":
      for (i = 0; summ < money; i++) {
        // на случай если книга ордеров слишком короткая или её вообще нет
        // проверка длины массива бидов, чтобы цикл не вышел за её пределы
        if (orderbook.bids.length < i + 1 || orderbook.bids.length == 0) {
          summ = 99999; // // значит ликвидности не хватило, бескончено большой сквиз (хотя это не всегда так, т.к. биржи могут прислать короткую книгу ордеров)
        } else {
          summ = summ + orderbook.bids[i][0] * orderbook.bids[i][1];
        }
      }

      // проверка наличия элементов в массиве бидов
      return orderbook.bids.length == 0
        ? 99999
        : orderbook.bids.length < i
        ? (orderbook.bids[0][0] - orderbook.bids[i - 2][0]) /
          orderbook.bids[0][0]
        : orderbook.bids.length == i
        ? summ
        : (orderbook.bids[0][0] - orderbook.bids[i][0]) / orderbook.bids[0][0];
    default:
      console.log("Direction is not defined");
      break;
  }
}

(async function main() {
  // market data endpoints -> exchange information (status: trading)

  const programStart = new Date().getTime();

  if (process.argv.length > 3) {
    let ids = process.argv.slice(2);
    let exchanges = {};

    log(ids.join(", ").yellow);
    // load all markets from all exchanges
    console.log("Loading markets...");
    for (let id of ids) {
      let settings = config[id] || {};

      // instantiate the exchange by id
      let exchange = new ccxt[id](
        ccxt.extend(
          {
            // verbose,
            // 'proxy': 'https://cors-anywhere.herokuapp.com/',
          },
          settings
        )
      );

      // save it in a dictionary under its id for future use
      exchanges[id] = exchange;

      // load all markets from the exchange
      // let markets = await exchange.fetchCurrencies();

      // basic round-robin proxy scheduler
      /* let currentProxy = 0;
      let maxRetries = proxies.length;

      for (let numRetries = 0; numRetries < maxRetries; numRetries++) {
        try {
          // try to load exchange markets using current proxy

          exchange.proxy = proxies[currentProxy];
          //await exchange.loadMarkets();
          await exchange.fetchCurrencies();
        } catch (e) {
          // rotate proxies in case of connectivity errors, catch all other exceptions

          // swallow connectivity exceptions only
          if (
            e instanceof ccxt.DDoSProtection ||
            e.message.includes("ECONNRESET")
          ) {
            log.bright.yellow("[DDoS Protection Error] " + e.message);
          } else if (e instanceof ccxt.RequestTimeout) {
            log.bright.yellow("[Timeout Error] " + e.message);
          } else if (e instanceof ccxt.AuthenticationError) {
            log.bright.yellow("[Authentication Error] " + e.message);
          } else if (e instanceof ccxt.ExchangeNotAvailable) {
            log.bright.yellow("[Exchange Not Available Error] " + e.message);
          } else if (e instanceof ccxt.ExchangeError) {
            log.bright.yellow("[Exchange Error] " + e.message);
          } else {
            throw e; // rethrow all other exceptions
          }

          // retry next proxy in round-robin fashion in case of error
          currentProxy = ++currentProxy % proxies.length;
        }
      } */
    }

    let binanceWalletInfo = new Map();
    let bitgetCurrencies = new Map();

    const binanceClient = new Spot(binanceApiKey, binanceApiSecret);

    //await bitgetLoadCurrencies();
    //binanceWalletInfo = await loadBinance(binanceClient);

    // получение инфы по всем монетам

    // loading all tickets from all exchanges
    let startTime = new Date().getTime();
    let ticketsArray = {};
    console.log("LOADING PRICES...".yellow);
    for (let id of ids) {
      ticketsArray[id] = exchanges[id].fetchTickers();
    }
    let tmpArray = [];
    for (let id of ids) {
      tmpArray.push(ticketsArray[id]);
    }

    await Promise.all(tmpArray).then((result) => (tmpArray = result));

    ids.reverse();
    let exchangeCount = ids.length;
    for (let exchange of ids) {
      ticketsArray[exchange] = tmpArray[exchangeCount - 1];
      exchangeCount--;
    }

    let endTime = new Date().getTime();
    log(`${(endTime - startTime) / 1000} sec total`);

    ids.reverse();

    await exchanges["binance"].fetchCurrencies();

    // creating a list of "XXX/USDT" only pairs
    let resultTable = [];
    for (let currentExchange in ticketsArray) {
      for (let symbol in ticketsArray[currentExchange]) {
        if (symbol.endsWith("USDT")) {
          let row = {};
          // making a row with the information we are looking for (name, exchange, bid, ask)
          row = {
            pair: symbol,
            exchange: currentExchange,
            bid: ticketsArray[currentExchange][symbol]["bid"],
            ask: ticketsArray[currentExchange][symbol]["ask"],
          };
          // and pushing this row to the result table
          resultTable.push(row);
        }
      }
    }

    // sorting result table by ticket name
    resultTable.sort((a, b) => a.pair.localeCompare(b.pair));

    // remove all rows with 0 ask or bid in them
    for (let row = 0; row != resultTable.length; ) {
      if (!resultTable[row].ask || !resultTable[row].bid) {
        resultTable.splice(row, 1);
        row--;
      } else {
        row++;
      }
    }

    // creating a list of possible arbitrage chains
    let compareArray = [];
    let tempArray = [];
    for (let i = 1; i < resultTable.length - 1; i++) {
      // looking for identical symbols in result table
      if (
        resultTable[i].pair.substr(0, resultTable[i].pair.indexOf("/")) ==
        resultTable[i - 1].pair.substr(0, resultTable[i - 1].pair.indexOf("/"))
      ) {
        tempArray.push(resultTable[i - 1]);
        // cheking if the next symbol has the same name,
        // and if it doesn't, adding current symbol to the temporary array
        // otherwise it will be skiped
        if (
          resultTable[i].pair.substr(0, resultTable[i].pair.indexOf("/")) !=
          resultTable[i + 1].pair.substr(
            0,
            resultTable[i + 1].pair.indexOf("/")
          )
        ) {
          tempArray.push(resultTable[i]);
        }
      } else {
        // as soon as 2 nighbor symbols don't have the same name
        // starting working with temporary array (same symbols)
        if (tempArray.length > 0) {
          // sorting symbols by ask, so the highest is in the end
          tempArray.sort((a, b) => a.ask - b.ask);

          // 1 способ
          // найти наибольшую разность
          let maxDiff = 0;
          let min = tempArray[0].bid - tempArray[0].ask;
          let maxDiffRow = {};
          for (let k = 0; k < tempArray.length; k++) {
            for (let l = 0; l < tempArray.length; l++) {
              if (
                tempArray[l].bid - tempArray[k].ask >= min &&
                maxDiff < tempArray[l].bid - tempArray[k].ask
              ) {
                maxDiff = tempArray[l].bid - tempArray[k].ask;
                maxDiffRow = {
                  pair: tempArray[k].pair,
                  askExchange: tempArray[k].exchange,
                  bidExchange: tempArray[l].exchange,
                  ask: tempArray[k].ask,
                  bid: tempArray[l].bid,
                  difference: maxDiff.toFixed(6),
                  percentage: `${(
                    100 *
                    ((1 / tempArray[k].ask) * tempArray[l].bid - 1)
                  ).toFixed(1)} %`,
                  askSqueeze: 0,
                  bidSqueeze: 0,
                  ROE: 0,
                };
              }

              if (tempArray[l].bid - tempArray[k].ask < min) {
                min = tempArray[l].bid - tempArray[k].ask;
              }
            }
          }
          if (maxDiffRow.pair != undefined) {
            compareArray.push(maxDiffRow);
          }

          // 2 способ
          // найти сначала макс бид, потом мин аск, затем их разность
          //потенциально проще
        }
        // reseting temporary array every iteration
        tempArray = [];
      }
    }

    // limit to 10% difference
    compareArray = compareArray.filter(
      (element) =>
        parseFloat(
          element.percentage.substring(0, element.percentage.indexOf("%"))
        ) <= 60
    );
    // sorting by highest %
    compareArray.sort(
      (a, b) => parseFloat(a.percentage) - parseFloat(b.percentage)
    );

    //reversing to make highest % being first
    compareArray = compareArray.reverse();
    // leaving only 20 symbols with highest %
    console.log("");
    compareArray = compareArray.filter(
      (element) => parseFloat(element.percentage) >= 1.5
    );

    // сделать проверку того, что это инфа по споту, т.к. .markets.symbol.type == 'spot'

    // check for ability to trade
    for (let element of compareArray) {
      if (
        !exchanges[element.askExchange].markets[element.pair].active ||
        !exchanges[element.bidExchange].markets[element.pair].active
      ) {
        compareArray.splice(compareArray.indexOf(element), 1);
      }
    }

    console.log(``);
    log(asTable.configure({ delimiter: " | " })(compareArray));
   

    // проверка совместимости сетей + возможности вывода
    /* compareArray.filter((element) => {
      const coin = element.pair.substr(0, element.pair.indexOf("/"));

      let askNetworks = [];
      let bidNetworks = [];
      // сначала проверяем аски
      switch (element.askExchange) {
        case "binance":
          // проверка, не загружались ли данные по монетам с бинанса до этого
          if (binanceWalletInfo.size == 0) loadBinance(binanceClient);

          const binanceAskNetworks = binanceWalletInfo.get(coin);

          // перебираем сети для этой монеты
          for (let currentCoinNetwork of binanceAskNetworks) {
            if (currentCoinNetwork.withdrawEnable) {
              // если вывод доступен, то добавляем инфу в массив сетей вывода
              askNetworks.push({
                shortName: currentCoinNetwork.network,
                fullName: currentCoinNetwork.name,
                withdrawFee: currentCoinNetwork.withdrawFee,
                withdrawMax: currentCoinNetwork.withdrawMax,
              });
            }
          }
          // если не нашло ни одной доступной сети для асков, то убираем пару из compareArray
          if (askNetworks.length == 0) return false;
          break;

        case "kucoin":
          //получаем данные по монете
          const kucoinAskNetworks = kucoinGetRequest(
            `/api/v2/currencies/${coin}`
          );

          const kucoinAskNetworks = Promise.all([kucoinGetRequest(
            `/api/v2/currencies/${coin}`
          )]).then(response => {
            console.log(`fegd`)
          }) ;

          //перебираем сети
          if (kucoinAskNetworks.chains.length > 0) {
            for (let currentCoinNetwork of kucoinAskNetworks.chains) {
              if (currentCoinNetwork.isWithdrawEnable) {
                askNetworks.push({
                  minimizedName: currentCoinNetwork.chain, //'trx'
                  shortName: currentCoinNetwork.chainName, //'TRC20'
                  withdrawFee: currentCoinNetwork.withdrawalMinFee,
                });
              }
            }
          } else {
            console.log(`Warning, found 0 ask networks for ${coin} (Kucoin)`);
          }
          // если не нашло ни одной доступной сети для асков, то убираем пару из compareArray
          if (askNetworks.length == 0) return false;
          break;

        default:
          console.log(
            `Exchange name invalid! Unable to verify ask networks for ${coin}`
          );
          break;
      }
      // теперь проверяем биды
      switch (element.bidExchange) {
        case "binance":
          // проверка, не загружались ли данные по монетам с бинанса до этого
          if (binanceWalletInfo.size == 0) {
            loadBinance(binanceClient);
          }

          const binanceBidNetworks = binanceWalletInfo.get(coin);

          // перебираем сети для этой монеты
          for (let currentCoinNetwork of binanceBidNetworks) {
            if (currentCoinNetwork.depositEnable) {
              // если ввод доступен, то добавляем инфу в массив сетей ввода
              bidNetworks.push({
                shortName: currentCoinNetwork.network,
                fullName: currentCoinNetwork.name,
              });
            }
          }
          // если не нашло ни одной доступной сети для бидов, то убираем пару из compareArray
          if (bidNetworks.length == 0) return false;
          break;

        case "kucoin":
          //получаем данные по монете
          const kucoinBidNetworks = kucoinGetRequest(
            `/api/v2/currencies/${coin}`
          );
          //перебираем сети
          if (kucoinBidNetworks.chains.length > 0) {
            for (let currentCoinNetwork of kucoinBidNetworks.chains) {
              if (currentCoinNetwork.isDepositEnable) {
                bidNetworks.push({
                  minimizedName: currentCoinNetwork.chain, //'trx'
                  shortName: currentCoinNetwork.chainName, //'TRC20'
                });
              }
            }
          } else {
            console.log(`Warning, found 0 bid networks for ${coin} (Kucoin)`);
          }
          // если не нашло ни одной доступной сети для бидов, то убираем пару из compareArray
          if (bidNetworks.length == 0) return false;
          break;

        default:
          console.log(
            `Exchange name invalid! Unable to verify bid networks for ${coin}`
          );
          break;
      }

      // теперь надо найти совпадающие сети и если их несколько, то выбрать сеть с минимальной комиссией

      //const sameNetworks = getUniqueIntersect(askNetworks, bidNetworks);
      const sameNetworks = getUniqueIntersect(
        askNetworks.map((a) => a.shortName),
        bidNetworks.map((a) => a.shortName)
      );

      if (sameNetworks.lenght > 0) {
        //sameNetworks.sort(byField('withdrawFee'))
        return true;
      } else return false;
    }); */

    // check for ability to deposit and withdraw (Huobi and Kucoin only)
    /* for (let element of compareArray) {
      const id = element.pair.substring(0, element.pair.indexOf("/"));
      if (
        ((element.askExchange == "huobi" || element.askExchange == "kucoin") &&
          !exchanges[element.askExchange].currencies[id].active) ||
        ((element.bidExchange == "huobi" || element.bidExchange == "kucoin") &&
          !exchanges[element.bidExchange].currencies[id].active)
      ) {
        compareArray.splice(compareArray.indexOf(element), 1);
      }
    } */

    // проверка на возможность ввода-вывода с помощью API бирж
    // *не сделано пока да и вообще нафиг надо, если сверху проверяет*

    const moneyAmount = 1000;
    console.log("");
    log(
      "Checking if available liquidity is at least",
      `$${moneyAmount}`.green,
      `...`
    );
    console.log("");

    // check for available liquidity
    let asksPromises = [];
    let bidsPromises = [];
    for (let row of compareArray) {
      asksPromises.push(exchanges[row.askExchange].fetchOrderBook(row.pair));
      bidsPromises.push(exchanges[row.bidExchange].fetchOrderBook(row.pair));
    }

    await Promise.all(asksPromises.concat(bidsPromises)).then((result) => {
      asksPromises = result.splice(0, asksPromises.length);
      bidsPromises = result;
    });
    let orderbookArray = [];
    let count = 0;
    for (let row of compareArray) {
      orderbookArray.push({
        pair: row.pair,
        asksOrderbook: asksPromises[count],
        bidsOrderbook: bidsPromises[count],
      });
      count++;
    }

    // filtering all pairs with $100 liquidity

    compareArray = compareArray.filter((element) => {
      const asksOrderbook =
        orderbookArray[compareArray.indexOf(element)].asksOrderbook;
      const bidsOrderbook =
        orderbookArray[compareArray.indexOf(element)].bidsOrderbook;

      const askSqueeze = checkSqueeze(asksOrderbook, "ask", moneyAmount);
      const bidSqueeze = checkSqueeze(bidsOrderbook, "bid", moneyAmount);

      element.askSqueeze = `${(askSqueeze * 100).toFixed(1)} %`;
      element.bidSqueeze = `${(bidSqueeze * 100).toFixed(1)} %`;

      element.ROE = `${(
        parseFloat(element.percentage) -
        (askSqueeze + bidSqueeze) * 100
      ).toFixed(1)} %`;

      return parseFloat(element.ROE) >= 1;
    });

    console.log(``);
    console.log(`Checking for available networks...`);
    console.log(``);

    // проверяем возможность вывода и загружаем информацию о сетях для каждой монеты
  

    const vrem = Object.getOwnPropertyNames(exchanges["binance"].currencies);

    log(asTable.configure({ delimiter: " | " })(compareArray));
    const now = new Date();
    console.log("");
    console.log(now);
    console.log("");
    const programEnd = new Date().getTime();
    console.log(`${(programEnd - programStart) / 1000} secs`);

    let vremenno = [];

    /*   for (let currency of exchanges['binance'].currencies) {
      vremenno.push(currency)
    }

    console.log(Object.keys(exchanges['binance'].currencies).length);
 */
  } else {
    printUsage();
  }

  process.exit();
})();
