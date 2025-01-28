const axios = require("axios").default,
  crypto = require("crypto"),
  bitget_base_url = `https://api.bitget.com`,
  bitget_api_key = ``,
  bitget_api_secret = ``,
  bitget_passphrase = ``;

  async function bitgetLoadCurrencies() {
    let bitgetCurrencies = new Map();
    await axios(`https://api.bitget.com/api/spot/v1/public/currencies`).then(response => {
      for (let element of response.data.data) {
        bitgetCurrencies.set(element.coinName, element.chains)
      }
    });
    return bitgetCurrencies
  }

async function bitgetLoad(coin) {

  const timestamp = Date.now();
  
  const method = "GET";
  const requestPath = `/api/spot/v1/wallet/deposit-address`;
  const queryString = `?coin=${coin}`;

  const string_to_sign = timestamp + method + requestPath + queryString;

  const finalSignature = crypto
    .createHmac("sha256", Buffer.from(bitget_api_secret, "utf8"))
    .update(string_to_sign)
    .digest("base64");

  const headers = {
    "ACCESS-KEY": bitget_api_key,
    "ACCESS-SIGN": finalSignature,
    "ACCESS-PASSPHRASE": bitget_passphrase,
    "ACCESS-TIMESTAMP": timestamp,
    "locale": "en-US",
    "Content-Type": "application/json",
  };

  await axios({
    type: "get",
    url: bitget_base_url + requestPath + queryString,
    headers: headers,
    dataType: "json",
  }).then((response) => {
    console.log(response.data);
  });
}

const main = async () => {
  const coin = "AAVE";
  //bitgetLoad(coin);
  const networks = await bitgetLoadCurrencies();
  const coinNetwork = networks.get(coin);
  console.log(coinNetwork);
  
};

main();
