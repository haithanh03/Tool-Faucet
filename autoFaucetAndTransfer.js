const bip39 = require("bip39");
const { ethers } = require("ethers");
const { Builder, By, until } = require("selenium-webdriver");
require("chromedriver");

// Tạo mnemonic 12 từ
const mnemonic = bip39.generateMnemonic();
console.log("Generated mnemonic:", mnemonic);

// Chuỗi mnemonic và các cấu hình
// const mnemonic = "leisure climb year beauty call stem thunder minimum gown course right wine"; // Replace with a valid mnemonic
const numberOfWallets = 100; // Số lượng ví cần tạo
const faucetURL = "https://faucet.sandverse.oasys.games/"; // URL trang faucet
const fixedAddress = "0xF19A87252c1d9BEF7867E137fCA8eE24Aa3f47AE"; // Địa chỉ cố định nhận OAS
const providerURL = "https://rpc.sandverse.oasys.games"; // RPC URL của mạng blockchain

// Tạo 100 ví từ mnemonic
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

// Tự động gửi request faucet và gửi ngay sau khi nhận
async function autoFaucetAndSendFunds(wallets) {
    const driver = await new Builder().forBrowser("chrome").build();
    const provider = new ethers.providers.JsonRpcProvider(providerURL);

    try {
        await driver.get(faucetURL);

        for (const wallet of wallets) {
            console.log(`Requesting faucet for address: ${wallet.address}`);

            // Tìm ô input và nhập địa chỉ ví
            const inputField = await driver.wait(until.elementLocated(By.css('input[placeholder="Address"]')), 5000);
            await inputField.clear();
            await inputField.sendKeys(wallet.address);

            // Tìm và click nút Submit
            const submitButton = await driver.wait(
                until.elementLocated(By.xpath("//button[text()='Submit']")),
                5000
            );
            await submitButton.click();

            // Chờ một chút để đảm bảo faucet request được xử lý
            await new Promise(resolve => setTimeout(resolve, 70000));

            // Gửi toàn bộ số dư về địa chỉ cố định
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
