const axios = require("axios").default,
  crypto = require("crypto"),
  okx_passphrase = ``,
  okx_api_key = ``,
  okx_secret_key = ``,
  okx_base_url = `https://www.okx.com`;

  async function okxGetAdress(coin) {

    const timestamp = new Date().toISOString();
    const method = "GET";
    const requestPath = `/api/v5/asset/deposit-address?ccy=${coin}`;


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

/*   async function okxGetCurrency(coin) {
    const endPoint = `/api/v5/asset/currencies`;
    return await axios({
        url: okx_base_url + endPoint + `?ccy=${coin}`,
        type: "GET",
    }).then(response => 
        console.log(1));
  }; */

  const main = async () => {

    //const data_obtained = await okxGetAdress("ETH");
    const data_obtained = await okxGetCurrency("AAVE");
    console.log(data_obtained);
  };

  main();