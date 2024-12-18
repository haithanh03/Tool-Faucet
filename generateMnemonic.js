const bip39 = require("bip39");

// Tạo mnemonic 12 từ
const mnemonic = bip39.generateMnemonic();
console.log("Generated mnemonic:", mnemonic);
