const { time } = require("console");

const axios = require("axios").default,
  crypto = require("crypto"),
  huob_api_key = ``,
  huobi_api_secret = ``,
  huobi_base_url = `https://api.huobi.pro`,
  base_uri = "api.huobi.pro";

`https://api.huobi.pro/v2/reference/currencies?currency=bnt`;
async function huobiRequsest(endPoint) {
  return await axios(huobi_base_url + endPoint).then((response) => response.data);
}

// /v2/account/deposit/address ?currency=btc

async function huobiGetAdress(coin) {
  const timestamp = new Date().toISOString().split(".")[0];

  const endpoint = `/v2/account/deposit/address`;
  const requestMethod = "GET";

  const params = {
    "AccessKeyId": huob_api_key,
    "SignatureMethod": "HmacSHA256",
    "SignatureVersion": "2",
    "Timestamp": timestamp,
    "currency": coin,
  };

  const encodedParams = new URLSearchParams(params).toString();

  const pre_signed_text =
    requestMethod + "\n" + base_uri + "\n" + endpoint + "\n" + encodedParams;

  const signature = encodeURI(
    crypto
      .createHmac("SHA256", Buffer.from(huobi_api_secret, "utf8"))
      .update(pre_signed_text)
      .digest("base64")
  );

  //const signature = encodeURI(notEncodedSignature);

  const url =
    `https://` +
    base_uri +
    endpoint +
    `?` +
    encodedParams +
    `&` +
    `Signature=` +
    signature;

  return await axios({
    type: "get",
    url: url,
  }).then((response) => response.data);
}

const main = async () => {
  const coin = `aave`;

  const endpoint = `/v2/reference/currencies?currency=${coin}`;

  const networks = await huobiRequsest(endpoint);
  console.log(networks);

  //huobiGetAdress(coin);

    //console.log(await huobiGetAdress(coin));

};



main();
