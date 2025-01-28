//для kucoin

//Get Currency Detail(Recommend) нетворки
//Get All Tickers инфа по всем монетам

//var CryptoJS = require("crypto-js");

const axios = require("axios").default,
  crypto = require("crypto"),
  kucoinApiKey = ``,
  kucoinApiSecret = ``,
  kucoinPassphrase = "",
  base_kucoin_url = `https://api.kucoin.com`;

async function kucoinGetRequest(endPoint) {
  const now = Date.now();
  // {timestamp+method+endpoint+body}
  const str_to_sign = now.toString + `GET` + endPoint;

  /* signature */
  /*   const signature = CryptoJS.HmacSHA256(str_to_sign, kucoinApiSecret);
  const signatureInBase64 = CryptoJS.enc.Base64.stringify(signature); */

  const hmacsignature = crypto
    .createHmac("sha256", Buffer.from(kucoinApiSecret, "utf8"))
    .update(str_to_sign)
    .digest("base64");
  //.toString('base64');

  /* passphrase */
  /* const passphrase = CryptoJS.HmacSHA256(kucoinPassphrase, kucoinApiSecret);
  const passphraseInBase64 = CryptoJS.enc.Base64.stringify(passphrase); */

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

  //const url = base_kucoin_url + endPoint;

  axios({
    type: "get",
    url: base_kucoin_url + endPoint,
    headers: headers,
    dataType: "json",
  }).then((response) => {
    return response.data;
  });
}

const main = () => {
  const symbol = "BTC";

  const endPoint = `/api/v2/currencies/${symbol}`;

  kucoinGetRequest(endPoint);
};

main();
