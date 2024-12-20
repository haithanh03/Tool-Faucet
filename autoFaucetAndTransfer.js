const bip39 = require("bip39");
const { ethers } = require("ethers");
const { Builder, By, until } = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const path = require('path');
require("geckodriver");

// Tạo mnemonic 12 từ
const mnemonic = bip39.generateMnemonic();
console.log("Generated mnemonic:", mnemonic);

// Các cấu hình khác
const numberOfWallets = 100;
const faucetURL = "https://faucet.sandverse.oasys.games/";
const fixedAddress = "0xF19A87252c1d9BEF7867E137fCA8eE24Aa3f47AE";
const providerURL = "https://rpc.sandverse.oasys.games";

// Tạo ví từ mnemonic
function generateWallets(mnemonic, number) {
    const walletAddresses = [];
    const wallets = [];
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    for (let i = 0; i < number; i++) {
        const childNode = hdNode.derivePath(`m/44'/60'/0'/0/${i}`);
        const wallet = new ethers.Wallet(childNode.privateKey);
        walletAddresses.push(wallet.address);
        wallets.push(wallet);
        console.log(`Ví ${i + 1}: ${wallet.address}`);
    }
    return { walletAddresses, wallets };
}

// Tự động nhận faucet và gửi tiền
async function autoFaucetAndSendFunds(wallets) {
    // Cấu hình options cho Firefox
    const options = new firefox.Options()
        .addArguments("-headless")
        .addArguments("--width=1920")
        .addArguments("--height=1080");

    // Tạo driver với Firefox
    const driver = await new Builder()
        .forBrowser('firefox')
        .setFirefoxOptions(options)
        .build();

    const provider = new ethers.providers.JsonRpcProvider(providerURL);

    try {
        await driver.get(faucetURL);

        for (const wallet of wallets) {
            console.log(`Requesting faucet for address: ${wallet.address}`);

            const inputField = await driver.wait(until.elementLocated(By.css('input[placeholder="Address"]')), 5000);
            await inputField.clear();
            await inputField.sendKeys(wallet.address);

            const submitButton = await driver.wait(until.elementLocated(By.xpath("//button[text()='Submit']")), 5000);
            await submitButton.click();

            await new Promise(resolve => setTimeout(resolve, 70000));

            const connectedWallet = wallet.connect(provider);
            const balance = await connectedWallet.getBalance();

            if (balance.gt(0)) {
                const gasLimit = ethers.utils.hexlify(21000);
                const gasPrice = await provider.getGasPrice();
                const txCost = gasLimit * gasPrice;
                const sendAmount = balance.sub(txCost);

                if (sendAmount.gt(0)) {
                    const tx = await connectedWallet.sendTransaction({
                        to: fixedAddress,
                        value: sendAmount,
                        gasLimit,
                        gasPrice,
                    });
                    console.log(`Sent ${ethers.utils.formatEther(sendAmount)} OAS from ${wallet.address} to ${fixedAddress} (TX: ${tx.hash})`);
                    await tx.wait();
                } else {
                    console.log(`Wallet ${wallet.address} does not have enough balance to send.`);
                }
            }
        }

        console.log("Faucet requests and fund transfers completed!");
    } catch (err) {
        console.error("Error during faucet automation:", err);
    } finally {
        await driver.quit();
    }
}

// Chạy toàn bộ quy trình
async function main() {
    console.log("Step 1: Generating wallets...");
    const { walletAddresses, wallets } = generateWallets(mnemonic, numberOfWallets);

    console.log("Step 2: Requesting faucet and sending funds for each wallet...");
    await autoFaucetAndSendFunds(wallets);

    console.log("Process completed!");
}

main();
