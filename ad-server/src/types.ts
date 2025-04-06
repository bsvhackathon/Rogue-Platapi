export interface KeyRecord {
    fileUrl: string
    encryptionKey: string
    satoshis: number
    publicKey: string
}

export interface BalanceRecord {
    publicKey: string
    balance: number
}