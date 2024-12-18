const { ethers } = require("ethers");
const { Builder, By, until } = require("selenium-webdriver");
require("chromedriver");

// Chuỗi mnemonic và các cấu hình
const mnemonic = "little permit record flame amazing seven copper bench market aim pear silk"; // Replace with a valid mnemonic
const numberOfWallets = 100; // Số lượng ví cần tạo
const faucetURL = "https://faucet.testnet.oasys.games/"; // URL trang faucet
const fixedAddress = "0x038008d93E3d153eF7a6Df2e555c2367cd79f83a"; // Địa chỉ cố định nhận OAS
const providerURL = "https://rpc.testnet.oasys.games"; // RPC URL của mạng blockchain

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

// Tự động gửi request faucet bằng Selenium
async function autoFaucet(walletAddresses) {
    const driver = await new Builder().forBrowser("chrome").build();
    try {
        await driver.get(faucetURL);

        for (const address of walletAddresses) {
            console.log(`Requesting faucet for address: ${address}`);

            // Tìm ô input và nhập địa chỉ ví
            const inputField = await driver.wait(until.elementLocated(By.css('input[placeholder="Address"]')), 5000);
            await inputField.clear();
            await inputField.sendKeys(address);

            // Tìm và click nút Submit
            const submitButton = await driver.wait(
                until.elementLocated(By.xpath("//button[text()='Submit']")),
                5000
            );
            await submitButton.click();

            // Chờ 5 giây để tránh spam
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        console.log("Faucet requests completed!");
    } catch (err) {
        console.error("Error during faucet automation:", err);
    } finally {
        await driver.quit();
    }
}


// Gửi toàn bộ số dư về địa chỉ cố định
async function sendAllFunds(wallets, fixedAddress) {
    const provider = new ethers.providers.JsonRpcProvider(providerURL);

    for (const wallet of wallets) {
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
    console.log("All funds have been transferred to the fixed address!");
}

// Chạy toàn bộ quy trình
async function main() {
    console.log("Step 1: Generating wallets...");
    const { walletAddresses, wallets } = generateWallets(mnemonic, 1);

    console.log("Step 2: Requesting faucet for each wallet...");
    await autoFaucet(walletAddresses);

    console.log("Step 3: Sending funds to fixed address...");
    await sendAllFunds(wallets, fixedAddress);

    console.log("Process completed!");
}

main();
